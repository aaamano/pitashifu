import { useState } from 'react'
import { Link } from 'react-router-dom'
import { staff, daysConfig, YEAR_MONTH, shiftData } from '../../data/mockData'
import EmployeeTabBar from '../../components/EmployeeTabBar'

const ME = staff[0]
const MY_SHIFTS = shiftData[ME.id]

const INDIGO = '#4F46E5'
const CORAL  = '#FF6B6B'
const BORDER = '#E2E8F0'
const TODAY_DAY = 11

// April 2026: April 1 = 水 = index 3 in 日(0)月(1)火(2)水(3)木(4)金(5)土(6)
const FIRST_DOW = 3
const DOW_HEADERS = ['日', '月', '火', '水', '木', '金', '土']
// 土=6, 日=0
const isWeekendDow = dow => dow === 0 || dow === 6

// Build calendar cells: nulls for padding + day numbers 1-30
const calCells = [
  ...Array(FIRST_DOW).fill(null),
  ...Array.from({ length: 30 }, (_, i) => i + 1),
]
while (calCells.length % 7 !== 0) calCells.push(null)

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

function shiftHours(code) {
  const t = parseCode(code)
  if (!t) return 0
  return Math.max(0, t.end - t.start - 1)
}

export default function Schedule({ base = '/pitashif/employee', sukima = false }) {
  const [selectedDay, setSelectedDay] = useState(TODAY_DAY)

  const workDays  = MY_SHIFTS.filter(c => c && c !== 'X').length
  const workHours = MY_SHIFTS.reduce((s, c) => s + shiftHours(c), 0)
  const estPay    = workHours * ME.wage

  const selCode  = MY_SHIFTS[selectedDay - 1]
  const selShift = parseCode(selCode)
  const selDow   = daysConfig[selectedDay - 1]?.dow

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

        {/* Monthly summary */}
        <div style={{ display: 'flex', gap: 8, padding: '12px 12px 0', flexShrink: 0 }}>
          {[
            { label: '出勤日数', value: `${workDays}日` },
            { label: '勤務時間', value: `${workHours}h` },
            { label: '想定収入', value: `¥${estPay.toLocaleString()}` },
          ].map(({ label, value }) => (
            <div key={label} style={{
              flex: 1, background: 'white', border: `1px solid ${BORDER}`,
              borderRadius: 10, padding: '9px 6px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 9, color: '#64748B', marginBottom: 3, fontWeight: 500 }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A' }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Calendar */}
        <div style={{ padding: '12px 12px 0' }}>
          <div style={{ background: 'white', border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden' }}>
            {/* Day-of-week header */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: `1px solid ${BORDER}` }}>
              {DOW_HEADERS.map((d, i) => (
                <div key={d} style={{
                  textAlign: 'center', fontSize: 10, fontWeight: 700, padding: '7px 0',
                  color: i === 0 ? CORAL : i === 6 ? '#3B82F6' : '#64748B',
                }}>
                  {d}
                </div>
              ))}
            </div>
            {/* Calendar grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
              {calCells.map((day, idx) => {
                if (!day) return <div key={`e${idx}`} style={{ aspectRatio: '1', borderRight: idx % 7 < 6 ? `1px solid ${BORDER}` : 'none', borderBottom: `1px solid ${BORDER}` }} />
                const code    = MY_SHIFTS[day - 1]
                const shift   = parseCode(code)
                const isToday = day === TODAY_DAY
                const isSel   = day === selectedDay
                const dowIdx  = (idx) % 7
                const isSun   = dowIdx === 0
                const isSat   = dowIdx === 6
                const OPEN_H  = 9   // chart span start
                const SPAN    = 14  // hours displayed (9-23)
                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDay(day)}
                    style={{
                      aspectRatio: '1', display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'flex-start', padding: '5px 2px 2px',
                      background: isSel ? INDIGO : isToday ? '#EEF0FE' : 'transparent',
                      border: 'none',
                      borderRight: idx % 7 < 6 ? `1px solid ${BORDER}` : 'none',
                      borderBottom: `1px solid ${BORDER}`,
                      cursor: 'pointer', position: 'relative', overflow: 'hidden',
                      gap: 2,
                    }}
                  >
                    <span style={{
                      fontSize: 12, fontWeight: isToday || isSel ? 800 : 400, lineHeight: 1,
                      color: isSel ? 'white' : isToday ? INDIGO : isSun ? CORAL : isSat ? '#3B82F6' : '#0F172A',
                    }}>
                      {day}
                    </span>
                    {shift && (
                      <div style={{
                        width: '80%', height: 4, borderRadius: 2,
                        background: isSel ? 'rgba(255,255,255,0.7)' : INDIGO,
                        flexShrink: 0,
                      }} />
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Selected day detail */}
        <div style={{ padding: '10px 12px 0' }}>
          <div style={{
            background: 'white', border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '11px 14px', borderBottom: selShift ? `1px solid ${BORDER}` : 'none',
            }}>
              <div>
                <div style={{ fontSize: 11, color: '#64748B', fontWeight: 500 }}>{selDow}曜日</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', marginTop: 1 }}>
                  4月{selectedDay}日
                  {selectedDay === TODAY_DAY && (
                    <span style={{ marginLeft: 7, fontSize: 10, fontWeight: 700, color: INDIGO, background: '#EEF0FE', padding: '2px 7px', borderRadius: 5 }}>今日</span>
                  )}
                </div>
              </div>
              {selShift ? (
                <span style={{ fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: '#DCFCE7', color: '#065F46' }}>確定済み</span>
              ) : (
                <span style={{ fontSize: 10, fontWeight: 600, padding: '4px 10px', borderRadius: 20, background: '#F1F5F9', color: '#94A3B8' }}>お休み</span>
              )}
            </div>
            {selShift ? (
              <div style={{ padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 900, color: INDIGO, lineHeight: 1 }}>{fmtH(selShift.start)}</div>
                    <div style={{ fontSize: 9, color: '#94A3B8', marginTop: 2 }}>開始</div>
                  </div>
                  <div style={{ flex: 1, height: 5, background: '#EEF0FE', borderRadius: 3, position: 'relative' }}>
                    <div style={{ position: 'absolute', inset: 0, background: INDIGO, borderRadius: 3 }} />
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 900, color: INDIGO, lineHeight: 1 }}>{fmtH(selShift.end)}</div>
                    <div style={{ fontSize: 9, color: '#94A3B8', marginTop: 2 }}>終了</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[
                    { l: '勤務時間', v: `${selShift.end - selShift.start}時間` },
                    { l: '想定報酬', v: `¥${((selShift.end - selShift.start - 1) * ME.wage).toLocaleString()}` },
                    { l: '時給',     v: `¥${ME.wage.toLocaleString()}` },
                  ].map(({ l, v }) => (
                    <div key={l} style={{ flex: 1, background: '#F8FAFC', borderRadius: 8, padding: '7px 8px' }}>
                      <div style={{ fontSize: 9, color: '#94A3B8', marginBottom: 2 }}>{l}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A' }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ padding: '16px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, marginBottom: 4 }}>🌙</div>
                <div style={{ fontSize: 12, color: '#94A3B8', fontWeight: 500 }}>シフトなし</div>
              </div>
            )}
          </div>
        </div>

        {/* Shift manage CTA */}
        <div style={{ padding: '10px 12px 4px' }}>
          <Link
            to={`${base}/submit`}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '13px 16px', background: INDIGO, borderRadius: 12, textDecoration: 'none',
              boxShadow: '0 4px 12px rgba(79,70,229,0.28)',
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>シフトを管理する</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>5月前半の締め切り: 4月23日</div>
            </div>
            <span style={{ fontSize: 18, color: 'white', fontWeight: 700 }}>→</span>
          </Link>
        </div>

        <div style={{ height: 8 }} />
      </div>

      <EmployeeTabBar base={base} sukima={sukima} />
    </>
  )
}
