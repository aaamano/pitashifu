import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { staff, daysConfig, YEAR_MONTH, shiftData } from '../../data/mockData'
import EmployeeTabBar from '../../components/EmployeeTabBar'

const ME = staff[0]
const MY_SHIFTS = shiftData[ME.id] // 30-day array

const INDIGO = '#4F46E5'
const CORAL  = '#FF6B6B'
const BORDER = '#E2E8F0'
const TODAY_DAY = 11

function parseCode(code) {
  if (!code || code === 'X') return null
  if (code === 'F') return { start: 9, end: 18 }
  const m = code.match(/^O-(\d+(?:\.\d+)?)$/)
  if (m) return { start: 9, end: parseFloat(m[1]) }
  const m2 = code.match(/^(\d+(?:\.\d+)?)[.-](\d+(?:\.\d+)?|L)$/)
  if (m2) return { start: parseFloat(m2[1]), end: m2[2] === 'L' ? 22 : parseFloat(m2[2]) }
  return null
}

function fmtH(h) {
  const hh = Math.floor(h)
  const mm = Math.round((h - hh) * 60)
  return `${hh}:${mm === 0 ? '00' : String(mm).padStart(2, '0')}`
}

function shiftLabel(code) {
  const t = parseCode(code)
  if (!t) return null
  return `${fmtH(t.start)}〜${fmtH(t.end)}`
}

function shiftHours(code) {
  const t = parseCode(code)
  if (!t) return 0
  return Math.max(0, t.end - t.start - 1) // deduct 1h break for shifts >= something
}

const DOW_LABEL = ['月','火','水','木','金','土','日']

