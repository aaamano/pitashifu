import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { LogoIcon } from '../../components/Logo'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import * as invitationsApi from '../../api/invitations'

const BRAND = '#4F46E5'
const BRAND_DEEP = '#3730A3'

// pendingBootstrap: メール確認後の初回ログイン時に bootstrap_owner_account を呼ぶための引数を保持
const PENDING_BOOTSTRAP_KEY = 'pitashif_pending_bootstrap'
const PENDING_INVITE_KEY    = 'pitashif_pending_invite'

export default function Signup() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const inviteToken = searchParams.get('invite') || null
  const isInvite = Boolean(inviteToken)

  const [companyName, setCompanyName] = useState('')
  const [userName,    setUserName]    = useState('')
  const [email, setEmail] = useState(searchParams.get('email') || '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [inviteInfo, setInviteInfo] = useState(null)

  // 招待 URL から来た場合は組織情報をプレビュー表示
  useEffect(() => {
    if (!inviteToken) return
    invitationsApi.previewInvitation(inviteToken)
      .then(p => { if (p?.found) setInviteInfo(p) })
      .catch(e => console.error('[signup.preview]', e))
  }, [inviteToken])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setInfo('')
    if (!isInvite && !companyName.trim()) { setError('会社名を入力してください'); return }
    setSubmitting(true)
    const { data, error: err } = await signUp(email, password)
    if (err) {
      setSubmitting(false)
      setError(err.message)
      return
    }
    // メール確認が有効: セッションが返らない → 確認後に処理するため localStorage に退避
    if (data?.user && !data.session) {
      try {
        if (isInvite) {
          localStorage.setItem(PENDING_INVITE_KEY, JSON.stringify({ token: inviteToken }))
        } else {
          localStorage.setItem(PENDING_BOOTSTRAP_KEY, JSON.stringify({
            companyName: companyName.trim(),
            userName:    userName.trim(),
          }))
        }
      } catch {}
      setSubmitting(false)
      setInfo(isInvite
        ? '確認メールを送信しました。メール内のリンクから認証完了後、ログインすると招待に参加します。'
        : '確認メールを送信しました。メール内のリンクから認証完了後、ログインすると会社が自動作成されます。')
      return
    }

    // セッションがある = メール確認OFF or 即時ログイン
    try {
      if (isInvite) {
        const result = await invitationsApi.acceptInvitation(inviteToken)
        setSubmitting(false)
        const scope = result.role === 'staff' ? 'employee' : 'manager'
        navigate(`/${result.org_id}/${scope}`, { replace: true })
        return
      }
      const { data: orgId, error: bsErr } = await supabase.rpc('bootstrap_owner_account', {
        p_company_name: companyName.trim(),
        p_user_name:    userName.trim() || null,
      })
      setSubmitting(false)
      if (bsErr) { console.error('[signup.bootstrap]', bsErr); setError(bsErr.message); return }
      navigate(`/${orgId}/manager`, { replace: true })
    } catch (e) {
      setSubmitting(false)
      setError(e.message || (isInvite ? '招待の受諾に失敗しました' : '会社の作成に失敗しました'))
    }
  }

  return (
    <div style={styles.stage}>
      <div style={styles.card}>
        <div style={styles.header}>
          <LogoIcon size={48} />
          <div style={{ display:'flex', flexDirection:'column', lineHeight:1.05 }}>
            <span style={{ fontSize:28, fontWeight:900, color:'#0F172A', letterSpacing:'-0.01em' }}>ピタシフ</span>
            <span style={{ fontSize:11, fontWeight:600, color:BRAND, marginTop:4, letterSpacing:'0.04em' }}>シフト管理を ピタッと</span>
          </div>
        </div>

        <h1 style={styles.title}>{isInvite ? '招待を受けて登録' : '新規登録'}</h1>

        {isInvite && inviteInfo && (
          <div style={styles.invitePanel}>
            <div style={{ fontSize:12, color:'#3730A3', fontWeight:700, marginBottom:4 }}>招待されています</div>
            <div style={{ fontSize:13, color:'#0F172A', fontWeight:600 }}>
              {inviteInfo.org_name} — {{ owner:'オーナー', admin:'管理者', manager:'マネージャー', staff:'スタッフ' }[inviteInfo.role] || inviteInfo.role}
            </div>
            {inviteInfo.email && (
              <div style={{ fontSize:11, color:'#475569', marginTop:4 }}>
                招待メール: <code style={{ background:'#EEF0FE', padding:'1px 4px', borderRadius:4 }}>{inviteInfo.email}</code>（このメールでサインアップしてください）
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {!isInvite && (
            <label style={styles.label}>
              <span>会社名 *</span>
              <input
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                style={styles.input}
                placeholder="例: ピタシフ株式会社"
              />
            </label>
          )}

          {!isInvite && (
            <label style={styles.label}>
              <span>お名前（任意）</span>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                style={styles.input}
                placeholder="例: 山田 太郎"
              />
            </label>
          )}

          <label style={styles.label}>
            <span>メールアドレス</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
              placeholder="you@example.com"
              readOnly={isInvite && Boolean(inviteInfo?.email)}
            />
          </label>

          <label style={styles.label}>
            <span>パスワード（8文字以上）</span>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
            />
          </label>

          {error && <div style={styles.error}>{error}</div>}
          {info  && <div style={styles.info}>{info}</div>}

          <button type="submit" disabled={submitting} style={{ ...styles.button, opacity: submitting ? 0.6 : 1 }}>
            {submitting ? '登録中…' : isInvite ? '招待に参加して登録' : 'アカウント作成'}
          </button>
        </form>

        <p style={styles.footer}>
          既にアカウントをお持ちの方は
          <Link to="/login" style={styles.link}>ログイン</Link>
        </p>
      </div>
    </div>
  )
}

const styles = {
  stage: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #EEF0FE 0%, #E0F2FE 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    fontFamily: '"Noto Sans JP", sans-serif',
  },
  card: {
    width: '100%',
    maxWidth: 400,
    background: '#FFFFFF',
    borderRadius: 16,
    padding: '32px 28px',
    boxShadow: '0 12px 32px rgba(79,70,229,0.12), 0 4px 12px rgba(15,23,42,0.06)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    color: '#0F172A',
    margin: '0 0 18px',
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    fontSize: 12,
    fontWeight: 600,
    color: '#475569',
  },
  input: {
    border: '1px solid #E2E8F0',
    borderRadius: 8,
    padding: '10px 12px',
    fontSize: 14,
    outline: 'none',
    fontFamily: 'inherit',
    color: '#0F172A',
    background: '#FFFFFF',
  },
  button: {
    marginTop: 6,
    padding: '12px 16px',
    background: BRAND,
    color: '#FFFFFF',
    border: 'none',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: '0 4px 12px rgba(79,70,229,0.25)',
  },
  error: {
    background: '#FFE5E5',
    color: '#B91C1C',
    border: '1px solid #FECACA',
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: 12,
  },
  info: {
    background: '#EEF0FE',
    color: '#3730A3',
    border: '1px solid #C7D2FE',
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: 12,
  },
  invitePanel: {
    background: '#EEF0FE',
    border: '1px solid #C7D2FE',
    borderRadius: 10,
    padding: '10px 14px',
    marginBottom: 18,
  },
  footer: {
    marginTop: 22,
    fontSize: 12,
    color: '#475569',
    textAlign: 'center',
  },
  link: {
    color: BRAND_DEEP,
    fontWeight: 700,
    marginLeft: 6,
    textDecoration: 'none',
  },
}
