import { supabase } from '../lib/supabase'

// organizations.settings (JSONB) の読み書き
// 構造例:
//   {
//     openHour: 9, closeHour: 23, slotInterval: 15, avgProductivity: 8,
//     breakRules: [{ minWorkHours, breakMinutes }],
//     specialTasks: [{ id, name, startTime, endTime, requiredStaff, colorKey, enabled }],
//     skillLabels: { barista: 'バリスタ', cashier: 'レジ', ... },
//     address: '東京都新宿区...'
//   }

export async function loadSettings(orgId) {
  if (!orgId) return null
  const { data, error } = await supabase
    .from('organizations')
    .select('settings, name')
    .eq('id', orgId)
    .maybeSingle()
  if (error) throw error
  return data?.settings ?? {}
}

export async function saveSettings(orgId, settings) {
  if (!orgId) throw new Error('orgId is required')
  const { error } = await supabase
    .from('organizations')
    .update({ settings })
    .eq('id', orgId)
  if (error) throw error
}
