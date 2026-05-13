import { useState, useMemo, useRef, useEffect } from 'react'
import {
  staff as mockStaff, shiftData as mockShiftData, daysConfig,
  decomposeShiftHours, calcDailyPay, calcMonthlyPayroll, parseShiftTimes, PAYROLL,
} from '../../data/mockData'
import { useOrg } from '../../context/OrgContext'
import * as employeesApi from '../../api/employees'
import * as versionsApi from '../../api/versions'
import * as shiftsApi from '../../api/shifts'

const HALVES = [
  { key: 'first',  label: '前半 (1〜15日)', from: 1,  to: 15 },
  { key: 'second', label: '後半 (16〜31日)', from: 16, to: 31 },
  { key: 'all',    label: '全月',            from: 1,  to: 31 },
]

function deriveDayCode(daySlots, empId) {
  if (!daySlots) return 'X'
  const hours = []
  for (const [slot, ids] of Object.entries(daySlots)) {
    if (Array.isArray(ids) && ids.includes(empId)) {
      const h = parseInt(slot.split(':')[0], 10)
      if (!Number.isNaN(h)) hours.push(h)
    }
  }
  if (!hours.length) return 'X'
  hours.sort((a, b) => a - b)
  const s = hours[0], e = hours[hours.length - 1] + 1
  if (s === 9 && e === 18) return 'F'
  if (s === 9) return `O-${e}`
  if (e === 22) return `${s}-L`
  return `${s}-${e}`
}

function staffMonthlyTotals(staffMember, dayFrom, dayTo, shiftData) {
  let totalHours = 0
  let totalDays = 0
  let totalPay = 0
  let totalTransit = 0
  for (let day = dayFrom; day <= dayTo; day++) {
    const code = shiftData[staffMember.id]?.[day - 1]
    if (!code || code === 'X') continue
    const t = parseShiftTimes(code)
    if (!t) continue
    const { labor, overtime, lateNight, otLateNight } = decomposeShiftHours(t.start, t.end)
    totalHours   += labor
    totalDays    += 1
    totalPay     += calcDailyPay(staffMember.wage, labor, overtime, lateNight, otLateNight)
    totalTransit += staffMember.transitPerDay || 0
  }
  return { totalHours, totalDays, totalPay: Math.round(totalPay), totalTransit }
}

const yen = (v) => `¥${Math.round(v).toLocaleString()}`

