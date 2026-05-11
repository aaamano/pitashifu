import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { YEAR_MONTH, allStores, managerNotifications } from '../data/mockData'
import { LogoIcon } from './Logo'
import {
  IconDashboard, IconTarget, IconShift, IconStaff,
  IconPayroll, IconStore, IconBell,
} from './Icons'

const NAV = [
  { to: '/pitashif/manager',               label: 'ダッシュボード', Icon: IconDashboard, end: true  },
  { to: '/pitashif/manager/targets',       label: '目標計画',       Icon: IconTarget,    end: false },
  { to: '/pitashif/manager/shift',         label: 'シフト決定',     Icon: IconShift,     end: false },
  { to: '/pitashif/manager/members',       label: 'メンバー管理',   Icon: IconStaff,     end: false },
  { to: '/pitashif/manager/payroll',       label: '月次振込予定',   Icon: IconPayroll,   end: false },
  { to: '/pitashif/manager/settings',      label: '店舗設定',       Icon: IconStore,     end: false },
  { to: '/pitashif/manager/notifications', label: '通知',           Icon: IconBell,      end: false, badge: true },
]

const UNREAD = managerNotifications.filter(n => !n.read).length

const SIDEBAR_GRAD   = 'linear-gradient(180deg, #1E1B4B 0%, #231C58 60%, #2A2466 100%)'
const SIDEBAR_ACTIVE = '#4F46E5'
const SIDEBAR_TEXT   = '#C7D2FE'
const SIDEBAR_BORDER = 'rgba(255,255,255,0.08)'

export default function ManagerLayout() {
  const [showDrop,    setShowDrop]    = useState(false)
  const [activeStore, setActiveStore] = useState(allStores[0])

  return (
    <div style={{ display:'flex', height:'100vh', background:'#F8FAFC', overflow:'hidden' }}>

      {/* ── Sidebar ── */}
      <aside style={{ width:236, background:SIDEBAR_GRAD, display:'flex', flexDirection:'column', flexShrink:0, position:'relative' }}>
        {/* Subtle dot pattern overlay */}
        <div aria-hidden style={{
          position:'absolute', inset:0, opacity:0.06, pointerEvents:'none',
          backgroundImage:'radial-gradient(white 1px, transparent 1px)',
          backgroundSize:'14px 14px',
        }}/>

        {/* Brand */}
        <div style={{ padding:'22px 18px 18px', borderBottom:`1px solid ${SIDEBAR_BORDER}`, position:'relative' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
            <div style={{ background:'white', borderRadius:10, padding:5, display:'inline-flex', boxShadow:'0 4px 12px rgba(79,70,229,0.35)' }}>
              <LogoIcon size={26} />
            </div>
            <div style={{ display:'flex', flexDirection:'column', lineHeight:1.1 }}>
              <span style={{ fontSize:16, fontWeight:800, color:'white', letterSpacing:'0.01em' }}>ピタシフ</span>
              <span style={{ fontSize:9, fontWeight:500, color:'#A5B4FC', letterSpacing:'0.08em', marginTop:2 }}>MANAGER PORTAL</span>
            </div>
          </div>
          <div style={{ fontSize:10, color:'#A5B4FC', marginTop:4 }}>{YEAR_MONTH}</div>

          {/* Store selector */}
          <div style={{ marginTop:14, position:'relative' }}>
            <button
              onClick={() => setShowDrop(v => !v)}
              style={{
                width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between',
                background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.12)',
                borderRadius:9, padding:'8px 11px', color:'white', fontSize:12, fontWeight:600,
                cursor:'pointer', fontFamily:'inherit',
              }}
            >
              <span style={{ display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ width:6, height:6, borderRadius:'50%', background:'#10B981', flexShrink:0 }}/>
                {activeStore.name}
              </span>
              <span style={{ color:SIDEBAR_TEXT, fontSize:9 }}>▼</span>
            </button>
            {showDrop && (
              <div style={{
                position:'absolute', top:'calc(100% + 4px)', left:0, right:0,
                background:'white', borderRadius:10, boxShadow:'0 12px 28px rgba(0,0,0,0.22)',
                zIndex:50, overflow:'hidden',
              }}>
                {allStores.map(store => (
                  <button
                    key={store.id}
                    onClick={() => { if (store.status === 'active') { setActiveStore(store); setShowDrop(false) } }}
                    style={{
                      width:'100%', textAlign:'left', padding:'9px 12px', fontSize:12,
                      fontWeight: store.status === 'active' ? 600 : 400,
                      color: store.status === 'active' ? '#0F172A' : '#94A3B8',
                      background: activeStore.id === store.id ? 'var(--pita-indigo-soft)' : 'white',
                      cursor: store.status === 'active' ? 'pointer' : 'not-allowed',
                      border:'none', fontFamily:'inherit',
                      display:'flex', alignItems:'center', justifyContent:'space-between',
                    }}
                  >
                    <span>{store.name}</span>
                    {store.status === 'soon' && (
                      <span style={{ fontSize:10, background:'#F1F5F9', color:'#94A3B8', padding:'1px 6px', borderRadius:4 }}>準備中</span>
                    )}
                    {activeStore.id === store.id && store.status === 'active' && (
                      <span style={{ color:'var(--pita-indigo)', fontSize:11, fontWeight:700 }}>✓</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex:1, padding:'12px 10px', overflowY:'auto', position:'relative' }}>
          {NAV.map(({ to, label, Icon, end, badge }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              style={({ isActive }) => ({
                display:'flex', alignItems:'center', gap:11,
                padding:'10px 12px', borderRadius:9, marginBottom:3,
                fontSize:13, fontWeight: isActive ? 700 : 500,
                color: isActive ? 'white' : SIDEBAR_TEXT,
                background: isActive ? SIDEBAR_ACTIVE : 'transparent',
                textDecoration:'none', transition:'background .15s, color .15s',
                position:'relative',
              })}
            >
              <span style={{ display:'inline-flex', width:18, height:18, alignItems:'center', justifyContent:'center' }}>
                <Icon size={18} />
              </span>
              <span style={{ flex:1 }}>{label}</span>
              {badge && UNREAD > 0 && (
                <span style={{
                  background:'var(--pita-coral)', color:'white', fontSize:10, fontWeight:800,
                  padding:'1px 6px', borderRadius:10, minWidth:18, textAlign:'center', lineHeight:'15px',
                }}>
                  {UNREAD}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div style={{ padding:'14px 18px', borderTop:`1px solid ${SIDEBAR_BORDER}`, position:'relative' }}>
          <a href="/" style={{ fontSize:12, color:'#A5B4FC', textDecoration:'none', display:'flex', alignItems:'center', gap:6 }}>
            ← TOP に戻る
          </a>
          <div style={{ fontSize:10, color:'#6366F1', marginTop:6, opacity:0.7 }}>v1.1 — ピタシフ Build {__BUILD_TS__}</div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="mgr-wrap" style={{ flex:1, overflowY:'auto' }} onClick={() => setShowDrop(false)}>
        <Outlet />
      </main>
    </div>
  )
}
