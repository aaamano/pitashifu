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
  if (error) throw error
  return (data ?? []).map(toUi)
}

export async function createEmployee({ orgId, ui }) {
  const { data, error } = await supabase
    .from('employees')
    .insert(toDb(ui, orgId))
    .select()
    .single()
  if (error) throw error
  return toUi(data)
}

export async function updateEmployee(id, ui) {
  const { data, error } = await supabase
    .from('employees')
    .update(toDb(ui))
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return toUi(data)
}

export async function deleteEmployee(id) {
  const { error } = await supabase
    .from('employees')
    .delete()
    .eq('id', id)
  if (error) throw error
}
