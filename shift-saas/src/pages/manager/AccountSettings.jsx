import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

const BRAND = '#4F46E5'

const ROLE_LABEL = {
  owner:   'オーナー',
  admin:   '管理者',
  manager: 'マネージャー',
  staff:   'スタッフ',
}

export default function AccountSettings() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()

  const [me, setMe] = useState(null)
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMsg, setProfileMsg] = useState('')
  const [profileErr, setProfileErr] = useState('')

  // パスワード変更
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('')
  const [savingPwd, setSavingPwd] = useState(false)
  const [pwdMsg, setPwdMsg] = useState('')
  const [pwdErr, setPwdErr] = useState('')

  // 自分の employees 行を取得
  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await supabase
          .from('employees')
          .select('id, org_id, name, email, role, phone, employment_type, wage')
          .eq('auth_user_id', user.id)
          .maybeSingle()
        if (cancelled) return
        setMe(data)
        setName(data?.name ?? '')
        setPhone(data?.phone ?? '')
      } catch (e) {
        console.error('[AccountSettings.load]', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [user])

  const saveProfile = async () => {
    if (!me?.id) return
    setSavingProfile(true); setProfileMsg(''); setProfileErr('')
    try {
      const { error } = await supabase
        .from('employees')
        .update({ name: name.trim() || me.name, phone: phone.trim() || null })
        .eq('id', me.id)
      if (error) throw error
      setProfileMsg('✓ プロフィールを更新しました')
      setTimeout(() => setProfileMsg(''), 2500)
    } catch (e) {
      console.error('[AccountSettings.saveProfile]', e)
      setProfileErr(e.message || '保存に失敗しました')
    } finally {
      setSavingProfile(false)
    }
  }

  const changePassword = async () => {
    setPwdMsg(''); setPwdErr('')
    if (!newPassword) { setPwdErr('新しいパスワードを入力してください'); return }
    if (newPassword.length < 8) { setPwdErr('パスワードは 8 文字以上にしてください'); return }
    if (newPassword !== newPasswordConfirm) { setPwdErr('確認用パスワードが一致しません'); return }
    setSavingPwd(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setPwdMsg('✓ パスワードを変更しました')
      setNewPassword(''); setNewPasswordConfirm('')
      setTimeout(() => setPwdMsg(''), 2500)
    } catch (e) {
      console.error('[AccountSettings.changePassword]', e)
      setPwdErr(e.message || 'パスワード変更に失敗しました')
    } finally {
      setSavingPwd(false)
    }
  }

  const handleLogout = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  if (loading) {
    return (
      <div className="mgr-page">
        <div style={{ padding: 32, color: '#94a3b8' }}>読み込み中…</div>
      </div>
    )
  }

  return (
    <div className="mgr-page">
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0F172A', margin: 0 }}>アカウント</h1>
        <p style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>自分のプロフィール・パスワード・ログアウトを管理します</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16, maxWidth: 640 }}>

        {/* 基本情報 */}
        <div className="mgr-card" style={{ padding: '20px 22px' }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: '#0F172A', margin: '0 0 16px' }}>基本情報</h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <Field label="メールアドレス" readOnly value={me?.email ?? ''} />
            <Field label="ロール" readOnly value={ROLE_LABEL[me?.role] ?? me?.role ?? '—'} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label className="mgr-label">名前</label>
              <input className="mgr-input" value={name} onChange={e => setName(e.target.value)} placeholder="例: 山田 太郎" />
            </div>
            <div>
              <label className="mgr-label">電話番号</label>
              <input className="mgr-input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="例: 090-1234-5678" />
            </div>
          </div>

          {profileMsg && <div style={msgOk}>{profileMsg}</div>}
          {profileErr && <div style={msgErr}>{profileErr}</div>}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
            <button onClick={saveProfile} disabled={savingProfile} className="mgr-btn-primary">
              {savingProfile ? '保存中…' : 'プロフィールを保存'}
            </button>
          </div>
        </div>

        {/* パスワード変更 */}
        <div className="mgr-card" style={{ padding: '20px 22px' }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: '#0F172A', margin: '0 0 4px' }}>パスワード変更</h2>
          <p style={{ fontSize: 11, color: '#64748b', margin: '0 0 16px' }}>8 文字以上のパスワードを設定してください</p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label className="mgr-label">新しいパスワード</label>
              <input type="password" className="mgr-input" value={newPassword}
                onChange={e => setNewPassword(e.target.value)} autoComplete="new-password" />
            </div>
            <div>
              <label className="mgr-label">新しいパスワード（確認）</label>
              <input type="password" className="mgr-input" value={newPasswordConfirm}
                onChange={e => setNewPasswordConfirm(e.target.value)} autoComplete="new-password" />
            </div>
          </div>

          {pwdMsg && <div style={msgOk}>{pwdMsg}</div>}
          {pwdErr && <div style={msgErr}>{pwdErr}</div>}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
            <button onClick={changePassword} disabled={savingPwd} className="mgr-btn-primary">
              {savingPwd ? '変更中…' : 'パスワードを変更'}
            </button>
          </div>
        </div>

        {/* ログアウト */}
        <div className="mgr-card" style={{ padding: '20px 22px' }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: '#0F172A', margin: '0 0 4px' }}>ログアウト</h2>
          <p style={{ fontSize: 11, color: '#64748b', margin: '0 0 14px' }}>このブラウザからサインアウトします</p>
          <button onClick={handleLogout}
            style={{ padding:'9px 18px', borderRadius:8, background:'white', color:'#B91C1C',
                     border:'1px solid #FECACA', fontSize:13, fontWeight:600, cursor:'pointer',
                     fontFamily:'inherit' }}>
            ログアウト
          </button>
        </div>

      </div>
    </div>
  )
}

function Field({ label, value, readOnly }) {
  return (
    <div>
      <label className="mgr-label">{label}</label>
      <input className="mgr-input" value={value} readOnly={readOnly}
        style={readOnly ? { background: '#F8FAFC', color: '#475569' } : undefined} />
    </div>
  )
}

const msgOk  = { marginTop:12, padding:'8px 12px', background:'#ECFDF5', color:'#065F46',
                 border:'1px solid #A7F3D0', borderRadius:8, fontSize:12 }
const msgErr = { marginTop:12, padding:'8px 12px', background:'#FEE2E2', color:'#B91C1C',
                 border:'1px solid #FECACA', borderRadius:8, fontSize:12 }
