import { useState, useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { LogoIcon } from '../../components/Logo'
import { useAuth } from '../../context/AuthContext'
import * as invitationsApi from '../../api/invitations'

const BRAND = '#4F46E5'
const BRAND_DEEP = '#3730A3'

const ROLE_LABEL = {
  owner:   'オーナー',
  admin:   '管理者',
  manager: 'マネージャー',
  staff:   'スタッフ',
}

export default function AcceptInvite() {
  const { token } = useParams()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()

  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [accepting, setAccepting] = useState(false)

  useEffect(() => {
    if (!token) { setError('トークンがありません'); setLoading(false); return }
    let cancelled = false
    invitationsApi.previewInvitation(token)
      .then(p => { if (!cancelled) setPreview(p) })
      .catch(e => { if (!cancelled) setError(e.message || '招待の読み込みに失敗しました') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [token])

  const accept = async () => {
    setAccepting(true); setError('')
    try {
      const result = await invitationsApi.acceptInvitation(token)
      const scope = result.role === 'staff' ? 'employee' : 'manager'
      navigate(`/${result.org_id}/${scope}`, { replace: true })
    } catch (e) {
      setError(e.message || '招待の受諾に失敗しました')
    } finally {
      setAccepting(false)
    }
  }

  if (loading || authLoading) {
    return <Layout><div style={styles.muted}>読み込み中…</div></Layout>
  }

  if (!preview?.found) {
    return (
      <Layout>
        <div style={styles.title}>招待が見つかりません</div>
        <p style={styles.muted}>URL が間違っているか、招待が削除されている可能性があります。</p>
        <Link to="/login" style={styles.link}>ログインへ</Link>
      </Layout>
    )
  }

  if (preview.revoked) {
    return (
      <Layout>
        <div style={styles.title}>この招待は取り消されました</div>
        <p style={styles.muted}>発行者にもう一度招待を送ってもらってください。</p>
        <Link to="/login" style={styles.link}>ログインへ</Link>
      </Layout>
    )
  }

  if (preview.used) {
    return (
      <Layout>
        <div style={styles.title}>この招待は既に使用されています</div>
        <p style={styles.muted}>同じユーザーで再ログインするか、新しい招待を発行してもらってください。</p>
        <Link to="/login" style={styles.link}>ログインへ</Link>
      </Layout>
    )
  }

  if (preview.expired) {
    return (
      <Layout>
        <div style={styles.title}>この招待は期限切れです</div>
        <p style={styles.muted}>新しい招待を発行してもらってください。</p>
        <Link to="/login" style={styles.link}>ログインへ</Link>
      </Layout>
    )
  }

  const orgName = preview.org_name || preview.org_id
  const roleLabel = ROLE_LABEL[preview.role] || preview.role

  // 未ログイン: signup/login への導線（token をクエリで持ち回り）
  if (!user) {
    const next = `/invite/${token}`
    return (
      <Layout>
        <div style={styles.title}>{orgName} に招待されています</div>
        <div style={styles.inviteCard}>
          <Row label="所属" value={orgName} />
          <Row label="ロール" value={roleLabel} />
          {preview.email     && <Row label="メール" value={preview.email} />}
          {preview.name_hint && <Row label="お名前（予定）" value={preview.name_hint} />}
          <Row label="期限" value={new Date(preview.expires_at).toLocaleString('ja-JP')} />
        </div>
        <p style={styles.muted}>
          続行するにはサインアップまたはログインしてください。
          {preview.email ? ' 招待されたメールアドレスをお使いください。' : ''}
        </p>
        <div style={{ display:'flex', gap:8, marginTop:18 }}>
          <Link to={`/signup?invite=${encodeURIComponent(token)}${preview.email ? `&email=${encodeURIComponent(preview.email)}` : ''}`} style={styles.button}>
            サインアップ
          </Link>
          <Link to={`/login?invite=${encodeURIComponent(token)}`} style={{ ...styles.button, background:'white', color: BRAND, border:`1px solid ${BRAND}` }}>
            ログイン
          </Link>
        </div>
      </Layout>
    )
  }

  // ログイン済み: 受諾ボタン
  return (
    <Layout>
      <div style={styles.title}>{orgName} に招待されています</div>
      <div style={styles.inviteCard}>
        <Row label="所属"   value={orgName} />
        <Row label="ロール" value={roleLabel} />
        {preview.email     && <Row label="メール" value={preview.email} />}
        {preview.name_hint && <Row label="お名前（予定）" value={preview.name_hint} />}
        <Row label="期限"   value={new Date(preview.expires_at).toLocaleString('ja-JP')} />
      </div>
      {error && <div style={styles.error}>{error}</div>}
      <button onClick={accept} disabled={accepting} style={{ ...styles.button, opacity: accepting ? 0.6 : 1, marginTop:18 }}>
        {accepting ? '受諾中…' : '参加する'}
      </button>
      <p style={{ ...styles.muted, marginTop:14 }}>
        現在ログイン中: {user.email}
        {preview.email && preview.email.toLowerCase() !== user.email?.toLowerCase() && (
          <span style={{ color:'#B91C1C', display:'block', marginTop:4 }}>
            ⚠ 招待されたメールと異なります。
            <Link to="/login" style={{ color:BRAND_DEEP, marginLeft:6 }}>別のアカウントでログイン</Link>
          </span>
        )}
      </p>
    </Layout>
  )
}

function Row({ label, value }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', gap:12, padding:'8px 0', borderBottom:'1px solid #F1F5F9' }}>
      <span style={{ fontSize:12, color:'#64748B', fontWeight:600 }}>{label}</span>
      <span style={{ fontSize:13, color:'#0F172A', fontWeight:600, textAlign:'right', wordBreak:'break-all' }}>{value}</span>
    </div>
  )
}

function Layout({ children }) {
  return (
    <div style={styles.stage}>
      <div style={styles.card}>
        <div style={styles.header}>
          <LogoIcon size={48} />
          <div style={{ display:'flex', flexDirection:'column', lineHeight:1.05 }}>
            <span style={{ fontSize:24, fontWeight:900, color:'#0F172A', letterSpacing:'-0.01em' }}>ピタシフ</span>
            <span style={{ fontSize:11, fontWeight:600, color:BRAND, marginTop:4 }}>招待を受諾</span>
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}

const styles = {
  stage: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #EEF0FE 0%, #E0F2FE 100%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 24, fontFamily: '"Noto Sans JP", sans-serif',
  },
  card: {
    width: '100%', maxWidth: 440, background: '#FFFFFF', borderRadius: 16,
    padding: '32px 28px',
    boxShadow: '0 12px 32px rgba(79,70,229,0.12), 0 4px 12px rgba(15,23,42,0.06)',
  },
  header: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 },
  title: { fontSize: 18, fontWeight: 700, color: '#0F172A', margin: '0 0 12px' },
  muted: { fontSize: 13, color: '#475569', lineHeight: 1.6 },
  inviteCard: {
    background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12,
    padding: '6px 14px', margin: '10px 0',
  },
  button: {
    flex: 1, padding: '12px 16px', background: BRAND, color: '#FFFFFF',
    border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700,
    cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center',
    textDecoration: 'none', boxShadow: '0 4px 12px rgba(79,70,229,0.25)',
    display: 'inline-block',
  },
  link: {
    color: BRAND_DEEP, fontWeight: 700, textDecoration: 'none',
    display: 'inline-block', marginTop: 18,
  },
  error: {
    background: '#FFE5E5', color: '#B91C1C',
    border: '1px solid #FECACA', borderRadius: 8,
    padding: '8px 12px', fontSize: 12, marginTop: 14,
  },
}
