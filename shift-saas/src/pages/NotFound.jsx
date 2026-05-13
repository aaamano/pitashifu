import { Link, useLocation } from 'react-router-dom'
import { LogoIcon } from '../components/Logo'

export default function NotFound() {
  const { pathname } = useLocation()

  return (
    <div style={{
      minHeight:'100vh',
      background: 'linear-gradient(135deg, #EEF0FE 0%, #E0F2FE 50%, #F8FAFC 100%)',
      padding:'48px 24px',
      fontFamily:'"Noto Sans JP", sans-serif',
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
    }}>
      <div style={{ maxWidth:520, textAlign:'center' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:12, marginBottom:24 }}>
          <LogoIcon size={48} />
          <span style={{ fontSize:28, fontWeight:900, color:'#0F172A' }}>ピタシフ</span>
        </div>

        <div style={{ fontSize:72, fontWeight:900, color:'#4F46E5', lineHeight:1, marginBottom:8 }}>404</div>
        <div style={{ fontSize:18, fontWeight:700, color:'#0F172A', marginBottom:8 }}>ページが見つかりません</div>
        <div style={{ fontSize:13, color:'#64748B', marginBottom:24, lineHeight:1.7 }}>
          お探しのページは移動または削除された可能性があります。
        </div>

        <div style={{ background:'white', border:'1px solid #E2E8F0', borderRadius:10, padding:'14px 18px', marginBottom:24, fontSize:11, color:'#64748B', textAlign:'left' }}>
          <div style={{ fontWeight:700, color:'#475569', marginBottom:4, fontSize:10 }}>リクエストされたパス</div>
          <div style={{ fontFamily:'monospace', color:'#FF6B6B', fontSize:13, wordBreak:'break-all' }}>{pathname}</div>
        </div>

        <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
          <Link to="/" style={{ padding:'10px 20px', borderRadius:10, background:'#4F46E5', color:'white', fontSize:13, fontWeight:700, textDecoration:'none' }}>
            TOPに戻る
          </Link>
          <Link to="/login" style={{ padding:'10px 20px', borderRadius:10, background:'white', color:'#4F46E5', fontSize:13, fontWeight:700, textDecoration:'none', border:'1px solid #E2E8F0' }}>
            ログイン
          </Link>
        </div>
      </div>
    </div>
  )
}
