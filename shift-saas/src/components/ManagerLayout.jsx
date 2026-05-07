import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { STORE_NAME, YEAR_MONTH, allStores, managerNotifications } from '../data/mockData'

const NAV = [
  { to: '/manager',               label: 'ダッシュボード', icon: '◈', end: true  },
  { to: '/manager/targets',       label: '目標計画',       icon: '◎', end: false },
  { to: '/manager/shift',         label: 'シフト決定',     icon: '▦', end: false },
  { to: '/manager/members',       label: 'メンバー管理',   icon: '◉', end: false },
  { to: '/manager/payroll',       label: '月次振込予定',   icon: '¥', end: false },
  { to: '/manager/settings',      label: '店舗設定',       icon: '◌', end: false },
  { to: '/manager/notifications', label: '通知',           icon: '◍', end: false, badge: true },
]

const UNREAD = managerNotifications.filter(n => !n.read).length

const SIDEBAR = '#1e1b4b'
const SIDEBAR_ACTIVE = '#4f46e5'
const SIDEBAR_TEXT = '#a5b4fc'
const SIDEBAR_BORDER = 'rgba(255,255,255,0.08)'

export default function ManagerLayout() {
  const [showDrop, setShowDrop] = useState(false)
  const [activeStore, setActiveStore] = useState(allStores[0])

  return (
    <div style={{ display:'flex', height:'100vh', background:'#f0f5f9', overflow:'hidden' }}>

      {/* ── Sidebar ── */}
      <aside style={{ width:220, background:SIDEBAR, display:'flex', flexDirection:'column', flexShrink:0 }}>

        {/* Brand */}
        <div style={{ padding:'20px 16px 16px', borderBottom:`1px solid ${SIDEBAR_BORDER}` }}>
          <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.10em', textTransform:'uppercase', color:'#a5b4fc', marginBottom:6 }}>
            ShiftFlow
          </div>
          <div style={{ fontSize:14, fontWeight:700, color:'white', lineHeight:1.3, marginBottom:2 }}>
            Manager Portal
          </div>
          <div style={{ fontSize:11, color:SIDEBAR_TEXT }}>
            {STORE_NAME.split(' ').slice(0,2).join(' ')}
          </div>
          <div style={{ fontSize:10, color:'#a5b4fc', marginTop:1 }}>{YEAR_MONTH}</div>

          {/* Store selector */}
          <div style={{ marginTop:12, position:'relative' }}>
            <button
              onClick={() => setShowDrop(v => !v)}
              style={{
                width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between',
                background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.10)',
                borderRadius:8, padding:'7px 10px', color:'white', fontSize:12, fontWeight:600,
                cursor:'pointer', fontFamily:'inherit',
              }}
            >
              <span>{activeStore.name}</span>
              <span style={{ color:SIDEBAR_TEXT, fontSize:9 }}>▼</span>
            </button>
            {showDrop && (
              <div style={{
                position:'absolute', top:'calc(100% + 4px)', left:0, right:0,
                background:'white', borderRadius:10, boxShadow:'0 8px 24px rgba(0,0,0,0.18)',
                zIndex:50, overflow:'hidden',
              }}>
                {allStores.map(store => (
                  <button
                    key={store.id}
                    onClick={() => { if (store.status === 'active') { setActiveStore(store); setShowDrop(false) } }}
                    style={{
                      width:'100%', textAlign:'left', padding:'9px 12px', fontSize:12,
                      fontWeight: store.status === 'active' ? 600 : 400,
                      color: store.status === 'active' ? '#0f172a' : '#94a3b8',
                      background: activeStore.id === store.id ? '#eef2ff' : 'white',
                      cursor: store.status === 'active' ? 'pointer' : 'not-allowed',
                      border:'none', fontFamily:'inherit',
                      display:'flex', alignItems:'center', justifyContent:'space-between',
                    }}
                  >
                    <span>{store.name}</span>
                    {store.status === 'soon' && (
                      <span style={{ fontSize:10, background:'#f1f5f9', color:'#94a3b8', padding:'1px 5px', borderRadius:4 }}>準備中</span>
                    )}
                    {activeStore.id === store.id && store.status === 'active' && (
                      <span style={{ color:'#4f46e5', fontSize:11, fontWeight:700 }}>✓</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Nav items */}
        <nav style={{ flex:1, padding:'10px 8px', overflowY:'auto' }}>
          {NAV.map(({ to, label, icon, end, badge }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              style={({ isActive }) => ({
                display:'flex', alignItems:'center', gap:9,
                padding:'9px 12px', borderRadius:8, marginBottom:2,
                fontSize:13, fontWeight: isActive ? 600 : 400,
                color: isActive ? 'white' : SIDEBAR_TEXT,
                background: isActive ? SIDEBAR_ACTIVE : 'transparent',
                textDecoration:'none', transition:'background 0.12s, color 0.12s',
              })}
            >
              <span style={{ fontSize:14, lineHeight:1 }}>{icon}</span>
              <span style={{ flex:1 }}>{label}</span>
              {badge && UNREAD > 0 && (
                <span style={{
                  background:'#ef4444', color:'white', fontSize:10, fontWeight:700,
                  padding:'1px 5px', borderRadius:10, minWidth:18, textAlign:'center', lineHeight:'16px',
                }}>
                  {UNREAD}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div style={{ padding:'12px 16px', borderTop:`1px solid ${SIDEBAR_BORDER}` }}>
          <a href="/" style={{ fontSize:12, color:'#818cf8', textDecoration:'none', display:'flex', alignItems:'center', gap:5 }}>
            ← TOP に戻る
          </a>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="mgr-wrap" style={{ flex:1, overflowY:'auto' }} onClick={() => setShowDrop(false)}>
        <Outlet />
      </main>
    </div>
  )
}
