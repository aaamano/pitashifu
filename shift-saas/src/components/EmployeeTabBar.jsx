import { Link, useLocation } from 'react-router-dom'
import { employeeNotifications } from '../data/mockData'

const UNREAD = employeeNotifications.filter(n => !n.read).length
const C    = '#5B67F8'
const GRAY = '#9CA3AF'

const IconCal = ({ on }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={on ? C : GRAY} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2.5"/>
    <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
    <circle cx="8" cy="15" r="1" fill={on ? C : GRAY} stroke="none"/>
    <circle cx="12" cy="15" r="1" fill={on ? C : GRAY} stroke="none"/>
  </svg>
)
const IconFile = ({ on }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={on ? C : GRAY} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/>
  </svg>
)
const IconBolt = ({ on }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill={on ? C : GRAY} stroke="none">
    <path d="M13 2L3 14h9l-1 8 10-12h-9z"/>
  </svg>
)
const IconBell = ({ on }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={on ? C : GRAY} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
)

export default function EmployeeTabBar({ base = '/pitashif/employee', sukima = false }) {
  const { pathname } = useLocation()

  const getActive = () => {
    if (pathname.includes('/submit'))        return 'submit'
    if (pathname.includes('/sukima'))        return 'sukima'
    if (pathname.includes('/notifications')) return 'notifications'
    return 'schedule'
  }
  const active = getActive()

  const tabs = [
    { id:'schedule',      to: base,                    label:'スケジュール', Icon: IconCal  },
    { id:'submit',        to: `${base}/submit`,        label:'シフト提出',   Icon: IconFile },
    ...(sukima ? [{ id:'sukima', to:`${base}/sukima`, label:'スキマ', Icon: IconBolt }] : []),
    { id:'notifications', to: `${base}/notifications`, label:'通知',         Icon: IconBell },
  ]

  return (
    <div style={{ display:'flex', background:'white', borderTop:'1px solid #F3F4F6', flexShrink:0, paddingBottom:6 }}>
      {tabs.map(({ id, to, label, Icon }) => {
        const on = active === id
        const hasUnread = id === 'notifications' && UNREAD > 0
        return (
          <Link
            key={id}
            to={to}
            style={{
              flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
              gap:2, padding:'8px 4px 4px', textDecoration:'none', position:'relative',
              borderTop: on ? `2px solid ${C}` : '2px solid transparent',
            }}
          >
            <div style={{ position:'relative' }}>
              <Icon on={on} />
              {hasUnread && <span style={{ position:'absolute', top:-1, right:-2, width:7, height:7, background:'#EF4444', borderRadius:'50%', border:'1.5px solid white' }} />}
            </div>
            <span style={{ fontSize:9, fontWeight: on ? 700 : 400, color: on ? C : GRAY, letterSpacing:'-0.01em' }}>{label}</span>
          </Link>
        )
      })}
    </div>
  )
}
