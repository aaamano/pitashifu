import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LogoIcon } from '../../components/Logo'
import { supabase } from '../../lib/supabase'

const BRAND = '#4F46E5'
const BRAND_DEEP = '#3730A3'

// Supabase は #access_token=... 形式でメールから戻ってくる。
// supabase.auth がそれを検出して onAuthStateChange で session を発火する。
export default function ResetPassword() {
  const navigate = useNavigate()

  const [ready, setReady]   = useState(false) // PASSWORD_RECOVERY event を受け取ったか
  const [hasSession, setHasSession] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [info,  setInfo]  = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setHasSession(Boolean(data.session))
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) {
        setReady(true)
        setHasSession(Boolean(session))
      }
    })
    return () => { mounted = false; sub.subscription.unsubscribe() }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(''); setInfo('')
    if (password.length < 8) { setError('パスワードは 8 文字以上にしてください'); return }
    if (password !== confirm) { setError('確認用パスワードが一致しません'); return }
    setSubmitting(true)
    try {
      const { error: err } = await supabase.auth.updateUser({ password })
      if (err) throw err
      setInfo('✓ パスワードを更新しました。3 秒後にログイン画面へ移動します。')
      setTimeout(() => navigate('/login', { replace: true }), 3000)
    } catch (e) {
      console.error('[ResetPassword]', e)
      setError(e.message || 'パスワード更新に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={styles.stage}>
      <div style={styles.card}>
        <div style={styles.header}>
          <LogoIcon size={48} />
          <div style={{ display:'flex', flexDirection:'column', lineHeight:1.05 }}>
            <span style={{ fontSize:24, fontWeight:900, color:'#0F172A', letterSpacing:'-0.01em' }}>ピタシフ</span>
            <span style={{ fontSize:11, fontWeight:600, color:BRAND, marginTop:4 }}>パスワード再設定</span>
          </div>
        </div>

        {!ready && !hasSession ? (
          <>
            <h1 style={styles.title}>リンクから戻ってきましたか？</h1>
            <p style={styles.muted}>
              このページは、パスワード再設定メール内のリンクから開くことで有効になります。<br />
              リンクからアクセスしていない場合は、<Link to="/forgot-password" style={styles.link}>パスワードを忘れた</Link> から再度メールを送信してください。
            </p>
          </>
        ) : (
          <>
            <h1 style={styles.title}>新しいパスワードを設定</h1>
            <p style={styles.muted}>8 文字以上のパスワードを設定してください。</p>
            <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:14, marginTop:16 }}>
              <label style={styles.label}>
                <span>新しいパスワード</span>
                <input type="password" required autoComplete="new-password" minLength={8}
                  value={password} onChange={e => setPassword(e.target.value)} style={styles.input} />
              </label>
              <label style={styles.label}>
                <span>新しいパスワード（確認）</span>
                <input type="password" required autoComplete="new-password" minLength={8}
                  value={confirm} onChange={e => setConfirm(e.target.value)} style={styles.input} />
              </label>
              {error && <div style={styles.error}>{error}</div>}
              {info  && <div style={styles.info}>{info}</div>}
              <button type="submit" disabled={submitting} style={{ ...styles.button, opacity: submitting ? 0.6 : 1 }}>
                {submitting ? '更新中…' : 'パスワードを更新'}
              </button>
            </form>
          </>
        )}

        <p style={styles.footer}>
          <Link to="/login" style={styles.link}>← ログインに戻る</Link>
        </p>
      </div>
    </div>
  )
}

const styles = {
  stage: { minHeight:'100vh', background:'linear-gradient(135deg, #EEF0FE 0%, #E0F2FE 100%)',
           display:'flex', alignItems:'center', justifyContent:'center', padding:24,
           fontFamily:'"Noto Sans JP", sans-serif' },
  card:  { width:'100%', maxWidth:400, background:'#FFFFFF', borderRadius:16,
           padding:'32px 28px', boxShadow:'0 12px 32px rgba(79,70,229,0.12), 0 4px 12px rgba(15,23,42,0.06)' },
  header:{ display:'flex', alignItems:'center', gap:12, marginBottom:18 },
  title: { fontSize:20, fontWeight:700, color:'#0F172A', margin:'0 0 8px' },
  muted: { fontSize:12, color:'#475569', lineHeight:1.6, margin:0 },
  label: { display:'flex', flexDirection:'column', gap:6, fontSize:12, fontWeight:600, color:'#475569' },
  input: { border:'1px solid #E2E8F0', borderRadius:8, padding:'10px 12px', fontSize:14, outline:'none',
           fontFamily:'inherit', color:'#0F172A', background:'#FFFFFF' },
  button:{ marginTop:6, padding:'12px 16px', background:BRAND, color:'#FFFFFF', border:'none',
           borderRadius:10, fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit',
           boxShadow:'0 4px 12px rgba(79,70,229,0.25)' },
  error: { background:'#FFE5E5', color:'#B91C1C', border:'1px solid #FECACA',
           borderRadius:8, padding:'8px 12px', fontSize:12 },
  info:  { background:'#ECFDF5', color:'#065F46', border:'1px solid #A7F3D0',
           borderRadius:8, padding:'8px 12px', fontSize:12 },
  footer:{ marginTop:22, fontSize:12, color:'#475569', textAlign:'center' },
  link:  { color:BRAND_DEEP, fontWeight:700, textDecoration:'none' },
}
