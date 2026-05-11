import { Link } from 'react-router-dom'
import { staff, daysConfig, YEAR_MONTH, shiftSubmissions } from '../../data/mockData'
import EmployeeTabBar from '../../components/EmployeeTabBar'

const ME = staff[0]
const HOURS = Array.from({ length: 15 }, (_, i) => i + 8)

// Demo: treat day 11 as "today" for 2026年4月
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

const STATUS = {
  confirmed: { label: '確定済み', cellBg: 'var(--pita-shift-work)', badgeBg: '#dcfce7', badgeColor: '#14532d' },
  submitted: { label: '提出済み', cellBg: '#818cf8',                badgeBg: '#eef0fe', badgeColor: '#3730a3' },
  draft:     { label: '下書き',   cellBg: '#fde68a',                badgeBg: '#fef3c7', badgeColor: '#92400e' },
}

const STATUS_PRIORITY = { confirmed: 0, submitted: 1, draft: 2 }
const latest = shiftSubmissions.slice().sort((a, b) => STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status])[0]

export default function Schedule({ base = '/pitashif/employee', sukima = false }) {
  const sub      = latest
  const cfg      = STATUS[sub?.status] || STATUS.draft
  const shiftRow = sub?.shiftRow || Array(15).fill('X')

  const workDays  = shiftRow.filter(c => c && c !== 'X').length
  const workHours = shiftRow.reduce((s, c) => {
    const t = parseCode(c); return t ? s + Math.max(0, t.end - t.start - 1) : s
  }, 0)

  return (
    <>
      <div className="pita-phone-header">
        <div style={{ width:32, height:32, borderRadius:'50%', background:'#5B67F8', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, flexShrink:0 }}>
          {ME.name[0]}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:14, fontWeight:700, color:'var(--pita-text)', lineHeight:1.2 }}>スケジュール</div>
          <div style={{ fontSize:10, color:'var(--pita-muted)', marginTop:1 }}>{YEAR_MONTH} 前半</div>
        </div>
        <span style={{ fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:10, background:cfg.badgeBg, color:cfg.badgeColor }}>
          {cfg.label}
        </span>
      </div>

      {/* Summary + CTA row */}
      <div className="pita-summary-row">
        <span>出勤 <strong>{workDays}日</strong></span>
        <span>{workHours}h</span>
        <span>想定 <strong>¥{(workHours * ME.wage).toLocaleString('ja-JP')}</strong></span>
        <Link
          to={`${base}/submit`}
          style={{ fontSize:10, color:'#5B67F8', fontWeight:700, textDecoration:'none', padding:'3px 10px', background:'#eef0fe', borderRadius:8, whiteSpace:'nowrap' }}
        >
          シフト提出 →
        </Link>
      </div>

      <div className="pita-phone-body">
        {/* Today indicator */}
        <div style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px 2px', fontSize:11, color:'#374151' }}>
          <span style={{ width:8, height:8, borderRadius:'50%', background:'#5B67F8', flexShrink:0, display:'inline-block' }} />
          今日は{TODAY_DAY}日です
        </div>

        <div style={{ overflowX:'auto' }}>
          <table className="pita-shift-grid" style={{ userSelect:'none' }}>
            <thead>
              <tr>
                <th className="pita-time-col">日</th>
                {HOURS.map(h => <th key={h}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {daysConfig.map((d, di) => {
                const shift   = parseCode(shiftRow[di])
                const isToday = d.day === TODAY_DAY
                return (
                  <tr key={d.day} style={{ background: isToday ? '#eff6ff' : undefined }}>
                    <td
                      className="pita-time-col"
                      style={{
                        color:      isToday ? '#5B67F8' : d.isWeekend ? '#dc2626' : 'var(--pita-text)',
                        fontWeight: isToday ? 700 : 400,
                        fontSize:   9,
                        background: isToday ? '#dbeafe' : undefined,
                      }}
                    >
                      {d.day}/{d.dow}
                      {isToday && <div style={{ fontSize:6, color:'#5B67F8', fontWeight:700 }}>今日</div>}
                    </td>
                    {HOURS.map(h => {
                      const inShift = shift && h >= shift.start && h < shift.end
                      return (
                        <td
                          key={h}
                          style={{
                            background: inShift ? cfg.cellBg : isToday ? '#eff6ff' : 'var(--pita-bg)',
                            cursor: 'default',
                          }}
                        />
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* CTA when no submission */}
        {!sub && (
          <div style={{ margin:'16px 12px', padding:'16px', background:'white', border:'1px solid #e5e7eb', borderRadius:12, textAlign:'center' }}>
            <div style={{ fontSize:13, fontWeight:600, color:'#374151', marginBottom:4 }}>シフトを提出しましょう</div>
            <div style={{ fontSize:11, color:'#6b7280', marginBottom:12 }}>まだ今月のシフトが提出されていません</div>
            <Link
              to={`${base}/submit`}
              style={{ display:'inline-block', padding:'10px 24px', borderRadius:8, background:'#5B67F8', color:'white', fontSize:12, fontWeight:700, textDecoration:'none' }}
            >
              シフトを作成する
            </Link>
          </div>
        )}
      </div>

      <EmployeeTabBar base={base} sukima={sukima} />
    </>
  )
}
