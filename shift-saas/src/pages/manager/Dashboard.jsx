import { useState, useEffect, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { staff as mockStaff, shiftData as mockShiftData, daysConfig, dailyTargets as mockDailyTargets, STORE_NAME, YEAR_MONTH, decomposeShiftHours, calcDailyPay } from '../../data/mockData'
import { useOrg } from '../../context/OrgContext'
import { loadTargets } from '../../api/targets'
import * as employeesApi from '../../api/employees'
import * as versionsApi from '../../api/versions'
import * as shiftsApi from '../../api/shifts'

const TARGET_YEAR  = 2026
const TARGET_MONTH = 4

// assigned[day][slot]=[empId,...] と empId から、その日の連続スロットを
// シフトコード ('F' / '9-18' / '13-L' / 'O-16' / 'X') に変換
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

// ── helpers ──────────────────────────────────────────────────────────────────
function parseShiftTimes(code) {
  if (!code || code === 'X') return null
  if (code === 'F') return { start: 9, end: 18 }
  const m = code.match(/^O-(\d+(?:\.\d+)?)$/)
  if (m) return { start: 9, end: parseFloat(m[1]) }
  const m2 = code.match(/^(\d+(?:\.\d+)?)[.-](\d+(?:\.\d+)?|L)$/)
  if (m2) return { start: parseFloat(m2[1]), end: m2[2] === 'L' ? 22 : parseFloat(m2[2]) }
  return null
}

function getBarProps(code) {
  if (!code || code === 'X') return null
  if (code === 'F') return { type: 'full', left: 2, width: 96 }
  const t = parseShiftTimes(code)
  if (!t) return null
  const left  = Math.max(2, ((t.start - 7) / 16) * 100)
  const width = Math.max(6, ((t.end - t.start) / 16) * 100)
  return { type: t.end >= 22 ? 'closer' : 'normal', left, width }
}

const ACTUAL_DAYS = 5

// ── component ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [view, setView] = useState('A')
  const [barTab, setBarTab] = useState('time')  // 'time' | 'cost'
  const { orgId } = useParams()
  const { stores } = useOrg()
  const storeId = stores[0]?.id
  const base = `/${orgId}/manager`

  // DB社員 & 最新version の assigned をロード
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
        // 最新の shift_version → assignments を取得
        const versions = await versionsApi.listVersions(storeId)
        if (cancelled || !versions?.length) return
        // 確定があればそれを優先、無ければ最新作成
        const target = versions.find(v => v.status === 'confirmed') || versions[0]
        const assigned = await shiftsApi.loadAssignments({ versionId: target.id })
        if (!cancelled) setDbAssigned(assigned ?? {})
      } catch (e) {
        console.error('[Dashboard.loadEmployeesShifts]', e)
      }
    })()
    return () => { cancelled = true }
  }, [orgId, storeId])

  // staff / shiftData を派生 (DBがあればDB優先、なければモック)
  const staff = useMemo(() => (dbEmployees.length ? dbEmployees : mockStaff), [dbEmployees])
  const shiftData = useMemo(() => {
    if (!dbEmployees.length) return mockShiftData
    const out = {}
    for (const emp of dbEmployees) {
      out[emp.id] = daysConfig.map(d => deriveDayCode(dbAssigned?.[d.day], emp.id))
    }
    return out
  }, [dbEmployees, dbAssigned])

  // mockData の flash を防ぐためスケルトン（値ゼロ）で初期化
  const skeleton = useMemo(() => mockDailyTargets.map(d => ({
    ...d, sales: 0, customers: 0, avgSpend: 0, orders: 0, laborCost: 0,
  })), [])
  const [dailyTargets, setDailyTargets] = useState(skeleton)
  useEffect(() => {
    if (!storeId) return
    let cancelled = false
    loadTargets({ storeId, year: TARGET_YEAR, month: TARGET_MONTH })
      .then(dbRows => {
        if (cancelled || dbRows.length === 0) return
        const byDay = Object.fromEntries(dbRows.map(r => [r.day, r]))
        setDailyTargets(prev => prev.map(d => byDay[d.day] ? { ...d, ...byDay[d.day] } : d))
      })
      .catch(e => console.error('[Dashboard.loadTargets]', e))
    return () => { cancelled = true }
  }, [storeId])

  const totalMonth  = useMemo(() => dailyTargets.reduce((s, d) => s + d.sales, 0), [dailyTargets])
  const totalCust   = useMemo(() => dailyTargets.reduce((s, d) => s + d.customers, 0), [dailyTargets])
  const totalOrders = useMemo(() => dailyTargets.reduce((s, d) => s + d.orders, 0), [dailyTargets])
  const avgUnit     = useMemo(() => Math.round(dailyTargets.reduce((s, d) => s + d.avgSpend, 0) / Math.max(1, dailyTargets.length)), [dailyTargets])
  const actualSales = useMemo(() => dailyTargets.slice(0, ACTUAL_DAYS).map(
    (d, i) => Math.round(d.sales * [1.02, 0.95, 1.08, 0.97, 1.05][i])
  ), [dailyTargets])

  return (
    <div className="mgr-page">

      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--pita-faint)', marginBottom: 4 }}>{STORE_NAME}</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--pita-text)', letterSpacing: '-0.01em' }}>{YEAR_MONTH} 前半 — ダッシュボード</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to={`${base}/targets`} className="mgr-btn-secondary" style={{ textDecoration: 'none' }}>
            目標設定 →
          </Link>
          <Link to={`${base}/shift`} className="mgr-btn-primary" style={{ textDecoration: 'none' }}>
            シフト決定 →
          </Link>
        </div>
      </div>

      {/* View toggle */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#e8edf4', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {[['A', '計画一覧 + バー'], ['B', 'ダッシュボード']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setView(key)}
            style={{
              padding: '6px 16px',
              borderRadius: 7,
              fontSize: 12,
              fontWeight: view === key ? 600 : 400,
              border: 'none',
              background: view === key ? 'white' : 'transparent',
              color: view === key ? 'var(--pita-text)' : 'var(--pita-muted)',
              cursor: 'pointer',
              fontFamily: 'inherit',
              boxShadow: view === key ? '0 1px 3px rgba(15,23,42,0.10)' : 'none',
              transition: 'all 0.15s',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── View A ──────────────────────────────────────────────────────────── */}
      {view === 'A' && (
        <>
          {/* KPI chips */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            {[
              { label: '売上合計', value: `¥${totalMonth.toLocaleString()}千` },
              { label: '客数',     value: `${totalCust.toLocaleString()}名` },
              { label: '客単価',   value: `¥${avgUnit.toLocaleString()}` },
              { label: 'スタッフ数', value: `${staff.length}名` },
            ].map((k, i) => (
              <div
                key={i}
                style={{
                  padding: '6px 14px',
                  borderRadius: 20,
                  fontSize: 12,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  background: '#eef2ff',
                  color: '#3730a3',
                  border: '1px solid #c7d2fe',
                }}
              >
                <span style={{ fontSize: 10, color: '#7ec8e3' }}>{k.label}</span>
                <span style={{ fontWeight: 700 }}>{k.value}</span>
              </div>
            ))}
          </div>

          {/* Plan table panel */}
          <div className="pita-panel" style={{ marginBottom: 16 }}>
            <div className="pita-panel-head">
              計画一覧 — {YEAR_MONTH}前半
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="pita-plan-table">
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>指標</th>
                    {daysConfig.map(d => (
                      <th
                        key={d.day}
                        className={d.dow === '土' ? 'pita-dow-sat' : d.dow === '日' ? 'pita-dow-sun' : ''}
                      >
                        {d.day}<br />
                        <span style={{ fontSize: 9 }}>{d.dow}</span>
                      </th>
                    ))}
                    <th className="total">合計</th>
                  </tr>
                </thead>
                <tbody>
                  {/* 売上目標 */}
                  <tr>
                    <th>売上目標 (千円)</th>
                    {dailyTargets.map(d => (
                      <td key={d.day}>{d.sales}</td>
                    ))}
                    <td className="total">{totalMonth.toLocaleString()}</td>
                  </tr>
                  <tr className="sub-row">
                    <td>└ 実績 (初日〜{ACTUAL_DAYS}日)</td>
                    {dailyTargets.map((d, i) => {
                      if (i >= ACTUAL_DAYS) return <td key={d.day}>—</td>
                      const act = actualSales[i]
                      const up  = act >= d.sales
                      return (
                        <td key={d.day}>
                          {act}
                          <span className={up ? 'pita-delta-up' : 'pita-delta-down'}>
                            {' '}{up ? '▲' : '▼'}
                          </span>
                        </td>
                      )
                    })}
                    <td>{actualSales.reduce((s, v) => s + v, 0)}</td>
                  </tr>

                  {/* 客数 */}
                  <tr>
                    <th>客数 (名)</th>
                    {dailyTargets.map(d => (
                      <td key={d.day}>{d.customers}</td>
                    ))}
                    <td className="total">{totalCust.toLocaleString()}</td>
                  </tr>
                  <tr className="sub-row">
                    <td>└ 実績 (初日〜{ACTUAL_DAYS}日)</td>
                    {dailyTargets.map((d, i) => {
                      if (i >= ACTUAL_DAYS) return <td key={d.day}>—</td>
                      const actC = Math.round(d.customers * [1.02, 0.95, 1.08, 0.97, 1.05][i])
                      const up   = actC >= d.customers
                      return (
                        <td key={d.day}>
                          {actC}
                          <span className={up ? 'pita-delta-up' : 'pita-delta-down'}>
                            {' '}{up ? '▲' : '▼'}
                          </span>
                        </td>
                      )
                    })}
                    <td>
                      {dailyTargets.slice(0, ACTUAL_DAYS).reduce((s, d, i) =>
                        s + Math.round(d.customers * [1.02, 0.95, 1.08, 0.97, 1.05][i]), 0
                      )}
                    </td>
                  </tr>

                  {/* 必要人時 */}
                  <tr>
                    <th>必要人時</th>
                    {dailyTargets.map(d => (
                      <td key={d.day}>{Math.ceil(d.orders / 8)}</td>
                    ))}
                    <td className="total">{Math.ceil(totalOrders / 8)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Shift bar panel (時間/費用 タブ) */}
          <div className="pita-panel">
            <div className="pita-panel-head" style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span>シフトバー — スタッフ別</span>
              <div style={{ display:'flex', gap:4, background:'#e8edf4', borderRadius:8, padding:3 }}>
                {[['time', '時間'], ['cost', '費用']].map(([k, l]) => (
                  <button key={k} onClick={() => setBarTab(k)} style={{
                    padding:'4px 14px', borderRadius:6, fontSize:11, fontWeight: barTab === k ? 700 : 500,
                    border:'none', cursor:'pointer', fontFamily:'inherit',
                    background: barTab === k ? 'white' : 'transparent',
                    color: barTab === k ? '#0f172a' : '#475569',
                    boxShadow: barTab === k ? '0 1px 3px rgba(15,23,42,0.10)' : 'none',
                  }}>{l}</button>
                ))}
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="pita-mgr-grid">
                <thead>
                  <tr>
                    <th className="name-col">スタッフ</th>
                    <th className="meta-col">種別</th>
                    <th className="meta-col">{barTab === 'time' ? '出勤日数' : '費用合計'}</th>
                    {daysConfig.map(d => (
                      <th
                        key={d.day}
                        className={d.dow === '土' ? 'pita-dow-sat' : d.dow === '日' ? 'pita-dow-sun' : ''}
                        style={{ minWidth: 52 }}
                      >
                        {d.day}<br />{d.dow}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {staff.map(s => {
                    const row      = shiftData[s.id] || []
                    // 各日の労働時間 + 費用を計算
                    const perDay = row.map(code => {
                      const t = parseShiftTimes(code)
                      if (!t) return { hasShift:false, hours:0, cost:0 }
                      const d = decomposeShiftHours(t.start, t.end)
                      const pay = calcDailyPay(s.wage ?? 1050, d.labor, d.overtime, d.lateNight, d.otLateNight)
                      const cost = Math.round(pay + (s.transitPerDay ?? 0))
                      return { hasShift:true, hours: d.labor, cost, code }
                    })
                    const workDays   = perDay.filter(p => p.hasShift).length
                    const totalHours = perDay.reduce((a, p) => a + p.hours, 0)
                    const totalCost  = perDay.reduce((a, p) => a + p.cost, 0)
                    return (
                      <tr key={s.id}>
                        <td className="name-col">
                          {s.name}
                          {(s.skills ?? []).slice(0, 2).map(sk => (
                            <span key={sk} className={sk === 'barista' ? 'pita-skill-barista' : sk === 'cashier' ? 'pita-skill-cashier' : 'pita-skill-floor'} style={{ marginLeft: 4 }}>
                              {sk === 'barista' ? 'バリスタ' : sk === 'cashier' ? 'レジ' : 'フロア'}
                            </span>
                          ))}
                        </td>
                        <td className="meta-col">
                          <span style={{
                            fontSize: 10,
                            padding: '1px 5px',
                            borderRadius: 3,
                            background: s.type === 'F' ? '#d1fae5' : 'var(--pita-bg-subtle)',
                            color:      s.type === 'F' ? '#065f46' : 'var(--pita-muted)',
                            fontWeight: 600,
                          }}>
                            {s.type === 'F' ? '正社員' : 'パート'}
                          </span>
                        </td>
                        <td className="meta-col" style={{ fontWeight:600 }}>
                          {barTab === 'time' ? `${workDays}日 / ${totalHours.toFixed(1)}h` : `¥${totalCost.toLocaleString()}`}
                        </td>
                        {daysConfig.map((d, di) => {
                          const p = perDay[di]
                          if (barTab === 'time') {
                            const code = row[di] || 'X'
                            const bar  = getBarProps(code)
                            if (!bar) return <td key={d.day} className="pita-cell-off-bar">×</td>
                            return (
                              <td key={d.day} className="pita-cell-bar">
                                <div className={'pita-bar ' + bar.type} style={{ left: bar.left + '%', width: bar.width + '%' }} />
                                <span className="pita-code">{code}</span>
                              </td>
                            )
                          }
                          // cost tab
                          if (!p?.hasShift) return <td key={d.day} className="pita-cell-off-bar">×</td>
                          return (
                            <td key={d.day} style={{ fontSize:9, fontFamily:'monospace', background:'#fff7ed', color:'#9a3412', textAlign:'right', padding:'2px 4px' }}>
                              ¥{p.cost.toLocaleString()}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                  {/* 合計行 (グランド合計 + 日別合計) */}
                  {staff.length > 0 && (() => {
                    // 日別合計
                    const perDay = daysConfig.map((_, di) => {
                      let hours = 0, cost = 0, count = 0
                      for (const s of staff) {
                        const row = shiftData[s.id] || []
                        const code = row[di]
                        const t = parseShiftTimes(code)
                        if (!t) continue
                        const d = decomposeShiftHours(t.start, t.end)
                        const pay = calcDailyPay(s.wage ?? 1050, d.labor, d.overtime, d.lateNight, d.otLateNight)
                        hours += d.labor
                        cost  += pay + (s.transitPerDay ?? 0)
                        count++
                      }
                      return { hours, cost, count }
                    })
                    const grand = perDay.reduce((acc, p) => ({
                      hours: acc.hours + p.hours,
                      cost:  acc.cost + p.cost,
                      days:  acc.days + p.count,
                    }), { hours:0, cost:0, days:0 })
                    return (
                      <tr style={{ background:'#eef0fe' }}>
                        <td className="name-col" style={{ fontWeight:700, color:'#3730a3' }}>合計</td>
                        <td className="meta-col" />
                        <td className="meta-col" style={{ fontWeight:700, color:'#3730a3' }}>
                          {barTab === 'time'
                            ? `${grand.hours.toFixed(1)}h`
                            : `¥${Math.round(grand.cost).toLocaleString()}`}
                        </td>
                        {perDay.map((p, i) => (
                          <td key={i} style={{ fontSize:9.5, fontFamily:'monospace', textAlign:'right', padding:'4px 4px', fontWeight:700, color:'#3730a3', background:'#eef0fe' }}>
                            {barTab === 'time'
                              ? (p.hours > 0 ? p.hours.toFixed(1) : '')
                              : (p.cost > 0 ? `¥${Math.round(p.cost).toLocaleString()}` : '')}
                          </td>
                        ))}
                      </tr>
                    )
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── View B ──────────────────────────────────────────────────────────── */}
      {view === 'B' && (
        <>
          {/* KPI cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: '前半 売上目標合計', value: `¥${totalMonth.toLocaleString()}千`, sub: '前年比 +3.2%',
                bg: '#eef2ff', border: '#c7d2fe', txt: '#3730a3' },
              { label: '前半 客数目標', value: `${totalCust.toLocaleString()}名`, sub: `1日平均 ${Math.round(totalCust / 15)}名`,
                bg: '#d1fae5', border: '#a7f3d0', txt: '#065f46' },
              { label: '平均客単価', value: `¥${avgUnit.toLocaleString()}`, sub: '目標 ¥3,000',
                bg: '#fef3c7', border: '#fde68a', txt: '#92400e' },
              { label: 'スタッフ数', value: `${staff.length}名`,
                sub: `正社員${staff.filter(s => s.type === 'F').length}名 / P${staff.filter(s => s.type === 'P').length}名`,
                bg: '#ede9fe', border: '#ddd6fe', txt: '#5b21b6' },
            ].map((k, i) => (
              <div key={i} style={{
                background: k.bg,
                border: `1px solid ${k.border}`,
                borderRadius: 12,
                padding: '16px 18px',
                boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
              }}>
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>{k.label}</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: k.txt, lineHeight: 1.2 }}>{k.value}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{k.sub}</div>
              </div>
            ))}
          </div>

          {/* Line chart */}
          <div className="pita-panel" style={{ marginBottom: 16 }}>
            <div className="pita-panel-head">
              売上実績 vs 計画（前半 {ACTUAL_DAYS}日間）
            </div>
            <div style={{ padding: '16px 20px' }}>
              <svg viewBox="0 0 300 140" width="100%" style={{ maxWidth: 600, display: 'block' }}>
                {/* Grid lines */}
                {[0, 1, 2, 3, 4].map(i => (
                  <line key={i} x1={0} y1={20 + i * 24} x2={300} y2={20 + i * 24}
                    stroke="var(--pita-border)" strokeWidth={0.5} />
                ))}

                {/* Axes labels */}
                {dailyTargets.slice(0, ACTUAL_DAYS).map((d, i) => {
                  const x = 30 + i * (260 / (ACTUAL_DAYS - 1))
                  return (
                    <text key={i} x={x} y={132} textAnchor="middle"
                      style={{ fontSize: 8, fill: 'var(--pita-muted)', fontFamily: 'var(--font-mono)' }}>
                      {d.day}日
                    </text>
                  )
                })}

                {/* Plan + actual lines */}
                {(() => {
                  const maxVal = Math.max(...dailyTargets.slice(0, ACTUAL_DAYS).map(d => d.sales), ...actualSales) * 1.1
                  const minVal = Math.min(...dailyTargets.slice(0, ACTUAL_DAYS).map(d => d.sales), ...actualSales) * 0.9
                  const toY = v => 20 + (1 - (v - minVal) / (maxVal - minVal)) * 96

                  const planPts = dailyTargets.slice(0, ACTUAL_DAYS).map((d, i) => {
                    const x = 30 + i * (260 / (ACTUAL_DAYS - 1))
                    return `${x},${toY(d.sales)}`
                  }).join(' ')

                  const actPts = actualSales.map((v, i) => {
                    const x = 30 + i * (260 / (ACTUAL_DAYS - 1))
                    return `${x},${toY(v)}`
                  }).join(' ')

                  return (
                    <>
                      <polyline points={planPts} fill="none" stroke="#a5b4fc" strokeWidth={1.5} strokeDasharray="4 2" />
                      <polyline points={actPts}  fill="none" stroke="#10b981" strokeWidth={2} />

                      {/* Dots – plan */}
                      {dailyTargets.slice(0, ACTUAL_DAYS).map((d, i) => {
                        const x = 30 + i * (260 / (ACTUAL_DAYS - 1))
                        return <circle key={i} cx={x} cy={toY(d.sales)} r={2.5}
                          fill="white" stroke="#a5b4fc" strokeWidth={1.5} />
                      })}
                      {/* Dots – actual */}
                      {actualSales.map((v, i) => {
                        const x = 30 + i * (260 / (ACTUAL_DAYS - 1))
                        return <circle key={i} cx={x} cy={toY(v)} r={2.5}
                          fill="white" stroke="#10b981" strokeWidth={2} />
                      })}
                    </>
                  )
                })()}
              </svg>

              {/* Legend */}
              <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#64748b' }}>
                  <svg width={20} height={4} viewBox="0 0 20 4">
                    <line x1={0} y1={2} x2={20} y2={2} stroke="#a5b4fc" strokeWidth={1.5} strokeDasharray="4 2" />
                  </svg>
                  計画
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#64748b' }}>
                  <svg width={20} height={4} viewBox="0 0 20 4">
                    <line x1={0} y1={2} x2={20} y2={2} stroke="#10b981" strokeWidth={2} />
                  </svg>
                  実績
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
