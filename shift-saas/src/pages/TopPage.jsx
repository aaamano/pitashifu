import { Link } from 'react-router-dom'
import { LogoIcon } from '../components/Logo'

const KEYWORDS = [
  { label:'整然',     icon:'❖' },
  { label:'スマート', icon:'✦' },
  { label:'信頼',     icon:'◈' },
  { label:'かんたん', icon:'✓' },
]

export default function TopPage() {
  return (
    <div style={{
      minHeight:'100vh',
      background: 'linear-gradient(135deg, #EEF0FE 0%, #E0F2FE 50%, #F8FAFC 100%)',
      padding:'48px 24px',
      fontFamily:'"Noto Sans JP", sans-serif',
      position:'relative', overflow:'hidden',
    }}>
      {/* Decorative dot pattern */}
      <div aria-hidden style={{
        position:'absolute', inset:0, opacity:0.4, pointerEvents:'none',
        backgroundImage:'radial-gradient(circle at 1px 1px, rgba(79,70,229,0.10) 1px, transparent 0)',
        backgroundSize:'24px 24px',
      }}/>

      <div style={{ maxWidth:880, margin:'0 auto', position:'relative' }}>

        {/* Brand */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', marginBottom:48 }}>
          <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:14 }}>
            <LogoIcon size={56} />
            <div style={{ display:'flex', flexDirection:'column', lineHeight:1.05, alignItems:'flex-start' }}>
              <span style={{ fontSize:42, fontWeight:900, color:'#0F172A', letterSpacing:'-0.01em' }}>ピタシフ</span>
              <span style={{ fontSize:13, fontWeight:600, color:'#4F46E5', marginTop:6, letterSpacing:'0.04em' }}>シフト管理を ピタッと</span>
            </div>
          </div>
          <p style={{ fontSize:14, color:'#475569', lineHeight:1.7, maxWidth:480, marginTop:12 }}>
            店舗バイトのシフトが、<strong style={{ color:'#4F46E5' }}>ピタッと</strong> 集まる・決まる・管理できる。<br/>
            整然としたUIで、毎月のシフト業務を半分の時間で。
          </p>

          {/* Keyword chips */}
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', justifyContent:'center', marginTop:20 }}>
            {KEYWORDS.map(k => (
              <span key={k.label} style={{
                display:'inline-flex', alignItems:'center', gap:5,
                padding:'5px 12px', borderRadius:14, fontSize:11, fontWeight:600,
                background:'white', color:'#4F46E5', border:'1px solid #E2E8F0',
                boxShadow:'0 1px 2px rgba(15,23,42,0.04)',
              }}>
                <span style={{ color:'#38BDF8', fontSize:11 }}>{k.icon}</span> {k.label}
              </span>
            ))}
          </div>
        </div>

        {/* Cards */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:18 }}>
          <PortalCard
            to="/login"
            badge="MANAGER"
            badgeColor="#4F46E5"
            title="マネージャー"
            sub="店舗運営者向け"
            desc="シフト計画・人員配置・目標管理・スタッフ管理"
            features={['ダッシュボード', '売上・客数 目標設定', 'AI自動シフト配置', 'メンバー管理']}
            color="#4F46E5"
            colorSoft="#EEF0FE"
          />
          <PortalCard
            to="/login"
            badge="EMPLOYEE"
            badgeColor="#38BDF8"
            title="従業員"
            sub="スタッフ向け（基本版）"
            desc="シフト確認・提出・通知の基本機能"
            features={['スケジュール確認', 'シフト提出', '通知']}
            color="#38BDF8"
            colorSoft="#E0F2FE"
          />
        </div>

        {/* Ver2 CTA */}
        <div style={{ marginTop:18 }}>
          <Link
            to="/login"
            style={{
              display:'flex', alignItems:'center', gap:14, padding:'18px 22px',
              background:'white', border:'2px dashed #FF6B6B', borderRadius:14,
              textDecoration:'none', transition:'all .15s',
            }}
          >
            <div style={{ width:48, height:48, borderRadius:12, background:'#FFE5E5', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, flexShrink:0 }}>⚡</div>
            <div style={{ flex:1 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:2 }}>
                <span style={{ fontSize:14, fontWeight:800, color:'#0F172A' }}>従業員 ver2</span>
                <span style={{ fontSize:9, fontWeight:800, padding:'2px 7px', borderRadius:10, background:'#FFE5E5', color:'#DC2626' }}>NEW</span>
              </div>
              <div style={{ fontSize:11, color:'#64748B' }}>スキマバイト機能付き — 空き時間をチャンスに</div>
            </div>
            <span style={{ fontSize:18, color:'#FF6B6B', fontWeight:700 }}>→</span>
          </Link>
        </div>

        <div style={{ marginTop:36, textAlign:'center', fontSize:11, color:'#94A3B8' }}>
          ピタシフ v1.0 — 2026年4月版 · デモ環境
        </div>
      </div>
    </div>
  )
}

function PortalCard({ to, badge, badgeColor, title, sub, desc, features, color, colorSoft }) {
  return (
    <Link
      to={to}
      style={{
        display:'block', background:'white', borderRadius:16,
        padding:'24px 22px', textDecoration:'none',
        border:'1px solid #E2E8F0', boxShadow:'0 4px 12px rgba(15,23,42,0.04)',
        transition:'transform .15s, box-shadow .15s, border-color .15s',
        position:'relative', overflow:'hidden',
      }}
    >
      {/* Top accent bar */}
      <div style={{ position:'absolute', top:0, left:0, right:0, height:4, background:color }} />

      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
        <span style={{
          fontSize:9, fontWeight:800, padding:'3px 9px', borderRadius:10,
          background:colorSoft, color:badgeColor, letterSpacing:'0.06em',
        }}>{badge}</span>
        <span style={{ fontSize:10, color:'#94A3B8' }}>{sub}</span>
      </div>

      <div style={{ fontSize:22, fontWeight:800, color:'#0F172A', marginBottom:6 }}>{title}</div>
      <div style={{ fontSize:12, color:'#475569', marginBottom:16, lineHeight:1.6 }}>{desc}</div>

      <ul style={{ margin:0, padding:0, listStyle:'none', display:'flex', flexDirection:'column', gap:6 }}>
        {features.map(f => (
          <li key={f} style={{ fontSize:11.5, color:'#334155', display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ width:14, height:14, borderRadius:'50%', background:colorSoft, color:badgeColor, fontSize:9, fontWeight:800, display:'inline-flex', alignItems:'center', justifyContent:'center' }}>✓</span>
            {f}
          </li>
        ))}
      </ul>

      <div style={{
        marginTop:20, padding:'10px 16px', borderRadius:10,
        background:color, color:'white', fontSize:13, fontWeight:700,
        display:'inline-flex', alignItems:'center', gap:6,
      }}>
        入る →
      </div>
    </Link>
  )
}
