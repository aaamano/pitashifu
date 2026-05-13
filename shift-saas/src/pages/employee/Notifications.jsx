import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { employeeNotifications } from '../../data/mockData'
import EmployeeTabBar from '../../components/EmployeeTabBar'
import * as notificationsApi from '../../api/notifications'

const TYPE_CONFIG = {
  reminder:  { bg: 'bg-amber-100',   icon: '⏰', label: 'リマインダー' },
  confirmed: { bg: 'bg-emerald-100', icon: '✅', label: '確定通知' },
  info:      { bg: 'bg-slate-100',   icon: 'ℹ️', label: 'お知らせ' },
}

export default function EmployeeNotifications({ base: baseProp, sukima = false }) {
  const { orgId } = useParams()
  const base = baseProp ?? `/${orgId}/employee`
  const [items, setItems] = useState(employeeNotifications)

  useEffect(() => {
    let cancelled = false
    notificationsApi.listNotifications()
      .then(rows => { if (!cancelled && rows.length) setItems(rows) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const markRead = async (id) => {
    setItems(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    if (typeof id === 'string') { try { await notificationsApi.markRead(id) } catch {} }
  }
  const markAllRead = async () => {
    const ids = items.filter(n => !n.read).map(n => n.id).filter(id => typeof id === 'string')
    setItems(prev => prev.map(n => ({ ...n, read: true })))
    if (ids.length) { try { await notificationsApi.markAllRead(ids) } catch {} }
  }
  const unread = items.filter(n => !n.read).length

  return (
    <>
      <div className="pita-phone-header">
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:14, fontWeight:700, color:'var(--pita-text)' }}>通知</div>
          <div style={{ fontSize:10, color:'var(--pita-muted)', marginTop:1 }}>
            {unread > 0 ? `未読 ${unread}件` : 'すべて既読'}
          </div>
        </div>
        {unread > 0 && (
          <button onClick={markAllRead}
            style={{ fontSize:11, color:'var(--pita-accent)', background:'none', border:'none', cursor:'pointer', fontWeight:600 }}>
            すべて既読
          </button>
        )}
      </div>

      <div className="pita-phone-body">
        <div style={{ padding:'6px 0' }}>
          {items.length === 0 && (
            <div style={{ textAlign:'center', padding:'40px 16px', color:'var(--pita-faint)', fontSize:12 }}>
              通知はありません
            </div>
          )}
          {items.map(n => {
            const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.info
            return (
              <div
                key={n.id}
                onClick={() => markRead(n.id)}
                style={{
                  display:'flex', alignItems:'flex-start', gap:10,
                  padding:'13px 14px',
                  borderBottom:'1px solid var(--pita-border)',
                  background: !n.read ? '#eef2ff' : 'var(--pita-bg)',
                  cursor:'pointer', minHeight:56,
                  WebkitTapHighlightColor:'rgba(91,103,248,0.08)',
                }}
              >
                <div style={{
                  width:34, height:34, borderRadius:'50%', flexShrink:0,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:16, background: !n.read ? 'white' : 'var(--pita-bg-subtle)',
                  boxShadow: !n.read ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                }}>
                  {cfg.icon}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:6 }}>
                    <p style={{
                      fontSize:12, lineHeight:1.4, margin:0,
                      fontWeight: !n.read ? 700 : 400,
                      color: !n.read ? 'var(--pita-text)' : 'var(--pita-muted)',
                    }}>
                      {n.text}
                    </p>
                    {!n.read && (
                      <span style={{ width:7, height:7, background:'#5B67F8', borderRadius:'50%', flexShrink:0, marginTop:4 }} />
                    )}
                  </div>
                  <p style={{ fontSize:10, color:'var(--pita-faint)', margin:'3px 0 0' }}>
                    {n.sub} · {n.time}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <EmployeeTabBar base={base} active="notifications" sukima={sukima} />
    </>
  )
}
