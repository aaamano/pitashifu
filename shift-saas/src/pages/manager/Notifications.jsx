import { useState, useEffect } from 'react'
import { managerNotifications } from '../../data/mockData'
import { useOrg } from '../../context/OrgContext'
import * as notificationsApi from '../../api/notifications'

const TYPE_CONFIG = {
  submit:  { bg: '#eef2ff', color: '#3730a3', icon: '📝' },
  alert:   { bg: '#fef3c7', color: '#92400e', icon: '⚠️' },
  warning: { bg: '#fee2e2', color: '#991b1b', icon: '🔴' },
  info:    { bg: '#f0f5f9', color: '#475569', icon: 'ℹ️' },
}

export default function ManagerNotifications() {
  const { orgId } = useOrg()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCompose, setShowCompose] = useState(false)
  const [composeForm, setComposeForm] = useState({ type: 'info', title: '', body: '' })
  const [errMsg, setErrMsg] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    notificationsApi.listNotifications()
      .then(rows => { if (!cancelled) setItems(rows ?? []) })
      .catch(e => { if (!cancelled) { console.error('[Notifications.load]', e); setErrMsg(e.message || '読み込みに失敗しました') } })
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
      setErrMsg('タイトルと本文を入力してください')
      return
    }
    setSending(true); setErrMsg('')
    try {
      const created = await notificationsApi.createNotification({
        orgId,
        recipientId: null, // null = org全員宛
        type:        composeForm.type,
        title:       composeForm.title,
        body:        composeForm.body,
      })
      setItems(prev => [created, ...prev])
      setShowCompose(false)
      setComposeForm({ type: 'info', title: '', body: '' })
    } catch (e) {
      setErrMsg(e.message || '送信に失敗しました')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="mgr-page">
      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24, flexWrap:'wrap', gap:10 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, color:'#0f172a', letterSpacing:'-0.01em', margin:0 }}>通知</h1>
          <p style={{ fontSize:12, color:'#64748b', marginTop:4, marginBottom:0 }}>
            {unread > 0 ? `未読 ${unread}件` : 'すべて既読です'}
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {unread > 0 && (
            <button onClick={markAllRead} className="mgr-btn-secondary" style={{ fontSize:12 }}>
              すべて既読にする
            </button>
          )}
          <button onClick={() => setShowCompose(true)} className="mgr-btn-primary" style={{ fontSize:12 }}>
            ＋ 通知を作成
          </button>
        </div>
      </div>

      {errMsg && (
        <div style={{ marginBottom:14, padding:'10px 14px', background:'#FEE2E2', color:'#991B1B', border:'1px solid #FECACA', borderRadius:8, fontSize:13 }}>
          {errMsg}
        </div>
      )}

      {showCompose && (
        <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100 }} onClick={() => setShowCompose(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background:'white', borderRadius:12, padding:24, width:'min(480px,92vw)', boxShadow:'0 20px 50px rgba(15,23,42,0.25)' }}>
            <div style={{ fontSize:16, fontWeight:700, color:'#0f172a', marginBottom:16 }}>通知を作成（org全員宛）</div>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
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
                <textarea className="mgr-input" rows={3} value={composeForm.body} onChange={e => setComposeForm(p => ({ ...p, body: e.target.value }))} placeholder="例: 5月1〜15日のシフトを確定しました。アプリでご確認ください。" />
              </div>
            </div>
            <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:18 }}>
              <button onClick={() => setShowCompose(false)} className="mgr-btn-secondary">キャンセル</button>
              <button onClick={sendNotification} disabled={sending} className="mgr-btn-primary">{sending ? '送信中…' : '送信する'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Notification list */}
      <div className="mgr-card">
        {loading && (
          <div style={{ padding:'48px 24px', textAlign:'center', color:'#94a3b8', fontSize:13 }}>読み込み中…</div>
        )}
        {!loading && items.length === 0 && (
          <div style={{ padding:'48px 24px', textAlign:'center', color:'#94a3b8', fontSize:13 }}>通知はまだありません。「＋ 通知を作成」から作成できます。</div>
        )}
        {!loading && items.map((n, i) => {
          const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.info
          return (
            <div
              key={n.id}
              onClick={() => markRead(n.id)}
              style={{
                display:'flex', alignItems:'flex-start', gap:14,
                padding:'14px 20px',
                borderTop: i > 0 ? '1px solid #f0f5f9' : 'none',
                background: !n.read ? '#f8fbff' : 'white',
                cursor:'pointer',
                transition:'background 0.12s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#f0f5f9'}
              onMouseLeave={e => e.currentTarget.style.background = !n.read ? '#f8fbff' : 'white'}
            >
              {/* Icon */}
              <div style={{
                width:36, height:36, borderRadius:10, flexShrink:0,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:15, background: cfg.bg,
              }}>
                {cfg.icon}
              </div>

              {/* Content */}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
                  <p style={{
                    fontSize:13, lineHeight:1.45, margin:0,
                    fontWeight: !n.read ? 600 : 400,
                    color: !n.read ? '#0f172a' : '#475569',
                  }}>
                    {n.text}
                  </p>
                  {!n.read && (
                    <span style={{ width:7, height:7, background:'#4f46e5', borderRadius:'50%', flexShrink:0, marginTop:5 }} />
                  )}
                </div>
                <p style={{ fontSize:11, color:'#94a3b8', margin:'4px 0 0' }}>
                  {n.sub} · {n.time}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
