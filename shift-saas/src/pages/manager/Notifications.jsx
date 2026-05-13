import { useState, useEffect } from 'react'
import { managerNotifications } from '../../data/mockData'
import * as notificationsApi from '../../api/notifications'

const TYPE_CONFIG = {
  submit:  { bg: '#eef2ff', color: '#3730a3', icon: '📝' },
  alert:   { bg: '#fef3c7', color: '#92400e', icon: '⚠️' },
  warning: { bg: '#fee2e2', color: '#991b1b', icon: '🔴' },
  info:    { bg: '#f0f5f9', color: '#475569', icon: 'ℹ️' },
}

export default function ManagerNotifications() {
  const [items, setItems] = useState(managerNotifications)

  useEffect(() => {
    let cancelled = false
    notificationsApi.listNotifications()
      .then(rows => { if (!cancelled && rows.length) setItems(rows) })
      .catch(() => {})
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

  return (
    <div className="mgr-page">
      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, color:'#0f172a', letterSpacing:'-0.01em', margin:0 }}>通知</h1>
          <p style={{ fontSize:12, color:'#64748b', marginTop:4, marginBottom:0 }}>
            {unread > 0 ? `未読 ${unread}件` : 'すべて既読です'}
          </p>
        </div>
        {unread > 0 && (
          <button onClick={markAllRead} className="mgr-btn-secondary" style={{ fontSize:12 }}>
            すべて既読にする
          </button>
        )}
      </div>

      {/* Notification list */}
      <div className="mgr-card">
        {items.length === 0 && (
          <div style={{ padding:'48px 24px', textAlign:'center', color:'#94a3b8', fontSize:13 }}>通知はありません</div>
        )}
        {items.map((n, i) => {
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
