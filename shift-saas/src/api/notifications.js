import { supabase } from '../lib/supabase'

// notifications テーブル CRUD + notification_reads でユーザーごとの既読管理
// RLSにより自分宛(recipient_id=自分) または org全体宛(recipient_id=NULL) のみ参照可
// DB列 → UI:
//   title → text
//   body  → sub
//   created_at → time（相対表示）

function relativeTime(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)   return 'たった今'
  if (m < 60)  return `${m}分前`
  const h = Math.floor(m / 60)
  if (h < 24)  return `${h}時間前`
  const d = Math.floor(h / 24)
  if (d < 7)   return `${d}日前`
  const dt = new Date(iso)
  return `${dt.getMonth() + 1}/${dt.getDate()}`
}

function toUi(row) {
  return {
    id:   row.id,
    type: row.type,
    text: row.title,
    sub:  row.body,
    time: relativeTime(row.created_at),
    read: row.read,
    createdAt: row.created_at,
  }
}

// 現在ログイン中ユーザーの employees.id を取得（既読操作で必要）
async function currentEmployeeId() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('employees')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  return data?.id ?? null
}

export async function listNotifications() {
  // 通知本体 + 自分の既読履歴を並列取得
  const [{ data: notifs, error: e1 }, { data: reads, error: e2 }] = await Promise.all([
    supabase.from('notifications').select('*').order('created_at', { ascending: false }),
    supabase.from('notification_reads').select('notification_id'),
  ])
  if (e1) { console.error('[notifications.list]', e1); throw e1 }
  if (e2) { console.error('[notifications.list.reads]', e2); throw e2 }
  const readIds = new Set((reads ?? []).map(r => r.notification_id))
  return (notifs ?? []).map(row => ({
    ...toUi(row),
    read: row.read || readIds.has(row.id),
  }))
}

export async function markRead(id) {
  if (!id) return
  const empId = await currentEmployeeId()
  if (!empId) return
  const { error } = await supabase
    .from('notification_reads')
    .upsert({
      notification_id: id,
      employee_id:     empId,
      read_at:         new Date().toISOString(),
    }, { onConflict: 'notification_id,employee_id' })
  if (error) { console.error('[notifications.markRead]', error); throw error }
}

export async function markAllRead(ids) {
  if (!ids?.length) return
  const empId = await currentEmployeeId()
  if (!empId) return
  const nowIso = new Date().toISOString()
  const rows = ids.map(id => ({
    notification_id: id,
    employee_id:     empId,
    read_at:         nowIso,
  }))
  const { error } = await supabase
    .from('notification_reads')
    .upsert(rows, { onConflict: 'notification_id,employee_id' })
  if (error) { console.error('[notifications.markAllRead]', error); throw error }
}

// マネージャーが通知を作成
// recipientId が null なら org 全体宛
export async function createNotification({ orgId, recipientId, type, title, body }) {
  if (!orgId) throw new Error('orgId is required')
  const payload = {
    org_id:       orgId,
    recipient_id: recipientId ?? null,
    type:         type || 'info',
    title:        title || '',
    body:         body  || '',
    read:         false,
  }
  const { data, error } = await supabase
    .from('notifications')
    .insert(payload)
    .select()
    .single()
  if (error) { console.error('[notifications.create]', error, payload); throw error }
  return toUi(data)
}
