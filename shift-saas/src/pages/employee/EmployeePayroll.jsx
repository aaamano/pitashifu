import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { STORE_NAME } from '../../data/mockData'
import EmployeeTabBar from '../../components/EmployeeTabBar'
import { useOrg } from '../../context/OrgContext'
import { useMe } from '../../hooks/useMe'
import * as versionsApi from '../../api/versions'
import * as shiftsApi from '../../api/shifts'

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

const INDIGO  = '#4F46E5'
const BORDER  = '#E2E8F0'
const GOAL_KEY = 'pitashif_monthly_goal'

function loadGoal()  { try { return parseInt(localStorage.getItem(GOAL_KEY)) || 300000 } catch { return 300000 } }
function saveGoal(v) { try { localStorage.setItem(GOAL_KEY, v) } catch {} }

function parseCode(code) {
  if (!code || code === 'X') return null
  if (code === 'F') return { start: 9, end: 18 }
  const m = code.match(/^O-(\d+(?:\.\d+)?)$/)
  if (m) return { start: 9, end: parseFloat(m[1]) }
  const m2 = code.match(/^(\d+(?:\.\d+)?)[.-](\d+(?:\.\d+)?|L)$/)
  if (m2) return { start: parseFloat(m2[1]), end: m2[2] === 'L' ? 22 : parseFloat(m2[2]) }
  return null
}
function shiftHours(code) {
  const t = parseCode(code)
  return t ? Math.max(0, t.end - t.start - 1) : 0
}
function fmtDuration(hours) {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  return `${h}h${String(m).padStart(2, '0')}m`
}

// Monthly totals は内部関数 (useMe/loadAssignments) のため、コンポーネント内で算出

// Circular gauge (270° arc, gap at bottom)
function GaugeArc({ value, max }) {
  const pct = Math.max(0, Math.min(1, value / max))
  const r   = 78
  const cx  = 100, cy = 100
  const circ     = 2 * Math.PI * r
  const trackLen = circ * 0.75
  const fillLen  = trackLen * pct
  return (
    <svg width={200} height={200} viewBox="0 0 200 200"
      style={{ transform: 'rotate(135deg)', display: 'block' }}>
      {/* track */}
      <circle cx={cx} cy={cy} r={r} fill="none"
        stroke="#EDEFF2" strokeWidth={13}
        strokeDasharray={`${trackLen} ${circ - trackLen}`}
        strokeLinecap="round" />
      {/* fill */}
      {pct > 0.01 && (
        <circle cx={cx} cy={cy} r={r} fill="none"
          stroke={INDIGO} strokeWidth={13}
          strokeDasharray={`${fillLen} ${circ - fillLen}`}
          strokeLinecap="round" />
      )}
    </svg>
  )
}

const pad = (n) => String(n).padStart(2, '0')

