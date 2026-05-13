import { supabase } from '../lib/supabase'

// staff_incompatibilities テーブル CRUD
// employeeId とその「相性NGリスト」の同期保存

export async function listIncompatibilities(orgId) {
  if (!orgId) return []
  // org内のemployeesに紐づくincompatibilitiesを取得
  const { data, error } = await supabase
    .from('staff_incompatibilities')
    .select('*, employee:employees!staff_incompatibilities_employee_id_fkey(org_id)')
  if (error) { console.error('[incompat.list]', error); throw error }
  return (data ?? [])
    .filter(r => r.employee?.org_id === orgId)
    .map(r => ({
      id:               r.id,
      employeeId:       r.employee_id,
      incompatibleWith: r.incompatible_with,
      severity:         r.severity,
    }))
}

// employeeId の incompatible リストを完全置換
// items: [{ incompatibleWith: UUID, severity: 1|2|3 }, ...]
export async function setIncompatibilities(employeeId, items) {
  if (!employeeId) throw new Error('employeeId is required')
  // 既存削除
  const { error: delErr } = await supabase
    .from('staff_incompatibilities')
    .delete()
    .eq('employee_id', employeeId)
  if (delErr) { console.error('[incompat.delete]', delErr); throw delErr }
  if (!items?.length) return
  const rows = items.map(it => ({
    employee_id:       employeeId,
    incompatible_with: it.incompatibleWith,
    severity:          it.severity ?? 1,
  }))
  const { error } = await supabase
    .from('staff_incompatibilities')
    .insert(rows)
  if (error) { console.error('[incompat.insert]', error, rows); throw error }
}
