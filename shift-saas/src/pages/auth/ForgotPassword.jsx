import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LogoIcon } from '../../components/Logo'
import { supabase } from '../../lib/supabase'

const BRAND = '#4F46E5'
const BRAND_DEEP = '#3730A3'

export default function ForgotPassword() {
  const [email, setEmail]           = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [info, setInfo]             = useState('')
  const [error, setError]           = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(''); setInfo('')
    if (!email.trim()) { setError('メールアドレスを入力してください'); return }
    setSubmitting(true)
    try {
      const redirectTo = `${window.location.origin}/reset-password`
      const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo })
      if (err) throw err
      setInfo('パスワード再設定用のメールを送信しました。メール内のリンクから手続きを完了してください。')
    } catch (e) {
      console.error('[ForgotPassword]', e)
      setError(e.message || '送信に失敗しました')
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
            <span style={{ fontSize:11, fontWeight:600, color:BRAND, marginTop:4 }}>パスワードを忘れた</span>
          </div>
        </div>

        <h1 style={styles.title}>パスワード再設定</h1>
        <p style={styles.muted}>ご登録のメールアドレスに、パスワード再設定用のリンクをお送りします。</p>

        <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:14, marginTop:16 }}>
          <label style={styles.label}>
            <span>メールアドレス</span>
            <input type="email" required autoComplete="email"
              value={email} onChange={e => setEmail(e.target.value)}
              style={styles.input} placeholder="you@example.com" />
          </label>
          {error && <div style={styles.error}>{error}</div>}
          {info  && <div style={styles.info}>{info}</div>}
          <button type="submit" disabled={submitting} style={{ ...styles.button, opacity: submitting ? 0.6 : 1 }}>
            {submitting ? '送信中…' : '再設定リンクを送信'}
          </button>
        </form>

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
