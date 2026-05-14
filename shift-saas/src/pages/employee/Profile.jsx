import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { skillLabels } from '../../data/mockData'
import EmployeeTabBar from '../../components/EmployeeTabBar'
import { useMe } from '../../hooks/useMe'

const INDIGO = '#4F46E5'
const BORDER = '#E2E8F0'

// 役職コードを日本語表示にマッピング
function roleLabel(r) {
  switch (r) {
    case 'owner':   return 'オーナー'
    case 'admin':   return '管理者'
    case 'manager': return 'マネージャー'
    case 'staff':   return 'スタッフ'
    default:        return r || ''
  }
}

// useMe の me から DEFAULT 形を作る
function buildDefault(me) {
  if (!me) {
    return { name: '', role: '', phone: '', email: '', bank: '', emergency: '' }
  }
  return {
    name:      me.name || '',
    role:      roleLabel(me.role),
    phone:     me.phone || '',
    email:     me.email || '',
    bank:      me.bankInfo?.account ?? '',
    emergency: typeof me.emergencyContact === 'object' && me.emergencyContact
      ? `${me.emergencyContact.phone ?? ''}${me.emergencyContact.name ? `（${me.emergencyContact.name}）` : ''}`
      : '',
  }
}

const InfoRow = ({ label, value, accent }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px', borderBottom: `1px solid ${BORDER}` }}>
    <span style={{ fontSize: 11, color: '#64748B', width: 72, flexShrink: 0, fontWeight: 500, paddingTop: 1 }}>{label}</span>
    <span style={{ fontSize: 13, fontWeight: 600, color: accent ? INDIGO : '#0F172A', flex: 1, lineHeight: 1.5 }}>{value}</span>
  </div>
)

const Field = ({ label, value, onChange, multiline }) => (
  <div style={{ marginBottom: 14 }}>
    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 5 }}>{label}</label>
    {multiline ? (
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={2}
        style={{
          width: '100%', boxSizing: 'border-box', padding: '10px 12px', fontSize: 13,
          border: `1.5px solid ${BORDER}`, borderRadius: 8, color: '#0F172A',
          fontFamily: 'inherit', resize: 'none', outline: 'none',
        }}
      />
    ) : (
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: '100%', boxSizing: 'border-box', padding: '10px 12px', fontSize: 13,
          border: `1.5px solid ${BORDER}`, borderRadius: 8, color: '#0F172A',
          fontFamily: 'inherit', outline: 'none',
        }}
      />
    )}
  </div>
)

const PROFILE_KEY = 'pitashif_employee_profile'
function loadProfileOverrides() {
  try { const raw = localStorage.getItem(PROFILE_KEY); return raw ? JSON.parse(raw) : null } catch { return null }
}
function saveProfileOverrides(p) {
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)) } catch {}
}

