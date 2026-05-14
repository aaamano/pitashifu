import { supabase } from '../lib/supabase'

// shifts テーブル CRUD（version単位のbulk replace）
// プロトタイプの assigned[day][slot] = [empId, ...] 形式 ↔ DBの正規化された shifts 行

const pad = (n) => String(n).padStart(2, '0')

// CLAUDE.md: 2026年4月固定
const TARGET_YEAR  = 2026
const TARGET_MONTH = 4

function dayToDate(day) {
  return `${TARGET_YEAR}-${pad(TARGET_MONTH)}-${pad(day)}`
}
function dateToDay(dateStr) {
  return parseInt(dateStr.slice(8, 10), 10)
}

function slotToHour(slot) {
  return parseInt(slot.split(':')[0], 10)
}

// [9,10,11,13,14] → [[9,12],[13,15]]
function mergeContiguous(hours) {
  const sorted = [...hours].sort((a, b) => a - b)
  const result = []
  if (!sorted.length) return result
  let start = sorted[0]
  let prev  = sorted[0]
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === prev + 1) prev = sorted[i]
    else { result.push([start, prev + 1]); start = sorted[i]; prev = sorted[i] }
  }
  result.push([start, prev + 1])
  return result
}

// UUID判定（プロトタイプの整数IDを除外するため）
function isUuid(v) {
  return typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v)
}

// 指定日付範囲のshiftsを assigned[dayOfMonth][slot]=[empId,...] 形式で返す
// （version不問。Payroll/Dashboard で月単位のフィルタに使う）
export async function loadShiftsByDateRange({ storeId, dateFrom, dateTo }) {
  if (!storeId) return {}
  const { data, error } = await supabase
    .from('shifts')
    .select('*')
    .eq('store_id', storeId)
    .gte('date', dateFrom)
    .lte('date', dateTo)
  if (error) { console.error('[shifts.loadByDateRange]', error); throw error }
  const out = {}
  for (const row of data ?? []) {
    const day = parseInt(row.date.slice(8, 10), 10)
    const sh  = parseInt(row.start_time.slice(0, 2), 10)
    const eh  = parseInt(row.end_time.slice(0, 2), 10)
    for (let h = sh; h < eh; h++) {
      const slot = `${h}:00`
      ;(out[day] ||= {})[slot] ||= []
      out[day][slot].push(row.employee_id)
    }
  }
  return out
}

export async function loadAssignments({ versionId }) {
  if (!versionId) return {}
  const { data, error } = await supabase
    .from('shifts')
    .select('*')
    .eq('version_id', versionId)
  if (error) throw error

  const assigned = {}
  for (const row of data ?? []) {
    const day = dateToDay(row.date)
    // DB は HH:MM(:SS) で保存されているので分まで読む
    const [sh, sm = '00'] = (row.start_time || '0:0').split(':')
    const [eh, em = '00'] = (row.end_time   || '0:0').split(':')
    const startMin = parseInt(sh, 10) * 60 + parseInt(sm, 10)
    const endMin   = parseInt(eh, 10) * 60 + parseInt(em, 10)
    // 15 分ごとのスロット全てに employee_id を展開
    for (let min = startMin; min < endMin; min += 15) {
      const h = Math.floor(min / 60)
      const m = min % 60
      const slot = `${h}:${m === 0 ? '00' : m < 10 ? '0' + m : m}`
      ;(assigned[day] ||= {})[slot] ||= []
      assigned[day][slot].push(row.employee_id)
    }
  }
  return assigned
}

export async function saveAssignments({ versionId, storeId, assignedByDay }) {
  if (!versionId) throw new Error('versionId is required')
  if (!storeId)   throw new Error('storeId is required')

  // 既存のshiftsを全削除（このversion限定）
  const { error: delErr } = await supabase
    .from('shifts')
    .delete()
    .eq('version_id', versionId)
  if (delErr) throw delErr

  // assigned → 行配列に変換（UUIDのempIdのみ採用）
  const rows = []
  let skippedNonUuid = 0
  for (const dayKey of Object.keys(assignedByDay || {})) {
    const day = parseInt(dayKey, 10)
    if (!day) continue
    const slots = assignedByDay[dayKey] || {}
    // empId → Set<hour>
    const empHours = {}
    for (const slot of Object.keys(slots)) {
      const h = slotToHour(slot)
      if (Number.isNaN(h)) continue
      for (const empId of slots[slot] || []) {
        if (!isUuid(empId)) { skippedNonUuid++; continue }
        ;(empHours[empId] ||= new Set()).add(h)
      }
    }
    for (const empId of Object.keys(empHours)) {
      const ranges = mergeContiguous([...empHours[empId]])
      for (const [start, end] of ranges) {
        rows.push({
          version_id:  versionId,
          store_id:    storeId,
          employee_id: empId,
          date:        dayToDate(day),
          start_time:  `${pad(start)}:00:00`,
          end_time:    `${pad(end)}:00:00`,
          status:      'draft',
          is_open:     false,
        })
      }
    }
  }

  if (rows.length) {
    const { error } = await supabase
      .from('shifts')
      .insert(rows)
    if (error) throw error
  }

  return { saved: rows.length, skippedNonUuid }
}
