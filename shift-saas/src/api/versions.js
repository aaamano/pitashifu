import { supabase } from '../lib/supabase'

// shift_versions テーブル CRUD
// マッピング: DB列 → UI表示
//   created_at  → createdAt（フォーマット済み文字列）
//   updated_at  → updatedAt
//   author_id   → author（employees.name を埋め込みで取得）

function pad(n) { return String(n).padStart(2, '0') }

function fmtTs(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function toUi(row) {
  return {
    id:        row.id,
    name:      row.name,
    status:    row.status,
    createdAt: fmtTs(row.created_at),
    updatedAt: fmtTs(row.updated_at),
    author:    row.author?.name ?? '—',
    storeId:   row.store_id,
    periodId:  row.period_id,
  }
}

export async function listVersions(storeId) {
  if (!storeId) return []
  const { data, error } = await supabase
    .from('shift_versions')
    .select('*, author:employees!shift_versions_author_id_fkey(name)')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(toUi)
}

export async function createVersion({ storeId, name }) {
  // author_id = 現在のログインユーザーの employees.id
  const { data: { user } } = await supabase.auth.getUser()
  const { data: me } = await supabase
    .from('employees')
    .select('id')
    .eq('auth_user_id', user?.id ?? '')
    .maybeSingle()
  const { data, error } = await supabase
    .from('shift_versions')
    .insert({
      store_id:  storeId,
      name,
      status:    'draft',
      author_id: me?.id ?? null,
    })
    .select('*, author:employees!shift_versions_author_id_fkey(name)')
    .single()
  if (error) throw error
  return toUi(data)
}

export async function updateVersion(id, patch) {
  // UI側のフィールド名をDB側に変換
  const dbPatch = {}
  if (patch.name   !== undefined) dbPatch.name   = patch.name
  if (patch.status !== undefined) dbPatch.status = patch.status
  const { data, error } = await supabase
    .from('shift_versions')
    .update(dbPatch)
    .eq('id', id)
    .select('*, author:employees!shift_versions_author_id_fkey(name)')
    .single()
  if (error) throw error

  // status='confirmed' に変更したら org全員に通知
  if (patch.status === 'confirmed' && data.store_id) {
    try {
      // store_id から company の org_id を引く
      const { data: store } = await supabase
        .from('organizations')
        .select('parent_id, name')
        .eq('id', data.store_id)
        .maybeSingle()
      const orgId = store?.parent_id ?? data.store_id
      await supabase.from('notifications').insert({
        org_id:       orgId,
        recipient_id: null,
        type:         'confirmed',
        title:        `シフトが確定しました: ${data.name}`,
        body:         `${store?.name ?? ''} のシフトバージョン「${data.name}」が確定しました。`,
        read:         false,
      })
    } catch (e) {
      console.error('[versions.updateVersion.notify]', e)
    }
  }

  return toUi(data)
}

export async function deleteVersion(id) {
  const { error } = await supabase
    .from('shift_versions')
    .delete()
    .eq('id', id)
  if (error) throw error
}