export default function Profile({ base: baseProp, sukima = false }) {
  const { orgId } = useParams()
  const base = baseProp ?? `/${orgId}/employee`
  const { me, loading } = useMe()
  const [profile, setProfile]   = useState(() => buildDefault(null))
  const [editing, setEditing]   = useState(false)
  const [draft,   setDraft]     = useState(profile)
  const [showSaved, setShowSaved] = useState(false)

  // useMe で me が更新されたら、DBデータ + localStorage上書きでprofileを構築
  useEffect(() => {
    const dbDefault = buildDefault(me)
    const overrides = loadProfileOverrides() || {}
    const merged = { ...dbDefault, ...overrides }
    setProfile(merged)
    if (!editing) setDraft(merged)
  }, [me])

  const update = key => val => setDraft(d => ({ ...d, [key]: val }))

  const handleSave = () => {
    setProfile(draft)
    // 編集可能なフィールドのみ localStorage に保存（電話/振込/緊急連絡先など）
    saveProfileOverrides(draft)
    setEditing(false)
    setShowSaved(true)
    setTimeout(() => setShowSaved(false), 2500)
  }

  const handleCancel = () => {
    setDraft(profile)
    setEditing(false)
  }

  return (
    <>
      {/* Header */}
      <div className="pita-phone-header">
        <div style={{ flex: 1, fontSize: 14, fontWeight: 700, color: '#0F172A' }}>設定</div>
        {!editing ? (
          <button
            onClick={() => { setDraft(profile); setEditing(true) }}
            style={{
              fontSize: 12, fontWeight: 700, color: INDIGO, background: '#EEF0FE',
              border: 'none', borderRadius: 8, padding: '6px 14px', cursor: 'pointer',
            }}
          >
            編集
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleCancel}
              style={{ fontSize: 12, fontWeight: 600, color: '#64748B', background: '#F1F5F9', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}
            >
              キャンセル
            </button>
            <button
              onClick={handleSave}
              style={{ fontSize: 12, fontWeight: 700, color: 'white', background: INDIGO, border: 'none', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', boxShadow: '0 2px 8px rgba(79,70,229,0.28)' }}
            >
              保存
            </button>
          </div>
        )}
      </div>

      <div className="pita-phone-body">

        {/* Avatar section */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 16px 16px', background: 'white', borderBottom: `1px solid ${BORDER}` }}>
          <div style={{
            width: 68, height: 68, borderRadius: '50%', background: INDIGO,
            color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26, fontWeight: 700, marginBottom: 10,
          }}>
            {profile.name?.[0] || '?'}
          </div>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#0F172A', marginBottom: 2 }}>{profile.name}</div>
          <div style={{ fontSize: 12, color: '#64748B', fontWeight: 500, marginBottom: 8 }}>{profile.role}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
            {(me?.skills ?? []).map(s => (
              <span key={s} style={{ fontSize: 10, background: '#EEF0FE', color: INDIGO, padding: '3px 9px', borderRadius: 20, fontWeight: 600 }}>
                {skillLabels[s] || s}
              </span>
            ))}
          </div>
        </div>

        {/* ビュー情報 — マネージャー権限を持つ人にはマネージャービューへの切替リンクも */}
        <div style={{ background: 'white', marginTop: 10, borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ padding: '10px 16px 4px', fontSize: 11, fontWeight: 700, color: '#64748B', letterSpacing: '0.04em' }}>ビュー</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px 14px' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#3730A3', background: '#EEF0FE', padding: '3px 10px', borderRadius: 10 }}>スタッフビュー</span>
            {me && ['owner', 'admin', 'manager'].includes(me.role) && (
              <Link to={`/${orgId}/manager`} style={{ fontSize: 12, color: INDIGO, textDecoration: 'none', fontWeight: 600, marginLeft: 'auto' }}>
                ↩ マネージャービューに戻る
              </Link>
            )}
          </div>
        </div>

        {!editing ? (
          <>
            {/* View mode */}
            <div style={{ background: 'white', marginTop: 10, borderTop: `1px solid ${BORDER}` }}>
              <div style={{ padding: '10px 16px 4px', fontSize: 11, fontWeight: 700, color: '#64748B', letterSpacing: '0.04em' }}>基本情報</div>
              <InfoRow label="氏名"       value={profile.name} />
              <InfoRow label="役職"       value={profile.role} />
              <InfoRow label="電話番号"   value={profile.phone} />
              <InfoRow label="メール"     value={profile.email} />
            </div>

            <div style={{ background: 'white', marginTop: 10, borderTop: `1px solid ${BORDER}` }}>
              <div style={{ padding: '10px 16px 4px', fontSize: 11, fontWeight: 700, color: '#64748B', letterSpacing: '0.04em' }}>給与・緊急連絡先</div>
              <InfoRow label="時給"       value={`¥${(me?.wage ?? 0).toLocaleString()}/時間`} accent />
              <InfoRow label="振込口座"   value={profile.bank} />
              <InfoRow label="緊急連絡先" value={profile.emergency} />
            </div>

            <div style={{ background: 'white', marginTop: 10, borderTop: `1px solid ${BORDER}` }}>
              <div style={{ padding: '10px 16px 4px', fontSize: 11, fontWeight: 700, color: '#64748B', letterSpacing: '0.04em' }}>雇用情報</div>
              <InfoRow label="雇用形態"   value={me?.type === 'F' ? '正社員' : 'パートタイム'} />
              <InfoRow label="交通費"     value={(me?.transitPerDay ?? 0) > 0 ? `¥${me.transitPerDay.toLocaleString()}/日` : 'なし'} />
            </div>
          </>
        ) : (
          /* Edit mode */
          <div style={{ padding: '16px 16px 4px', background: 'white', marginTop: 10, borderTop: `1px solid ${BORDER}` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', letterSpacing: '0.04em', marginBottom: 14 }}>基本情報を編集</div>
            <Field label="氏名"       value={draft.name}      onChange={update('name')} />
            <Field label="役職"       value={draft.role}      onChange={update('role')} />
            <Field label="電話番号"   value={draft.phone}     onChange={update('phone')} />
            <Field label="メールアドレス" value={draft.email} onChange={update('email')} />
            <Field label="振込口座"   value={draft.bank}      onChange={update('bank')} multiline />
            <Field label="緊急連絡先" value={draft.emergency} onChange={update('emergency')} />
          </div>
        )}

        <div style={{ height: 20 }} />
      </div>

      <EmployeeTabBar base={base} sukima={sukima} />

      {/* Save toast */}
      {showSaved && (
        <div style={{
          position: 'fixed', top: 24, left: '50%', transform: 'translateX(-50%)',
          background: '#065F46', color: 'white', padding: '10px 22px',
          borderRadius: 10, fontSize: 13, fontWeight: 700, zIndex: 100,
          boxShadow: '0 4px 20px rgba(0,0,0,0.22)', whiteSpace: 'nowrap',
        }}>
          ✓ 保存しました
        </div>
      )}
    </>
  )
}
