import { supabase } from '../lib/supabase'

// daily_targets テーブル CRUD
// プロトタイプは「day 1〜30 + YEAR_MONTH」で扱うため、(year, month, day) ↔ date 変換を行う

const pad = (n) => String(n).padStart(2, '0')
const toDate = (year, month, day) => `${year}-${pad(month)}-${pad(day)}`

function rowToUi(row, dayOfMonth) {
  return {
    day:          dayOfMonth,
    sales:        row.sales_target,
    customers:    row.customers_target,
    avgSpend:     row.avg_spend,
    orders:       row.orders_target,
    laborCost:    row.labor_cost_target,
    salesPattern: row.sales_pattern,
  }
}

export async function loadTargets({ storeId, year, month }) {
  if (!storeId) return []
  const from = toDate(year, month, 1)
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear  = month === 12 ? year + 1 : year
  const to = toDate(nextYear, nextMonth, 1)
  const { data, error } = await supabase
    .from('daily_targets')
    .select('*')
    .eq('store_id', storeId)
    .gte('date', from)
    .lt('date', to)
  if (error) { console.error('[targets.loadTargets]', error); throw error }
  return (data ?? []).map(r => rowToUi(r, parseInt(r.date.slice(8, 10), 10)))
}

export async function saveTargets({ storeId, year, month, targets }) {
  if (!storeId) throw new Error('storeId is required')
  const rows = targets.map(t => ({
    store_id:          storeId,
    date:              toDate(year, month, t.day),
    sales_target:      Math.round(t.sales || 0),
    customers_target:  Math.round(t.customers || 0),
    avg_spend:         Math.round(t.avgSpend || 0),
    orders_target:     Math.round(t.orders || 0),
    labor_cost_target: Math.round(t.laborCost || 0),
    sales_pattern:     t.salesPattern ?? 'weekday1',
  }))
  const { data, error } = await supabase
    .from('daily_targets')
    .upsert(rows, { onConflict: 'store_id,date' })
    .select()
  if (error) { console.error('[targets.saveTargets]', error, 'rows=', rows); throw error }
  return data
}
