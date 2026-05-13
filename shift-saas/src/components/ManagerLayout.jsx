import { useState, useEffect } from 'react'
import { NavLink, Outlet, useParams } from 'react-router-dom'
import { YEAR_MONTH, allStores, managerNotifications } from '../data/mockData'
import { LogoIcon } from './Logo'
import {
  IconDashboard, IconTarget, IconShift, IconStaff,
  IconPayroll, IconStore, IconBell, IconImport, IconChat,
} from './Icons'

const NAV_ITEMS = [
  { suffix: '',               label: 'ダッシュボード', Icon: IconDashboard, end: true  },
  { suffix: '/targets',       label: '目標計画',       Icon: IconTarget,    end: false },
  { suffix: '/shift',         label: 'シフト管理',     Icon: IconShift,     end: false },
  { suffix: '/requests',      label: 'シフト希望提出', Icon: IconChat,      end: false },
  { suffix: '/members',       label: 'スタッフ管理',   Icon: IconStaff,     end: false },
  { suffix: '/import',        label: 'インポート',     Icon: IconImport,    end: false },
  { suffix: '/payroll',       label: '支出管理',       Icon: IconPayroll,   end: false },
  { suffix: '/settings',      label: '店舗設定',       Icon: IconStore,     end: false },
  { suffix: '/notifications', label: '通知',           Icon: IconBell,      end: false, badge: true },
]

const UNREAD = managerNotifications.filter(n => !n.read).length

const SIDEBAR_GRAD   = 'linear-gradient(180deg, #1E1B4B 0%, #231C58 60%, #2A2466 100%)'
const SIDEBAR_ACTIVE = '#4F46E5'
const SIDEBAR_TEXT   = '#C7D2FE'
const SIDEBAR_BORDER = 'rgba(255,255,255,0.08)'

const HamburgerIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <line x1="3" y1="6"  x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
)

export default function ManagerLayout() {
  const { orgId } = useParams()
  const base = `/${orgId}/manager`
  const NAV = NAV_ITEMS.map(item => ({ ...item, to: base + item.suffix }))

  const [showDrop,    setShowDrop]    = useState(false)
  const [activeStore, setActiveStore] = useState(allStores[0])
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMobile,    setIsMobile]    = useState(
    () => typeof window !== 'undefined' && window.innerWidth <= 768
  )

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    setIsMobile(mq.matches)
    const handler = (e) => { setIsMobile(e.matches); if (!e.matches) setSidebarOpen(false) }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const closeSidebar = () => setSidebarOpen(false)

  return (
    <div style={{ display:'flex', height:'100dvh', background:'#F8FAFC', overflow:'hidden' }}>

      {/* Mobile backdrop */}
      {isMobile && sidebarOpen && (
        <div
          onClick={closeSidebar}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.48)', zIndex:49 }}
        />
      )}

      {/* ── Sidebar ── */}
      <aside style={{
        width: 236,
        background: SIDEBAR_GRAD,
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        position:   isMobile ? 'fixed' : 'relative',
        top:        isMobile ? 0 : 'auto',
        left:       isMobile ? (sidebarOpen ? 0 : -260) : 'auto',
        height:     isMobile ? '100dvh' : '100vh',
        zIndex:     isMobile ? 50 : 'auto',
        transition: isMobile ? 'left 0.26s cubic-bezier(.4,0,.2,1)' : 'none',
        boxShadow:  isMobile && sidebarOpen ? '4px 0 28px rgba(0,0,0,0.30)' : 'none',
      }}>
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
            <div style={{ display:'flex', flexDirection:'column', lineHeight:1.1, flex:1 }}>
              <span style={{ fontSize:16, fontWeight:800, color:'white', letterSpacing:'0.01em' }}>ピタシフ</span>
              <span style={{ fontSize:9, fontWeight:500, color:'#A5B4FC', letterSpacing:'0.08em', marginTop:2 }}>MANAGER PORTAL</span>
            </div>
            {isMobile && (
              <button
                onClick={closeSidebar}
                aria-label="メニューを閉じる"
                style={{ background:'rgba(255,255,255,0.10)', border:'none', borderRadius:8, width:34, height:34, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'white', flexShrink:0, fontSize:16 }}
              >
                ✕
              </button>
            )}
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
                zIndex:60, overflow:'hidden',
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
              onClick={isMobile ? closeSidebar : undefined}
              style={({ isActive }) => ({
                display:'flex', alignItems:'center', gap:11,
                padding:'11px 12px', borderRadius:9, marginBottom:3,
                fontSize:13, fontWeight: isActive ? 700 : 500,
                color: isActive ? 'white' : SIDEBAR_TEXT,
                background: isActive ? SIDEBAR_ACTIVE : 'transparent',
                textDecoration:'none', transition:'background .15s, color .15s',
                position:'relative', minHeight:44,
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
      <main className="mgr-wrap" style={{ flex:1, overflowY:'auto', minWidth:0 }} onClick={() => setShowDrop(false)}>

        {/* Mobile top bar */}
        {isMobile && (
          <div style={{
            display:'flex', alignItems:'center', gap:12,
            padding:'10px 14px', background:'white',
            borderBottom:'1px solid #E2E8F0',
            position:'sticky', top:0, zIndex:30,
            boxShadow:'0 1px 4px rgba(15,23,42,0.06)',
          }}>
            <button
              onClick={(e) => { e.stopPropagation(); setSidebarOpen(true) }}
              aria-label="メニューを開く"
              style={{
                width:42, height:42, display:'flex', alignItems:'center', justifyContent:'center',
                background:'none', border:'1px solid #E2E8F0', borderRadius:10,
                cursor:'pointer', color:'#0F172A', flexShrink:0,
              }}
            >
              <HamburgerIcon />
            </button>
            <div style={{ background:'white', borderRadius:8, padding:4, display:'inline-flex', boxShadow:'0 2px 6px rgba(79,70,229,0.18)' }}>
              <LogoIcon size={20} />
            </div>
            <span style={{ fontSize:16, fontWeight:800, color:'#0F172A' }}>ピタシフ</span>
            {UNREAD > 0 && (
              <span style={{ marginLeft:'auto', background:'var(--pita-coral)', color:'white', fontSize:11, fontWeight:800, padding:'3px 10px', borderRadius:10 }}>
                通知 {UNREAD}
              </span>
            )}
          </div>
        )}

        <Outlet />
      </main>
    </div>
  )
}