export default function Payroll() {
  const { orgId, stores } = useOrg()
  const storeId = stores[0]?.id

  // 月選択（year/month）+ 半月選択
  const today = new Date()
  const [year,  setYear]  = useState(2026)
  const [month, setMonth] = useState(4)
  const [half, setHalf] = useState('first')
  const period = HALVES.find(h => h.key === half)

  const monthLabel = `${year}年${month}月`
  const lastDay = new Date(year, month, 0).getDate()
  const dayFromInPeriod = period.from
  const dayToInPeriod   = Math.min(period.to, lastDay)

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12) } else { setMonth(m => m - 1) }
  }
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1) } else { setMonth(m => m + 1) }
  }

  // DB社員 + 最新versionのassignedをロード
  const [dbEmployees, setDbEmployees] = useState([])
  const [dbAssigned,  setDbAssigned]  = useState({})
  useEffect(() => {
    if (!orgId || !storeId) return
    let cancelled = false
    ;(async () => {
      try {
        const emps = await employeesApi.listEmployees(orgId)
        if (cancelled) return
        setDbEmployees(emps)
        const versions = await versionsApi.listVersions(storeId)
        if (cancelled || !versions?.length) return
        const target = versions.find(v => v.status === 'confirmed') || versions[0]
        const assigned = await shiftsApi.loadAssignments({ versionId: target.id })
        if (!cancelled) setDbAssigned(assigned ?? {})
      } catch (e) { console.error('[Payroll.load]', e) }
    })()
    return () => { cancelled = true }
  }, [orgId, storeId])

  const staff = useMemo(() => (dbEmployees.length ? dbEmployees : mockStaff), [dbEmployees])
  const shiftData = useMemo(() => {
    if (!dbEmployees.length) return mockShiftData
    const out = {}
    for (const emp of dbEmployees) {
      out[emp.id] = daysConfig.map(d => deriveDayCode(dbAssigned?.[d.day], emp.id))
    }
    return out
  }, [dbEmployees, dbAssigned])
  const [showCsvModal,    setShowCsvModal]    = useState(false)
  const [pendingCsvFile,  setPendingCsvFile]  = useState(null)
  const [csvMsg,          setCsvMsg]          = useState('')
  // manualOverrides: { [staffName]: row values } — allows uploading manual adjustments
  const [manualOverrides, setManualOverrides] = useState({})
  const fileInputRef = useRef(null)

  const PAYROLL_CSV_COLS = ['STAFF','総勤務時間(h)','総勤務日数','給与合計額(円)','交通費合計額(円)','社会保険加入','社会保険料(円)','雇用保険料(円)','厚生年金料(円)','所得税(円)','合計振込予定額(円)']

  const downloadPayrollCsv = () => {
    const header = PAYROLL_CSV_COLS.join(',')
    const dataRows = staff.map(s => {
      const totals  = staffMonthlyTotals(s, period.from, period.to)
      const payroll = calcMonthlyPayroll(s, totals)
      const ov = manualOverrides[s.name]
      return [
        s.name,
        (ov?.totalHours  ?? totals.totalHours.toFixed(1)),
        (ov?.totalDays   ?? totals.totalDays),
        (ov?.totalPay    ?? Math.round(totals.totalPay)),
        (ov?.totalTransit?? totals.totalTransit),
        payroll.enroll ? 'ENTRY' : '—',
        payroll.socialIns ? Math.round(ov?.socialIns ?? payroll.socialIns) : 0,
        payroll.empIns    ? Math.round(ov?.empIns    ?? payroll.empIns)    : 0,
        payroll.pension   ? Math.round(ov?.pension   ?? payroll.pension)   : 0,
        payroll.incomeTax ? Math.round(ov?.incomeTax ?? payroll.incomeTax) : 0,
        Math.round(ov?.finalPay ?? payroll.finalPay),
      ].join(',')
    })
    const csv = [header, ...dataRows].join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `payroll_${period.key}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const executePayrollCsvUpload = () => {
    if (!pendingCsvFile) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const lines = ev.target.result.replace(/^﻿/, '').trim().split('\n').slice(1)
        const next = {}
        let count = 0
        lines.forEach(line => {
          const p = line.split(',').map(s => s.trim())
          if (p.length < 11) return
          const name = p[0]
          if (!name || name === 'TOTAL') return
          next[name] = {
            totalHours:   parseFloat(p[1])  || null,
            totalDays:    parseInt(p[2])    || null,
            totalPay:     parseInt(p[3])    || null,
            totalTransit: parseInt(p[4])    || null,
            socialIns:    parseInt(p[6])    || null,
            empIns:       parseInt(p[7])    || null,
            pension:      parseInt(p[8])    || null,
            incomeTax:    parseInt(p[9])    || null,
            finalPay:     parseInt(p[10])   || null,
          }
          count++
        })
        if (!count) { setCsvMsg('CSVの形式が正しくありません。'); setShowCsvModal(false); return }
        setManualOverrides(next)
        setCsvMsg(`✓ ${count}名分の手動調整データを読み込みました`)
        setTimeout(() => setCsvMsg(''), 3000)
      } catch { setCsvMsg('CSVの読み込みに失敗しました。') }
    }
    reader.readAsText(pendingCsvFile, 'UTF-8')
    setShowCsvModal(false)
    setPendingCsvFile(null)
  }

  const rows = useMemo(() => staff.map(s => {
    const totals  = staffMonthlyTotals(s, dayFromInPeriod, dayToInPeriod, shiftData)
    const payroll = calcMonthlyPayroll(s, totals)
    const ov = manualOverrides[s.name]
    const mergedTotals  = ov ? { ...totals,  ...(ov.totalHours  != null ? { totalHours:  ov.totalHours  } : {}), ...(ov.totalDays != null ? { totalDays: ov.totalDays } : {}), ...(ov.totalPay != null ? { totalPay: ov.totalPay } : {}), ...(ov.totalTransit != null ? { totalTransit: ov.totalTransit } : {}) } : totals
    const mergedPayroll = ov ? { ...payroll, ...(ov.socialIns != null ? { socialIns: ov.socialIns } : {}), ...(ov.empIns != null ? { empIns: ov.empIns } : {}), ...(ov.pension != null ? { pension: ov.pension } : {}), ...(ov.incomeTax != null ? { incomeTax: ov.incomeTax } : {}), ...(ov.finalPay != null ? { finalPay: ov.finalPay } : {}) } : payroll
    return { s, totals: mergedTotals, payroll: mergedPayroll, hasOverride: !!ov }
  }), [staff, shiftData, half, dayFromInPeriod, dayToInPeriod, manualOverrides])

  const grand = useMemo(() => rows.reduce((acc, { totals, payroll }) => ({
    totalHours:    acc.totalHours    + totals.totalHours,
    totalDays:     acc.totalDays     + totals.totalDays,
    totalPay:      acc.totalPay      + totals.totalPay,
    totalTransit:  acc.totalTransit  + totals.totalTransit,
    socialIns:     acc.socialIns     + payroll.socialIns,
    empIns:        acc.empIns        + payroll.empIns,
    pension:       acc.pension       + payroll.pension,
    incomeTax:     acc.incomeTax     + payroll.incomeTax,
    finalPay:      acc.finalPay      + payroll.finalPay,
  }), { totalHours:0, totalDays:0, totalPay:0, totalTransit:0, socialIns:0, empIns:0, pension:0, incomeTax:0, finalPay:0 }), [rows])

  const COLS = [
    { k: 'name',        label: 'STAFF',          w: 130, type: 'name' },
    { k: 'totalHours',  label: '総勤務時間',      w: 88,  type: 'hours' },
    { k: 'totalDays',   label: '総勤務日数',      w: 76,  type: 'days' },
    { k: 'totalPay',    label: '給与合計額',      w: 110, type: 'yen' },
    { k: 'totalTransit',label: '交通費合計額',    w: 100, type: 'yen' },
    { k: 'enroll',      label: '社会保険加入',    w: 90,  type: 'enroll' },
    { k: 'socialIns',   label: '社会保険料',      w: 96,  type: 'yen' },
    { k: 'empIns',      label: '雇用保険料',      w: 90,  type: 'yen' },
    { k: 'pension',     label: '厚生年金料',      w: 96,  type: 'yen' },
    { k: 'incomeTax',   label: '所得税',          w: 86,  type: 'yen' },
    { k: 'finalPay',    label: '合計振込予定額',  w: 120, type: 'yen' },
  ]

  return (
    <div className="mgr-page">
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <div>
          <div style={{ fontSize:11, color:'#94a3b8', marginBottom:4 }}>{monthLabel}</div>
          <h1 style={{ fontSize:22, fontWeight:700, color:'#0f172a', letterSpacing:'-0.01em', margin:0 }}>支出管理</h1>
          <p style={{ fontSize:12, color:'#64748b', marginTop:4, marginBottom:0 }}>シフト確定済みデータから算出。月・前半/後半/全月で集計を切り替えできます。</p>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
          {/* 月ナビゲーション */}
          <div style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 8px', background:'white', border:'1px solid #dde5f0', borderRadius:8 }}>
            <button onClick={prevMonth} style={{ background:'none', border:'none', cursor:'pointer', fontSize:14, color:'#475569', padding:'2px 6px' }} title="前月">←</button>
            <span style={{ fontSize:12, fontWeight:600, color:'#0f172a', minWidth:80, textAlign:'center' }}>{monthLabel}</span>
            <button onClick={nextMonth} style={{ background:'none', border:'none', cursor:'pointer', fontSize:14, color:'#475569', padding:'2px 6px' }} title="翌月">→</button>
          </div>
          {csvMsg && <span style={{ fontSize:12, color: csvMsg.startsWith('✓') ? '#10b981' : '#ef4444' }}>{csvMsg}</span>}
          <button onClick={() => setShowCsvModal(true)} style={{ padding:'7px 14px', borderRadius:8, border:'1px solid #dde5f0', background:'white', color:'#334155', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>CSV アップロード</button>
          <input ref={fileInputRef} type="file" accept=".csv" className="hidden"
            onChange={e => { setPendingCsvFile(e.target.files?.[0] || null); e.target.value = '' }} />
          {HALVES.map(h => (
            <button key={h.key} onClick={() => setHalf(h.key)} style={{
              padding:'7px 16px', borderRadius:20, fontSize:12, fontWeight: half === h.key ? 700 : 500,
              background: half === h.key ? '#4f46e5' : '#f0f5f9',
              color:      half === h.key ? 'white'   : '#475569',
              border:'none', cursor:'pointer', fontFamily:'inherit',
            }}>{h.label}</button>
          ))}
        </div>
      </div>

      <div className="mgr-card" style={{ marginBottom:16, padding:'14px 18px', display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:12 }}>
        {[
          { label:'対象人数',       value:`${rows.filter(r => r.totals.totalDays > 0).length}名` },
          { label:'給与合計',       value:yen(grand.totalPay) },
          { label:'交通費合計',     value:yen(grand.totalTransit) },
          { label:'控除合計',       value:yen(grand.socialIns + grand.empIns + grand.pension + grand.incomeTax) },
          { label:'振込予定総額',   value:yen(grand.finalPay), accent:true },
        ].map((k, i) => (
          <div key={i} style={{ background: k.accent ? '#eef2ff' : 'white', border:`1px solid ${k.accent ? '#c7d2fe' : '#e2e8f0'}`, borderRadius:8, padding:'10px 14px' }}>
            <div style={{ fontSize:11, color:'#64748b', marginBottom:4 }}>{k.label}</div>
            <div style={{ fontSize:16, fontWeight:700, color: k.accent ? '#3730a3' : '#0f172a' }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div className="mgr-card" style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5, fontFamily:'inherit' }}>
          <colgroup>
            {COLS.map(c => <col key={c.k} style={{ width:c.w }} />)}
          </colgroup>
          <thead>
            <tr style={{ background:'#e2e8f0', borderBottom:'1px solid #cbd5e1' }}>
              {COLS.map(c => (
                <th key={c.k} style={{ textAlign: c.k === 'name' ? 'left' : 'center', padding:'10px 12px', fontWeight:700, color:'#1e293b', fontSize:12.5, whiteSpace:'nowrap' }}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ s, totals, payroll, hasOverride }, idx) => (
              <tr key={s.id} style={{ borderBottom:'1px solid #f0f5f9', background: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                <td style={{ padding:'8px 12px', fontWeight:600, color:'#0f172a' }}>
                  {s.name}
                  {hasOverride && <span title="手動調整済み" style={{ fontSize:9, marginLeft:5, background:'#fef3c7', color:'#92400e', padding:'1px 4px', borderRadius:3, fontWeight:700 }}>手動</span>}
                </td>
                <td style={{ padding:'8px 12px', textAlign:'center', color:'#334155' }}>{totals.totalHours.toFixed(1)}h</td>
                <td style={{ padding:'8px 12px', textAlign:'center', color:'#334155' }}>{totals.totalDays}</td>
                <td style={{ padding:'8px 12px', textAlign:'right', fontWeight:600, color:'#0f172a' }}>{yen(totals.totalPay)}</td>
                <td style={{ padding:'8px 12px', textAlign:'right', color:'#334155' }}>{yen(totals.totalTransit)}</td>
                <td style={{ padding:'8px 12px', textAlign:'center' }}>
                  {payroll.enroll
                    ? <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:10, background:'#dcfce7', color:'#065f46' }}>ENTRY</span>
                    : <span style={{ fontSize:10, color:'#94a3b8' }}>—</span>}
                </td>
                <td style={{ padding:'8px 12px', textAlign:'right', color: payroll.socialIns ? '#dc2626' : '#cbd5e1' }}>{payroll.socialIns ? yen(payroll.socialIns) : '—'}</td>
                <td style={{ padding:'8px 12px', textAlign:'right', color: payroll.empIns    ? '#dc2626' : '#cbd5e1' }}>{payroll.empIns    ? yen(payroll.empIns)    : '—'}</td>
                <td style={{ padding:'8px 12px', textAlign:'right', color: payroll.pension   ? '#dc2626' : '#cbd5e1' }}>{payroll.pension   ? yen(payroll.pension)   : '—'}</td>
                <td style={{ padding:'8px 12px', textAlign:'right', color: payroll.incomeTax ? '#dc2626' : '#cbd5e1' }}>{payroll.incomeTax ? yen(payroll.incomeTax) : '—'}</td>
                <td style={{ padding:'8px 12px', textAlign:'right', fontWeight:700, color:'#3730a3', background:'#eef2ff' }}>{yen(payroll.finalPay)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background:'#94a3b8', color:'white' }}>
              <td style={{ padding:'10px 12px', fontWeight:700 }}>TOTAL</td>
              <td style={{ padding:'10px 12px', textAlign:'center', fontWeight:700 }}>{grand.totalHours.toFixed(1)}h</td>
              <td style={{ padding:'10px 12px', textAlign:'center', fontWeight:700 }}>{grand.totalDays}</td>
              <td style={{ padding:'10px 12px', textAlign:'right', fontWeight:700 }}>{yen(grand.totalPay)}</td>
              <td style={{ padding:'10px 12px', textAlign:'right', fontWeight:700 }}>{yen(grand.totalTransit)}</td>
              <td />
              <td style={{ padding:'10px 12px', textAlign:'right', fontWeight:700 }}>{yen(grand.socialIns)}</td>
              <td style={{ padding:'10px 12px', textAlign:'right', fontWeight:700 }}>{yen(grand.empIns)}</td>
              <td style={{ padding:'10px 12px', textAlign:'right', fontWeight:700 }}>{yen(grand.pension)}</td>
              <td style={{ padding:'10px 12px', textAlign:'right', fontWeight:700 }}>{yen(grand.incomeTax)}</td>
              <td style={{ padding:'10px 12px', textAlign:'right', fontWeight:700, background:'#1e293b' }}>{yen(grand.finalPay)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ── CSV Upload Modal ── */}
      {showCsvModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.45)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'white', borderRadius:16, width:'100%', maxWidth:520, boxShadow:'0 20px 60px rgba(15,23,42,0.18)' }}>
            <div style={{ padding:'20px 24px', borderBottom:'1px solid #e2e8f0', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div>
                <div style={{ fontSize:17, fontWeight:700, color:'#0f172a' }}>支出管理 CSV アップロード</div>
                <div style={{ fontSize:12, color:'#64748b', marginTop:3 }}>振込データのエクスポート/手動調整インポートができます</div>
              </div>
              <button onClick={() => setShowCsvModal(false)} style={{ fontSize:20, lineHeight:1, background:'none', border:'none', cursor:'pointer', color:'#94a3b8' }}>×</button>
            </div>
            <div style={{ padding:'20px 24px', display:'flex', flexDirection:'column', gap:18 }}>
              <div style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:12, padding:'14px 16px' }}>
                <div style={{ fontSize:13, fontWeight:600, color:'#334155', marginBottom:4 }}>① フォーマットをダウンロード</div>
                <div style={{ fontSize:11, color:'#64748b', marginBottom:4, lineHeight:1.6, wordBreak:'break-all' }}>
                  CSVの形式: <code style={{ background:'#e8edf4', padding:'1px 5px', borderRadius:4 }}>{PAYROLL_CSV_COLS.join(',')}</code>
                </div>
                <div style={{ fontSize:10.5, color:'#94a3b8', marginBottom:10, lineHeight:1.5 }}>
                  現在の計算結果をCSVでエクスポートします。<br />
                  アップロードすると数値を手動調整できます（スタッフ名で照合）。手動調整行には「手動」バッジが表示されます。
                </div>
                <button onClick={downloadPayrollCsv} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:8, border:'1px solid #4f46e5', background:'white', color:'#4f46e5', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                  ↓ フォーマットをダウンロード
                </button>
              </div>
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:'#334155', marginBottom:8 }}>② CSVファイルを選択</div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <button onClick={() => fileInputRef.current?.click()} style={{ padding:'8px 16px', borderRadius:8, border:'1px solid #dde5f0', background:'#f8fafc', color:'#475569', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
                    ファイルを選択
                  </button>
                  <span style={{ fontSize:12, color: pendingCsvFile ? '#0f172a' : '#94a3b8', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {pendingCsvFile ? pendingCsvFile.name : 'ファイルが選択されていません'}
                  </span>
                </div>
              </div>
              {Object.keys(manualOverrides).length > 0 && (
                <div style={{ fontSize:11.5, color:'#92400e', background:'#fef3c7', border:'1px solid #fde68a', borderRadius:8, padding:'8px 12px' }}>
                  現在 {Object.keys(manualOverrides).length}名分の手動調整データが適用中です。
                  <button onClick={() => { setManualOverrides({}); setCsvMsg('手動調整をリセットしました'); setTimeout(() => setCsvMsg(''), 2000) }}
                    style={{ marginLeft:8, fontSize:11, color:'#dc2626', background:'none', border:'none', cursor:'pointer', textDecoration:'underline', fontFamily:'inherit' }}>リセット</button>
                </div>
              )}
            </div>
            <div style={{ padding:'14px 24px', borderTop:'1px solid #e2e8f0', display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button onClick={() => { setShowCsvModal(false); setPendingCsvFile(null) }} style={{ padding:'9px 18px', borderRadius:8, border:'1px solid #dde5f0', background:'white', color:'#475569', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>キャンセル</button>
              <button onClick={executePayrollCsvUpload} disabled={!pendingCsvFile} style={{ padding:'9px 18px', borderRadius:8, border:'none', background: pendingCsvFile ? '#4f46e5' : '#c7d2fe', color:'white', fontSize:13, fontWeight:600, cursor: pendingCsvFile ? 'pointer' : 'not-allowed', fontFamily:'inherit' }}>アップロードを実行</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop:14, padding:'10px 16px', background:'white', border:'1px solid #dde5f0', borderRadius:8, fontSize:11, color:'#64748b', lineHeight:1.7 }}>
        <strong style={{ color:'#475569' }}>計算式:</strong> 給与 = 時給×労働 + 時給×{PAYROLL.overtimeMultiplier*100}%×超勤 + 時給×{PAYROLL.lateNightMultiplier*100}%×深夜 + 時給×{PAYROLL.lateNightOTMultiplier*100}%×残深 ／
        社会保険加入 = 月{PAYROLL.socialInsuranceThresholdHours}h以上 ／
        社保 {PAYROLL.rateSocialInsurance*100}% / 雇保 {PAYROLL.rateEmploymentInsurance*100}% / 厚年 {PAYROLL.ratePension*100}% / 所得税 {PAYROLL.rateIncomeTax*100}%（控除後ベース）
      </div>
    </div>
  )
}
