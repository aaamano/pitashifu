import { supabase } from '../lib/supabase'

// employees テーブル CRUD
// UI <-> DB マッピング:
//   name              <-> name (lastName + ' ' + firstName を組み立て)
//   type ('F'|'P')    <-> employment_type ('full_time'|'part_time')
//   transitPerDay     <-> transit_per_day
//   hourlyOrders      <-> hourly_orders
//   retentionPriority <-> retention_priority
//   targetEarnings    <-> target_earnings

function toUi(row) {
  return {
    id:                 row.id,
    orgId:              row.org_id,
    authUserId:         row.auth_user_id,
    name:               row.name,
    email:              row.email,
    role:               row.role,
    type:               row.employment_type === 'full_time' ? 'F' : 'P',
    wage:               row.wage,
    transitPerDay:      row.transit_per_day,
    skills:             row.skills || [],
    hourlyOrders:       row.hourly_orders,
    retentionPriority:  row.retention_priority,
    targetEarnings:     row.target_earnings,
    phone:              row.phone,
    emergencyContact:   row.emergency_contact,
    bankInfo:           row.bank_info,
    employmentStart:    row.employment_start,
    fixedShift:         row.fixed_shift || {},
  }
}

// DB制約 (role IN ('owner','admin','manager','staff')) に合わせて正規化
function normalizeRole(value) {
  const v = String(value ?? '').trim().toLowerCase()
  if (['owner', 'admin', 'manager', 'staff'].includes(v)) return v
  // 日本語表記からのマッピング
  const ja = String(value ?? '').trim()
  if (['オーナー', 'owner'].includes(ja)) return 'owner'
  if (['管理者', '管理者(admin)', 'admin'].includes(ja)) return 'admin'
  if (['マネージャー', '店長', '副店長', 'manager'].includes(ja)) return 'manager'
  // 上記以外 (例: 'スタッフ', '', null) は全て staff として扱う
  return 'staff'
}

function toDb(ui, orgId) {
  const row = {
    name:               ui.name,
    email:              ui.email || '',
    role:               normalizeRole(ui.role),
    employment_type:    ui.type === 'F' ? 'full_time' : 'part_time',
    wage:               Number(ui.wage)               || 1050,
    transit_per_day:    Number(ui.transitPerDay)      || 0,
    skills:             Array.isArray(ui.skills) ? ui.skills : [],
    hourly_orders:      Number(ui.hourlyOrders)       || 8,
    retention_priority: Number(ui.retentionPriority)  || 5,
    target_earnings:    Number(ui.targetEarnings)     || 0,
    phone:              ui.phone || null,
  }
  // fixed_shift は migration 004 が必要。
  // ブランクな blankFixedShift() (全曜日 enabled:false) は実データ無しと見なし送らない。
  // 実際に enabled になっている曜日があるときだけ送信する。
  if (hasEnabledFixedShift(ui.fixedShift)) {
    row.fixed_shift = ui.fixedShift
  }
  if (orgId) row.org_id = orgId
  return row
}

function hasEnabledFixedShift(fs) {
  if (!fs || typeof fs !== 'object') return false
  return Object.values(fs).some(v => v && typeof v === 'object' && v.enabled === true)
}

export async function listEmployees(orgId) {
  if (!orgId) return []
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: true })
  if (error) { console.error('[employees.list]', error); throw error }
  return (data ?? []).map(toUi)
}

export async function createEmployee({ orgId, ui }) {
  const payload = toDb(ui, orgId)
  const { data, error } = await supabase
    .from('employees')
    .insert(payload)
    .select()
    .single()
  if (error) { console.error('[employees.create]', error, 'payload=', payload); throw error }
  return toUi(data)
}

export async function updateEmployee(id, ui) {
  const payload = toDb(ui)
  const { data, error } = await supabase
    .from('employees')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  if (error) { console.error('[employees.update]', error, 'id=', id, 'payload=', payload); throw error }
  return toUi(data)
}

export async function deleteEmployee(id) {
  const { error } = await supabase
    .from('employees')
    .delete()
    .eq('id', id)
  if (error) { console.error('[employees.delete]', error, 'id=', id); throw error }
}

// Bulk upsert by name within orgId — CSV/Excelからの一括反映用
export async function bulkUpsertByName({ orgId, items }) {
  if (!orgId) throw new Error('orgId is required')
  if (!items?.length) return { inserted: 0, updated: 0 }
  // 1) 既存社員を取得
  const { data: existing, error: e1 } = await supabase
    .from('employees')
    .select('id, name')
    .eq('org_id', orgId)
  if (e1) { console.error('[employees.bulkUpsert.fetch]', e1); throw e1 }
  const byName = new Map((existing ?? []).map(r => [r.name, r.id]))
  let inserted = 0, updated = 0
  for (const ui of items) {
    const payload = toDb(ui, orgId)
    if (byName.has(ui.name)) {
      const id = byName.get(ui.name)
      const { error } = await supabase
        .from('employees')
        .update(payload)
        .eq('id', id)
      if (error) { console.error('[employees.bulkUpsert.update]', error, payload); throw error }
      updated++
    } else {
      const { error } = await supabase
        .from('employees')
        .insert(payload)
      if (error) { console.error('[employees.bulkUpsert.insert]', error, payload); throw error }
      inserted++
    }
  }
  return { inserted, updated }
}