export default function EmployeePayroll({ base: baseProp, sukima = false }) {
  const { orgId } = useParams()
  const base = baseProp ?? `/${orgId}/employee`
  const { stores } = useOrg()
  const storeId = stores[0]?.id
  const { me } = useMe()
  const meDisp = me

  // 月選択
  const today = new Date()
  const [year,  setYear]  = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const monthLabel = `${year}年${month}月`
  const lastDayOfMonth = new Date(year, month, 0).getDate()
  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12) } else { setMonth(m => m - 1) }
  }
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1) } else { setMonth(m => m + 1) }
  }

  // 選択月のシフトを date 範囲でロード
  const [myShifts, setMyShifts] = useState([])
  useEffect(() => {
    if (!me || !storeId) { setMyShifts([]); return }
    let cancelled = false
    const dateFrom = `${year}-${pad(month)}-01`
    const dateTo   = `${year}-${pad(month)}-${pad(lastDayOfMonth)}`
    shiftsApi.loadShiftsByDateRange({ storeId, dateFrom, dateTo })
      .then(assigned => {
        if (cancelled) return
        const codes = Array.from({ length: lastDayOfMonth }, (_, i) => deriveDayCode(assigned?.[i + 1], me.id))
        setMyShifts(codes)
      })
      .catch(e => console.error('[EmployeePayroll.load]', e))
    return () => { cancelled = true }
  }, [me, storeId, year, month, lastDayOfMonth])
  const myShiftsDisp = myShifts.length ? myShifts : Array(lastDayOfMonth).fill('X')
  const workDays  = myShiftsDisp.filter(c => c && c !== 'X').length
  const workHours = myShiftsDisp.reduce((s, c) => s + shiftHours(c), 0)
  const estPay    = workHours * (meDisp?.wage ?? 1050)

  const [activeTab,   setActiveTab]   = useState('month')
  const [goal,        setGoal]        = useState(loadGoal)
  const [editingGoal, setEditingGoal] = useState(false)
  const [goalInput,   setGoalInput]   = useState(String(loadGoal()))

  const handleGoalSave = () => {
    const v = parseInt(goalInput.replace(/[^\d]/g, '')) || 0
    setGoal(v)
    saveGoal(v)
    setEditingGoal(false)
    setGoalInput(String(v))
  }

  return (
    <>
      {/* Header with month navigation */}
      <div className="pita-phone-header" style={{ justifyContent: 'space-between' }}>
        <button onClick={prevMonth} aria-label="前月"
          style={{ background:'none', border:'none', color:'#4F46E5', fontSize:18, fontWeight:700, cursor:'pointer', padding:'4px 10px' }}>‹</button>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#0F172A' }}>{monthLabel}</div>
        <button onClick={nextMonth} aria-label="翌月"
          style={{ background:'none', border:'none', color:'#4F46E5', fontSize:18, fontWeight:700, cursor:'pointer', padding:'4px 10px' }}>›</button>
      </div>

      {/* 月 / 年 tab switch */}
      <div style={{ display: 'flex', background: 'white', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
        {['month', 'year'].map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{
            flex: 1, padding: '10px 0', fontSize: 13, fontWeight: 600,
            background: 'none', border: 'none', cursor: 'pointer',
            color: activeTab === t ? INDIGO : '#94A3B8',
            borderBottom: activeTab === t ? `2px solid ${INDIGO}` : '2px solid transparent',
          }}>
            {t === 'month' ? '月' : '年'}
          </button>
        ))}
      </div>

      <div className="pita-phone-body">
        {activeTab === 'month' ? (
          <>
            {/* Goal row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '14px 16px 0' }}>
              {editingGoal ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, color: '#64748B' }}>月間目標 ¥</span>
                  <input
                    type="number" value={goalInput}
                    onChange={e => setGoalInput(e.target.value)}
                    style={{ width: 90, padding: '4px 8px', border: `1.5px solid ${INDIGO}`, borderRadius: 8, fontSize: 13, fontWeight: 600, outline: 'none', fontFamily: 'inherit' }}
                    autoFocus
                  />
                  <button onClick={handleGoalSave} style={{ padding: '4px 12px', background: INDIGO, color: 'white', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>保存</button>
                  <button onClick={() => setEditingGoal(false)} style={{ padding: '4px 10px', background: '#F1F5F9', color: '#64748B', border: 'none', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>×</button>
                </div>
              ) : (
                <button onClick={() => { setGoalInput(String(goal)); setEditingGoal(true) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', border: `1.5px solid ${BORDER}`, borderRadius: 20, background: 'white', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#0F172A' }}>
                  月間目標 ¥{goal.toLocaleString()}
                  <span style={{ fontSize: 11, color: INDIGO }}>✏️</span>
                </button>
              )}
            </div>

            {/* Gauge + arrows */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px 0 0', gap: 8 }}>
              <button style={{ width: 32, height: 32, borderRadius: '50%', border: `1px solid ${BORDER}`, background: 'white', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#64748B' }}>‹</button>

              <div style={{ position: 'relative', width: 200, height: 200 }}>
                <GaugeArc value={estPay} max={goal} />
                {/* Center label */}
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 4 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: INDIGO, display: 'inline-block', flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: '#64748B', fontWeight: 500 }}>給料見込</span>
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: '#0F172A', letterSpacing: '-0.5px', lineHeight: 1.1 }}>
                    ¥{estPay.toLocaleString()}
                  </div>
                </div>
              </div>

              <button style={{ width: 32, height: 32, borderRadius: '50%', border: `1px solid ${BORDER}`, background: 'white', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#64748B' }}>›</button>
            </div>

            {/* Stats row */}
            <div style={{ textAlign: 'center', fontSize: 15, color: '#0F172A', padding: '6px 16px 14px', fontWeight: 500 }}>
              勤務時間 <strong>{fmtDuration(workHours)}</strong>　給料見込 <strong>¥{estPay.toLocaleString()}</strong>
            </div>

            {/* Detail button */}
            <div style={{ padding: '0 16px 12px' }}>
              <button style={{
                width: '100%', padding: '13px 0', border: `1.5px solid ${BORDER}`, borderRadius: 10,
                background: 'white', fontSize: 13, fontWeight: 500, color: '#0F172A', cursor: 'pointer',
              }}>
                給料見込の対象期間・内訳を確認する
              </button>
            </div>

            {/* Breakdown table */}
            <div style={{ background: 'white', borderTop: `1px solid ${BORDER}` }}>
              {/* Column header */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px', padding: '8px 14px', borderBottom: `1px solid ${BORDER}` }}>
                <div />
                {['勤務時間', '給料見込', '給料実績'].map(h => (
                  <div key={h} style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, textAlign: 'right' }}>{h}</div>
                ))}
              </div>
              {/* Store row */}
              <div style={{ borderBottom: `1px solid ${BORDER}` }}>
                <div style={{ padding: '10px 14px 4px', fontSize: 12, fontWeight: 700, color: '#0F172A' }}>{STORE_NAME}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px', padding: '2px 14px 10px' }}>
                  <div />
                  <div style={{ fontSize: 13, color: '#0F172A', textAlign: 'right', fontWeight: 500 }}>{fmtDuration(workHours)}</div>
                  <div style={{ fontSize: 13, color: '#0F172A', textAlign: 'right', fontWeight: 500 }}>¥{estPay.toLocaleString()}</div>
                  <div style={{ fontSize: 12, color: '#94A3B8', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3 }}>
                    未入力 <span style={{ color: INDIGO, fontSize: 11 }}>✏️</span>
                  </div>
                </div>
              </div>
              {/* Total row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px', padding: '11px 14px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>合計</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', textAlign: 'right' }}>{fmtDuration(workHours)}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', textAlign: 'right' }}>¥{estPay.toLocaleString()}</div>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#94A3B8', textAlign: 'right' }}>¥—</div>
              </div>
            </div>

            <div style={{ height: 16 }} />
          </>
        ) : (
          /* 年 tab placeholder */
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 10, padding: '60px 24px' }}>
            <div style={{ fontSize: 36 }}>📊</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>年間集計</div>
            <div style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center', lineHeight: 1.6 }}>
              年間の給与データが<br />ここに表示されます
            </div>
          </div>
        )}
      </div>

      <EmployeeTabBar base={base} sukima={sukima} />
    </>
  )
}
