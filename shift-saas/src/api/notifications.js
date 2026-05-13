import { supabase } from '../lib/supabase'

// notifications テーブル CRUD
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

export async function listNotifications() {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(toUi)
}

export async function markRead(id) {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', id)
  if (error) throw error
}

export async function markAllRead(ids) {
  if (!ids?.length) return
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .in('id', ids)
  if (error) throw error
}
