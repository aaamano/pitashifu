import { useState, useEffect } from 'react'
import { useOrg } from '../../context/OrgContext'
import * as notificationsApi from '../../api/notifications'
import * as employeesApi from '../../api/employees'
import { loadSettings, saveSettings } from '../../api/orgSettings'

const TYPE_CONFIG = {
  submit:    { bg: '#eef2ff', color: '#3730a3', icon: '📝' },
  alert:     { bg: '#fef3c7', color: '#92400e', icon: '⚠️' },
  warning:   { bg: '#fee2e2', color: '#991b1b', icon: '🔴' },
  info:      { bg: '#f0f5f9', color: '#475569', icon: 'ℹ️' },
  reminder:  { bg: '#fef3c7', color: '#92400e', icon: '⏰' },
  confirmed: { bg: '#dcfce7', color: '#065f46', icon: '✅' },
}

const TARGET_OPTIONS = [
  { key: 'all',      label: '全員（org全体）' },
  { key: 'managers', label: 'マネージャー（owner/admin/manager）' },
  { key: 'staff',    label: '従業員（staff のみ）' },
  { key: 'one',      label: '個別スタッフ' },
]

const DEFAULT_RULES = {
  manager: {
    shiftConfirmDeadlineDays: 7,    // シフト確定までの日数 (期間開始の何日前か)
    submitDeadlineReminderDays: 3,  // シフト希望提出締切の何日前にリマインダーを送るか
  },
  employee: {
    submitDeadlineReminderDays: 3,  // 提出期限の何日前にリマインダーを通知するか
    shiftConfirmedNoticeEnabled: true, // 確定したら通知するか
  },
}

