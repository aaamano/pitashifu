import { useState } from 'react'
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { LogoIcon } from '../../components/Logo'
import { useAuth } from '../../context/AuthContext'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import * as invitationsApi from '../../api/invitations'

const BRAND = '#4F46E5'
const BRAND_DEEP = '#3730A3'

// employees 行が未作成の場合のフォールバックorg
const FALLBACK_ORG_ID = 'demo'
const PENDING_BOOTSTRAP_KEY = 'pitashif_pending_bootstrap'
const PENDING_INVITE_KEY    = 'pitashif_pending_invite'

// ログイン後にユーザーの org_id + role を引いて遷移先パスを決める
// 優先順:
//   1. URL/localStorage に招待 token あり → accept_invitation 実行
//   2. 既存の employees 行があれば、その org に遷移
//   3. pendingBootstrap or メールから会社名を推定して bootstrap を実行
//   4. フォールバック
async function resolveRedirectPath(explicitInviteToken) {
  // 1. 招待 token を最優先で処理
  let inviteToken = explicitInviteToken
  if (!inviteToken) {
    try {
      const raw = localStorage.getItem(PENDING_INVITE_KEY)
      if (raw) {
        const p = JSON.parse(raw)
        if (p?.token) inviteToken = p.token
      }
    } catch {}
  }
  if (inviteToken) {
    try {
      const result = await invitationsApi.acceptInvitation(inviteToken)
      localStorage.removeItem(PENDING_INVITE_KEY)
      if (result?.org_id) {
        const scope = result.role === 'staff' ? 'employee' : 'manager'
        return `/${result.org_id}/${scope}`
      }
    } catch (e) {
      console.error('[login.accept_invitation]', e)
      // 失敗してもログイン自体は完了させる。下のフローに継続
    }
  }

  // 2. 既存の employees 行を確認
  const { data: { user } } = await supabase.auth.getUser()
  if (user?.id) {
    const { data } = await supabase
      .from('employees')
      .select('org_id, role')
      .eq('auth_user_id', user.id)
      .maybeSingle()
    if (data) {
      const scope = data.role === 'staff' ? 'employee' : 'manager'
      return `/${data.org_id}/${scope}`
    }
  }

  // 3. 未bootstrap → pendingBootstrap or メールアドレスから会社名を生成して bootstrap
  let companyName = '新規会社'
  let userName    = null
  try {
    const raw = localStorage.getItem(PENDING_BOOTSTRAP_KEY)
    if (raw) {
      const p = JSON.parse(raw)
      if (p.companyName) companyName = p.companyName
      if (p.userName)    userName    = p.userName
    } else {
      const { data: sess } = await supabase.auth.getSession()
      const email = sess?.session?.user?.email
      if (email) {
        const local = email.split('@')[0]
        companyName = `${local} の会社`
      }
    }
  } catch (e) {
    console.error('[login.resolveRedirect.pending]', e)
  }

  try {
    const { data: orgId, error: bsErr } = await supabase.rpc('bootstrap_owner_account', {
      p_company_name: companyName,
      p_user_name:    userName,
    })
    if (!bsErr && orgId) {
      localStorage.removeItem(PENDING_BOOTSTRAP_KEY)
      return `/${orgId}/manager`
    }
    console.error('[login.bootstrap]', bsErr)
  } catch (e) {
    console.error('[login.bootstrap.exception]', e)
  }

  // 4. 最終フォールバック
  return `/${FALLBACK_ORG_ID}/manager`
}

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const fromPath = location.state?.from
  const [searchParams] = useSearchParams()
  const inviteToken = searchParams.get('invite') || null

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    const { error: err } = await signIn(email, password)
    if (err) {
      setSubmitting(false)
      setError(err.message)
      return
    }
    // 招待 token を最優先で処理。URL に invite が無くても localStorage の保存値も見る
    const target = (inviteToken ? await resolveRedirectPath(inviteToken) : (fromPath ?? await resolveRedirectPath()))
    setSubmitting(false)
    navigate(target, { replace: true })
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

        <h1 style={styles.title}>ログイン</h1>

        {!isSupabaseConfigured && (
          <div style={styles.warn}>
            ⚠ Supabase の環境変数（<code>VITE_SUPABASE_URL</code> / <code>VITE_SUPABASE_ANON_KEY</code>）が未設定です。Vercel の Settings → Environment Variables から設定してください。
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:14 }}>
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
            />
          </label>

          <label style={styles.label}>
            <span>パスワード</span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
            />
          </label>

          {error && <div style={styles.error}>{error}</div>}

          <button type="submit" disabled={submitting} style={{ ...styles.button, opacity: submitting ? 0.6 : 1 }}>
            {submitting ? 'ログイン中…' : 'ログイン'}
          </button>
        </form>

        <p style={{ ...styles.footer, marginBottom: 8 }}>
          <Link to="/forgot-password" style={styles.link}>パスワードを忘れた方はこちら</Link>
        </p>
        <p style={styles.footer}>
          アカウントをお持ちでない方は
          <Link to="/signup" style={styles.link}>新規登録</Link>
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
  warn: {
    background: '#FEF3C7',
    color: '#92400E',
    border: '1px solid #FDE68A',
    borderRadius: 8,
    padding: '10px 12px',
    fontSize: 12,
    marginBottom: 14,
    lineHeight: 1.6,
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
