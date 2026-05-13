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
    role:               row.role, // 'owner'|'admin'|'manager'|'staff'
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
  }
}

function toDb(ui, orgId) {
  const row = {
    name:               ui.name,
    email:              ui.email || '',
    role:               ui.role || 'staff',
    employment_type:    ui.type === 'F' ? 'full_time' : 'part_time',
    wage:               Number(ui.wage)               || 1050,
    transit_per_day:    Number(ui.transitPerDay)      || 0,
    skills:             Array.isArray(ui.skills) ? ui.skills : [],
    hourly_orders:      Number(ui.hourlyOrders)       || 8,
    retention_priority: Number(ui.retentionPriority)  || 5,
    target_earnings:    Number(ui.targetEarnings)     || 0,
    phone:              ui.phone || null,
  }
  if (orgId) row.org_id = orgId
  return row
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