export default function ManagerNotifications() {
  const { orgId } = useOrg()
  const [tab, setTab] = useState('send') // 'send' | 'rules'

  // ── 共通 ──
  const [employees, setEmployees] = useState([])
  useEffect(() => {
    if (!orgId) return
    employeesApi.listEmployees(orgId).then(setEmployees).catch(e => console.error('[Notif.loadEmps]', e))
  }, [orgId])

  // ── 手動送信タブ ──
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCompose, setShowCompose] = useState(false)
  const [composeForm, setComposeForm] = useState({ type: 'info', title: '', body: '', target: 'all', individualId: '' })
  const [errMsg, setErrMsg] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    notificationsApi.listNotifications()
      .then(rows => { if (!cancelled) setItems(rows ?? []) })
      .catch(e => { if (!cancelled) { console.error('[Notif.list]', e); setErrMsg(e.message || '読み込みに失敗しました') } })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const markAllRead = async () => {
    const ids = items.filter(n => !n.read).map(n => n.id).filter(id => typeof id === 'string')
    setItems(prev => prev.map(n => ({ ...n, read: true })))
    if (ids.length) { try { await notificationsApi.markAllRead(ids) } catch {} }
  }
  const markRead = async (id) => {
    setItems(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    if (typeof id === 'string') { try { await notificationsApi.markRead(id) } catch {} }
  }
  const unread = items.filter(n => !n.read).length

  const sendNotification = async () => {
    if (!orgId) { setErrMsg('orgIdが取得できません'); return }
    if (!composeForm.title.trim() || !composeForm.body.trim()) {
      setErrMsg('タイトルと本文を入力してください'); return
    }
    setSending(true); setErrMsg('')
    try {
      const recipients = resolveRecipients(composeForm.target, composeForm.individualId, employees)
      const created = []
      // 1人ずつ recipient_id を指定して INSERT
      for (const recipientId of recipients) {
        const c = await notificationsApi.createNotification({
          orgId, recipientId, type: composeForm.type,
          title: composeForm.title, body: composeForm.body,
        })
        created.push(c)
      }
      setItems(prev => [...created, ...prev])
      setShowCompose(false)
      setComposeForm({ type: 'info', title: '', body: '', target: 'all', individualId: '' })
    } catch (e) {
      console.error('[Notif.send]', e)
      setErrMsg(e.message || '送信に失敗しました')
    } finally {
      setSending(false)
    }
  }

  // ── レギュレーション設定タブ ──
  const [rules, setRules]       = useState(DEFAULT_RULES)
  const [rulesSaving, setRSv]   = useState(false)
  const [rulesSaved, setRSved]  = useState(false)
  const [rulesError, setRErr]   = useState('')
  useEffect(() => {
    if (!orgId) return
    loadSettings(orgId).then(s => {
      if (s?.notificationRules) {
        setRules({
          manager:  { ...DEFAULT_RULES.manager,  ...(s.notificationRules.manager || {}) },
          employee: { ...DEFAULT_RULES.employee, ...(s.notificationRules.employee || {}) },
        })
      }
    }).catch(e => console.error('[Notif.loadRules]', e))
  }, [orgId])
  const saveRules = async () => {
    if (!orgId) { setRErr('orgId未取得'); return }
    setRSv(true); setRErr('')
    try {
      const existing = (await loadSettings(orgId)) || {}
      await saveSettings(orgId, { ...existing, notificationRules: rules })
      setRSved(true); setTimeout(() => setRSved(false), 2000)
    } catch (e) {
      console.error('[Notif.saveRules]', e)
      setRErr(e.message || '保存に失敗しました')
    } finally {
      setRSv(false)
    }
  }

  return (
    <div className="mgr-page">
      <div style={{ marginBottom:20 }}>
        <h1 style={{ fontSize:22, fontWeight:700, color:'#0f172a', margin:0 }}>通知</h1>
        <p style={{ fontSize:12, color:'#64748b', marginTop:4 }}>手動送信とレギュレーション設定で通知を管理します</p>
      </div>

      {/* タブ */}
      <div style={{ display:'flex', gap:4, marginBottom:20, background:'#e8edf4', borderRadius:10, padding:4, width:'fit-content' }}>
        {[['send','手動送信'], ['rules','レギュレーション設定']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            padding:'7px 18px', borderRadius:7, fontSize:13, fontWeight: tab === k ? 700 : 500,
            border:'none', cursor:'pointer', fontFamily:'inherit',
            background: tab === k ? 'white' : 'transparent',
            color: tab === k ? '#0f172a' : '#475569',
            boxShadow: tab === k ? '0 1px 3px rgba(15,23,42,0.10)' : 'none',
          }}>{l}</button>
        ))}
      </div>

      {/* 手動送信 */}
      {tab === 'send' && (
        <>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14, flexWrap:'wrap', gap:8 }}>
            <p style={{ fontSize:12, color:'#64748b', margin:0 }}>
              {unread > 0 ? `未読 ${unread}件 / 合計 ${items.length}件` : `すべて既読 / 合計 ${items.length}件`}
            </p>
            <div style={{ display:'flex', gap:8 }}>
              {unread > 0 && (
                <button onClick={markAllRead} className="mgr-btn-secondary" style={{ fontSize:12 }}>すべて既読</button>
              )}
              <button onClick={() => setShowCompose(true)} className="mgr-btn-primary" style={{ fontSize:12 }}>＋ 新規送信</button>
            </div>
          </div>

          {errMsg && (
            <div style={{ marginBottom:14, padding:'10px 14px', background:'#FEE2E2', color:'#991B1B', border:'1px solid #FECACA', borderRadius:8, fontSize:13 }}>
              {errMsg}
            </div>
          )}

          {showCompose && (
            <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100 }} onClick={() => setShowCompose(false)}>
              <div onClick={(e) => e.stopPropagation()} style={{ background:'white', borderRadius:12, padding:24, width:'min(540px,92vw)', boxShadow:'0 20px 50px rgba(15,23,42,0.25)', maxHeight:'90vh', overflowY:'auto' }}>
                <div style={{ fontSize:16, fontWeight:700, color:'#0f172a', marginBottom:16 }}>通知を作成</div>
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  <div>
                    <label className="mgr-label">対象</label>
                    <select value={composeForm.target} onChange={e => setComposeForm(p => ({ ...p, target: e.target.value }))} className="mgr-input">
                      {TARGET_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                    </select>
                  </div>
                  {composeForm.target === 'one' && (
                    <div>
                      <label className="mgr-label">スタッフ選択</label>
                      <select value={composeForm.individualId} onChange={e => setComposeForm(p => ({ ...p, individualId: e.target.value }))} className="mgr-input">
                        <option value="">— 選択してください —</option>
                        {employees.map(e => <option key={e.id} value={e.id}>{e.name}（{e.role}）</option>)}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="mgr-label">種別</label>
                    <select value={composeForm.type} onChange={e => setComposeForm(p => ({ ...p, type: e.target.value }))} className="mgr-input">
                      <option value="info">お知らせ (info)</option>
                      <option value="reminder">リマインダー (reminder)</option>
                      <option value="alert">アラート (alert)</option>
                      <option value="warning">警告 (warning)</option>
                      <option value="submit">提出関連 (submit)</option>
                      <option value="confirmed">確定通知 (confirmed)</option>
                    </select>
                  </div>
                  <div>
                    <label className="mgr-label">タイトル</label>
                    <input className="mgr-input" value={composeForm.title} onChange={e => setComposeForm(p => ({ ...p, title: e.target.value }))} placeholder="例: 5月前半シフトを確定しました" />
                  </div>
                  <div>
                    <label className="mgr-label">本文</label>
                    <textarea className="mgr-input" rows={3} value={composeForm.body} onChange={e => setComposeForm(p => ({ ...p, body: e.target.value }))} placeholder="例: 5月1〜15日のシフトを確定しました。" />
                  </div>
                </div>
                <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:18 }}>
                  <button onClick={() => setShowCompose(false)} className="mgr-btn-secondary">キャンセル</button>
                  <button onClick={sendNotification} disabled={sending} className="mgr-btn-primary">{sending ? '送信中…' : '送信する'}</button>
                </div>
              </div>
            </div>
          )}

          {/* 履歴 */}
          <div className="mgr-card">
            {loading && (
              <div style={{ padding:'48px 24px', textAlign:'center', color:'#94a3b8', fontSize:13 }}>読み込み中…</div>
            )}
            {!loading && items.length === 0 && (
              <div style={{ padding:'48px 24px', textAlign:'center', color:'#94a3b8', fontSize:13 }}>送信履歴はまだありません。「＋ 新規送信」から送信できます。</div>
            )}
            {!loading && items.map((n, i) => {
              const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.info
              return (
                <div key={n.id} onClick={() => markRead(n.id)} style={{
                  display:'flex', alignItems:'flex-start', gap:14, padding:'14px 20px',
                  borderTop: i > 0 ? '1px solid #f0f5f9' : 'none',
                  background: !n.read ? '#f8fbff' : 'white', cursor:'pointer', transition:'background 0.12s',
                }}>
                  <div style={{ width:36, height:36, borderRadius:10, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, background: cfg.bg }}>{cfg.icon}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
                      <p style={{ fontSize:13, lineHeight:1.45, margin:0, fontWeight: !n.read ? 600 : 400, color: !n.read ? '#0f172a' : '#475569' }}>{n.text}</p>
                      {!n.read && <span style={{ width:7, height:7, background:'#4f46e5', borderRadius:'50%', flexShrink:0, marginTop:5 }} />}
                    </div>
                    <p style={{ fontSize:11, color:'#94a3b8', margin:'4px 0 0' }}>{n.sub} · {n.time}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* レギュレーション設定 */}
      {tab === 'rules' && (
        <>
          {rulesError && (
            <div style={{ marginBottom:14, padding:'10px 14px', background:'#FEE2E2', color:'#991B1B', border:'1px solid #FECACA', borderRadius:8, fontSize:13 }}>{rulesError}</div>
          )}

          {/* マネージャー向け */}
          <div className="mgr-card" style={{ padding:24, marginBottom:16 }}>
            <h2 style={{ fontSize:14, fontWeight:600, color:'#0f172a', margin:'0 0 4px' }}>マネージャー向け</h2>
            <p style={{ fontSize:11, color:'#64748b', marginTop:0, marginBottom:16 }}>マネージャーに自動的に届く通知のルール</p>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
              <div>
                <label className="mgr-label">シフト確定までの日数（期間開始の N 日前にアラート）</label>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <input type="number" min={0} max={30} value={rules.manager.shiftConfirmDeadlineDays}
                    onChange={e => setRules(r => ({ ...r, manager: { ...r.manager, shiftConfirmDeadlineDays: Number(e.target.value) } }))}
                    className="mgr-input" style={{ width:90 }} />
                  <span style={{ fontSize:12, color:'#475569' }}>日前</span>
                </div>
              </div>
              <div>
                <label className="mgr-label">シフト希望提出締切リマインダー（N 日前にアラート）</label>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <input type="number" min={0} max={30} value={rules.manager.submitDeadlineReminderDays}
                    onChange={e => setRules(r => ({ ...r, manager: { ...r.manager, submitDeadlineReminderDays: Number(e.target.value) } }))}
                    className="mgr-input" style={{ width:90 }} />
                  <span style={{ fontSize:12, color:'#475569' }}>日前</span>
                </div>
              </div>
            </div>
          </div>

          {/* 従業員向け */}
          <div className="mgr-card" style={{ padding:24, marginBottom:16 }}>
            <h2 style={{ fontSize:14, fontWeight:600, color:'#0f172a', margin:'0 0 4px' }}>従業員向け</h2>
            <p style={{ fontSize:11, color:'#64748b', marginTop:0, marginBottom:16 }}>従業員に自動的に届く通知のルール</p>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
              <div>
                <label className="mgr-label">シフト提出期限の N 日前にリマインダー</label>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <input type="number" min={0} max={30} value={rules.employee.submitDeadlineReminderDays}
                    onChange={e => setRules(r => ({ ...r, employee: { ...r.employee, submitDeadlineReminderDays: Number(e.target.value) } }))}
                    className="mgr-input" style={{ width:90 }} />
                  <span style={{ fontSize:12, color:'#475569' }}>日前</span>
                </div>
              </div>
              <div>
                <label className="mgr-label">シフト確定時に通知する</label>
                <label style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', background:'#f8fafc', borderRadius:8, border:'1px solid #e2e8f0', cursor:'pointer' }}>
                  <button type="button" role="switch" aria-checked={rules.employee.shiftConfirmedNoticeEnabled}
                    onClick={() => setRules(r => ({ ...r, employee: { ...r.employee, shiftConfirmedNoticeEnabled: !r.employee.shiftConfirmedNoticeEnabled } }))}
                    style={{
                      flexShrink:0, width:38, height:20, borderRadius:10, border:'none',
                      background: rules.employee.shiftConfirmedNoticeEnabled ? '#4f46e5' : '#cbd5e1',
                      position:'relative', cursor:'pointer', padding:0,
                    }}>
                    <span style={{ position:'absolute', top:2, left: rules.employee.shiftConfirmedNoticeEnabled ? 20 : 2, width:16, height:16, borderRadius:'50%', background:'white', transition:'left .15s' }} />
                  </button>
                  <span style={{ fontSize:12, color:'#0f172a', fontWeight:600 }}>
                    {rules.employee.shiftConfirmedNoticeEnabled ? '有効' : '無効'}
                  </span>
                </label>
              </div>
            </div>
          </div>

          <div style={{ display:'flex', justifyContent:'flex-end' }}>
            <button onClick={saveRules} disabled={rulesSaving} className="mgr-btn-primary">
              {rulesSaving ? '保存中…' : rulesSaved ? '✓ 保存しました' : 'ルールを保存'}
            </button>
          </div>

          <div style={{ marginTop:16, padding:'14px 18px', background:'#eef0fe', border:'1px solid #c7d2fe', borderRadius:8, fontSize:12, color:'#3730a3' }}>
            💡 ここで設定したルールは <code>organizations.settings.notificationRules</code> に保存されます。実際の自動送信は将来の機能拡張で対応予定です（現状は設定値の保存のみ）。
          </div>
        </>
      )}
    </div>
  )
}

// 対象 → 受信者 employee.id 配列を解決（null は org全員）
function resolveRecipients(target, individualId, employees) {
  if (target === 'all')      return [null]
  if (target === 'managers') return employees.filter(e => ['owner', 'admin', 'manager'].includes(e.role)).map(e => e.id)
  if (target === 'staff')    return employees.filter(e => e.role === 'staff').map(e => e.id)
  if (target === 'one')      return individualId ? [individualId] : []
  return [null]
}
