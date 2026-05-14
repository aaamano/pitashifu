import { supabase } from '../lib/supabase'

// invitations テーブル CRUD + accept/preview RPC
// マネージャー以上のみ作成・管理可能。RLS で org スコープ。

// 招待 URL を組み立てる
export function inviteUrlFor(token) {
  if (!token) return ''
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}/invite/${token}`
}

// 作成
// payload: { orgId, role, storeIds=[], email=null, nameHint=null, expiresInDays=14 }
export async function createInvitation({ orgId, role, storeIds = [], email = null, nameHint = null, expiresInDays = 14 }) {
  if (!orgId)  throw new Error('orgId is required')
  if (!role)   throw new Error('role is required')
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
  const payload = {
    org_id:     orgId,
    role,
    store_ids:  Array.isArray(storeIds) ? storeIds : [],
    email:      email ? email.trim().toLowerCase() : null,
    name_hint:  nameHint?.trim() || null,
    expires_at: expiresAt,
  }
  const { data, error } = await supabase
    .from('invitations')
    .insert(payload)
    .select('id, token, org_id, role, store_ids, email, name_hint, expires_at, used_at, revoked_at, created_at')
    .single()
  if (error) { console.error('[invitations.create]', error, payload); throw error }
  return { ...data, url: inviteUrlFor(data.token) }
}

// 一覧（自分の org のみ、新しい順）
export async function listInvitations(orgId) {
  if (!orgId) return []
  const { data, error } = await supabase
    .from('invitations')
    .select('id, token, org_id, role, store_ids, email, name_hint, expires_at, used_at, revoked_at, created_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
  if (error) { console.error('[invitations.list]', error); throw error }
  return (data ?? []).map(r => ({ ...r, url: inviteUrlFor(r.token) }))
}

// 取消（論理削除）
export async function revokeInvitation(id) {
  if (!id) return
  const { error } = await supabase
    .from('invitations')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
  if (error) { console.error('[invitations.revoke]', error, id); throw error }
}

// 未認証OK: トークンから招待のプレビュー情報を取得
export async function previewInvitation(token) {
  if (!token) return null
  const { data, error } = await supabase.rpc('preview_invitation', { p_token: token })
  if (error) { console.error('[invitations.preview]', error); throw error }
  return data
}

// 認証済みユーザーが招待を受諾する
export async function acceptInvitation(token) {
  if (!token) throw new Error('token is required')
  const { data, error } = await supabase.rpc('accept_invitation', { p_token: token })
  if (error) { console.error('[invitations.accept]', error); throw error }
  return data  // { org_id, role }
}