export default function Schedule({ base = '/pitashif/employee', sukima = false }) {
  const [selectedDay, setSelectedDay] = useState(TODAY_DAY)
  const stripRef = useRef(null)

  // Scroll selected day into center on mount and change
  useEffect(() => {
    const el = stripRef.current
    if (!el) return
    const btn = el.querySelector(`[data-day="${selectedDay}"]`)
    if (!btn) return
    const btnLeft = btn.offsetLeft
    const btnWidth = btn.offsetWidth
    const stripWidth = el.offsetWidth
    el.scrollTo({ left: btnLeft - (stripWidth / 2) + (btnWidth / 2), behavior: 'smooth' })
  }, [selectedDay])

  // Monthly stats
  const workDays  = MY_SHIFTS.filter(c => c && c !== 'X').length
  const workHours = MY_SHIFTS.reduce((s, c) => s + shiftHours(c), 0)
  const estPay    = workHours * ME.wage

  // Selected day info
  const selCfg   = daysConfig[selectedDay - 1]
  const selCode  = MY_SHIFTS[selectedDay - 1]
  const selShift = parseCode(selCode)

  // Upcoming shifts from today
  const upcomingShifts = daysConfig
    .filter(d => d.day >= TODAY_DAY && MY_SHIFTS[d.day - 1] !== 'X' && MY_SHIFTS[d.day - 1])
    .slice(0, 5)

  return (
    <>
      {/* Header */}
      <div className="pita-phone-header">
        <div style={{
          width: 34, height: 34, borderRadius: '50%',
          background: INDIGO, color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 700, flexShrink: 0,
        }}>
          {ME.name[0]}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', lineHeight: 1.2 }}>スケジュール</div>
          <div style={{ fontSize: 10, color: '#64748B', marginTop: 1 }}>{ME.name}さん</div>
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, color: INDIGO }}>{YEAR_MONTH}</div>
      </div>

      <div className="pita-phone-body">

        {/* Monthly summary cards */}
        <div style={{ display: 'flex', gap: 8, padding: '12px 14px 0', flexShrink: 0 }}>
          {[
            { label: '出勤日数', value: `${workDays}日` },
            { label: '勤務時間', value: `${workHours}h` },
            { label: '想定収入', value: `¥${estPay.toLocaleString()}` },
          ].map(({ label, value }) => (
            <div key={label} style={{
              flex: 1, background: 'white', border: `1px solid ${BORDER}`,
              borderRadius: 10, padding: '10px 8px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 9, color: '#64748B', marginBottom: 4, fontWeight: 500 }}>{label}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Calendar date strip */}
        <div
          ref={stripRef}
          style={{
            display: 'flex', gap: 6, padding: '14px 14px 4px',
            overflowX: 'auto', flexShrink: 0,
            scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch',
          }}
        >
          {daysConfig.map(d => {
            const hasShift = MY_SHIFTS[d.day - 1] && MY_SHIFTS[d.day - 1] !== 'X'
            const isToday  = d.day === TODAY_DAY
            const isSel    = d.day === selectedDay
            const isWkend  = d.isWeekend
            return (
              <button
                key={d.day}
                data-day={d.day}
                onClick={() => setSelectedDay(d.day)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                  padding: '6px 0', minWidth: 38, borderRadius: 10, border: 'none',
                  cursor: 'pointer', flexShrink: 0,
                  background: isSel ? INDIGO : isToday ? '#EEF0FE' : 'transparent',
                }}
              >
                <span style={{
                  fontSize: 9, fontWeight: 600,
                  color: isSel ? 'rgba(255,255,255,0.8)' : isWkend ? CORAL : '#64748B',
                }}>
                  {d.dow}
                </span>
                <span style={{
                  fontSize: 15, fontWeight: 700,
                  color: isSel ? 'white' : isToday ? INDIGO : isWkend ? CORAL : '#0F172A',
                  lineHeight: 1,
                }}>
                  {d.day}
                </span>
                <span style={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: hasShift
                    ? (isSel ? 'rgba(255,255,255,0.6)' : INDIGO)
                    : 'transparent',
                }} />
              </button>
            )
          })}
        </div>

        {/* Selected day shift card */}
        <div style={{ padding: '8px 14px', flexShrink: 0 }}>
          <div style={{
            background: 'white', border: `1px solid ${BORDER}`, borderRadius: 14,
            overflow: 'hidden',
          }}>
            {/* Card header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 14px 10px',
              borderBottom: selShift ? `1px solid ${BORDER}` : 'none',
            }}>
              <div>
                <div style={{ fontSize: 12, color: '#64748B', fontWeight: 500 }}>
                  {selCfg?.dow}曜日
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#0F172A' }}>
                  4月{selectedDay}日
                  {selectedDay === TODAY_DAY && (
                    <span style={{
                      marginLeft: 8, fontSize: 10, fontWeight: 700,
                      color: INDIGO, background: '#EEF0FE',
                      padding: '2px 8px', borderRadius: 6,
                    }}>今日</span>
                  )}
                </div>
              </div>
              {selShift ? (
                <div style={{
                  fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 20,
                  background: '#DCFCE7', color: '#065F46',
                }}>確定済み</div>
              ) : (
                <div style={{
                  fontSize: 10, fontWeight: 600, padding: '4px 10px', borderRadius: 20,
                  background: '#F1F5F9', color: '#94A3B8',
                }}>お休み</div>
              )}
            </div>

            {selShift ? (
              <div style={{ padding: '14px 14px 12px' }}>
                {/* Time bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color: INDIGO, lineHeight: 1 }}>{fmtH(selShift.start)}</div>
                    <div style={{ fontSize: 9, color: '#94A3B8', marginTop: 2 }}>開始</div>
                  </div>
                  <div style={{ flex: 1, position: 'relative', height: 6, background: '#EEF0FE', borderRadius: 3 }}>
                    <div style={{ position: 'absolute', inset: 0, background: INDIGO, borderRadius: 3 }} />
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color: INDIGO, lineHeight: 1 }}>{fmtH(selShift.end)}</div>
                    <div style={{ fontSize: 9, color: '#94A3B8', marginTop: 2 }}>終了</div>
                  </div>
                </div>
                {/* Details row */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1, background: '#F8FAFC', borderRadius: 8, padding: '8px 10px' }}>
                    <div style={{ fontSize: 9, color: '#94A3B8', marginBottom: 2 }}>勤務時間</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{selShift.end - selShift.start}時間</div>
                  </div>
                  <div style={{ flex: 1, background: '#F8FAFC', borderRadius: 8, padding: '8px 10px' }}>
                    <div style={{ fontSize: 9, color: '#94A3B8', marginBottom: 2 }}>想定報酬</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>
                      ¥{((selShift.end - selShift.start - 1) * ME.wage).toLocaleString()}
                    </div>
                  </div>
                  <div style={{ flex: 1, background: '#F8FAFC', borderRadius: 8, padding: '8px 10px' }}>
                    <div style={{ fontSize: 9, color: '#94A3B8', marginBottom: 2 }}>時給</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>¥{ME.wage.toLocaleString()}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ padding: '20px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>🌙</div>
                <div style={{ fontSize: 13, color: '#94A3B8', fontWeight: 500 }}>シフトなし</div>
              </div>
            )}
          </div>
        </div>

        {/* Upcoming shifts */}
        <div style={{ padding: '4px 14px 0', flexShrink: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', letterSpacing: '0.04em', marginBottom: 8 }}>
            直近のシフト
          </div>
          <div style={{ background: 'white', border: `1px solid ${BORDER}`, borderRadius: 14, overflow: 'hidden' }}>
            {upcomingShifts.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', fontSize: 12, color: '#94A3B8' }}>
                直近のシフトはありません
              </div>
            ) : (
              upcomingShifts.map((d, idx) => {
                const code  = MY_SHIFTS[d.day - 1]
                const label = shiftLabel(code)
                const isToday = d.day === TODAY_DAY
                return (
                  <button
                    key={d.day}
                    onClick={() => setSelectedDay(d.day)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                      padding: '12px 14px', background: 'none', border: 'none',
                      borderBottom: idx < upcomingShifts.length - 1 ? `1px solid ${BORDER}` : 'none',
                      cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    {/* Date badge */}
                    <div style={{
                      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                      background: isToday ? INDIGO : '#F1F5F9',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0,
                    }}>
                      <span style={{ fontSize: 8, fontWeight: 600, color: isToday ? 'rgba(255,255,255,0.7)' : '#94A3B8', lineHeight: 1 }}>{d.dow}</span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: isToday ? 'white' : '#0F172A', lineHeight: 1 }}>{d.day}</span>
                    </div>
                    {/* Shift info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>{label}</div>
                      <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 1 }}>
                        {(shiftHours(code)).toFixed(0)}時間 · ¥{(shiftHours(code) * ME.wage).toLocaleString()}
                      </div>
                    </div>
                    {/* Status */}
                    <div style={{
                      fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 20,
                      background: '#DCFCE7', color: '#065F46', flexShrink: 0,
                    }}>確定済み</div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Shift submit CTA */}
        <div style={{ padding: '12px 14px 4px', flexShrink: 0 }}>
          <Link
            to={`${base}/submit`}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 16px', background: INDIGO, borderRadius: 12, textDecoration: 'none',
              boxShadow: '0 4px 12px rgba(79,70,229,0.28)',
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>シフトを提出する</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>5月前半の締め切り: 4月23日</div>
            </div>
            <span style={{ fontSize: 18, color: 'white', fontWeight: 700 }}>→</span>
          </Link>
        </div>

        <div style={{ height: 16 }} />
      </div>

      <EmployeeTabBar base={base} sukima={sukima} />
    </>
  )
}
