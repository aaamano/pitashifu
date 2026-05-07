import { useState, useMemo } from 'react'
import {
  staff, shiftData, daysConfig, YEAR_MONTH,
  decomposeShiftHours, calcDailyPay, calcMonthlyPayroll, parseShiftTimes, PAYROLL,
} from '../../data/mockData'

const HALVES = [
  { key: 'first',  label: '前半 (1〜15日)', from: 1,  to: 15 },
  { key: 'second', label: '後半 (16〜31日)', from: 16, to: 31 },
  { key: 'all',    label: '全月',            from: 1,  to: 31 },
]

function staffMonthlyTotals(staffMember, dayFrom, dayTo) {
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
  const [half, setHalf] = useState('first')
  const period = HALVES.find(h => h.key === half)

  const rows = useMemo(() => staff.map(s => {
    const totals = staffMonthlyTotals(s, period.from, period.to)
    const payroll = calcMonthlyPayroll(s, totals)
    return { s, totals, payroll }
  }), [half])

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
          <div style={{ fontSize:11, color:'#94a3b8', marginBottom:4 }}>{YEAR_MONTH}</div>
          <h1 style={{ fontSize:22, fontWeight:700, color:'#0f172a', letterSpacing:'-0.01em', margin:0 }}>月次振込予定</h1>
          <p style={{ fontSize:12, color:'#64748b', marginTop:4, marginBottom:0 }}>シフト確定済みデータから算出。前半/後半/全月で集計を切り替えできます。</p>
        </div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
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
            {rows.map(({ s, totals, payroll }, idx) => (
              <tr key={s.id} style={{ borderBottom:'1px solid #f0f5f9', background: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                <td style={{ padding:'8px 12px', fontWeight:600, color:'#0f172a' }}>{s.name}</td>
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

      <div style={{ marginTop:14, padding:'10px 16px', background:'white', border:'1px solid #dde5f0', borderRadius:8, fontSize:11, color:'#64748b', lineHeight:1.7 }}>
        <strong style={{ color:'#475569' }}>計算式:</strong> 給与 = 時給×労働 + 時給×{PAYROLL.overtimeMultiplier*100}%×超勤 + 時給×{PAYROLL.lateNightMultiplier*100}%×深夜 + 時給×{PAYROLL.lateNightOTMultiplier*100}%×残深 ／
        社会保険加入 = 月{PAYROLL.socialInsuranceThresholdHours}h以上 ／
        社保 {PAYROLL.rateSocialInsurance*100}% / 雇保 {PAYROLL.rateEmploymentInsurance*100}% / 厚年 {PAYROLL.ratePension*100}% / 所得税 {PAYROLL.rateIncomeTax*100}%（控除後ベース）
      </div>
    </div>
  )
}
