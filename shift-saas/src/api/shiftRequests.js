import { supabase } from '../lib/supabase'

// シフト希望提出 (shift_requests) + 期間管理 (shift_periods)
// プロトタイプは shiftRow（コード配列）で扱うため、index <-> date 変換を行う

const pad = (n) => String(n).padStart(2, '0')

// '2026年4月 前半' などをパース
export function parsePeriodName(name) {
  const m = name?.match(/(\d{4})年(\d{1,2})月\s*(前半|後半)/)
  if (!m) return null
  return {
    year:  parseInt(m[1]),
    month: parseInt(m[2]),
    half:  m[3] === '前半' ? 'first' : 'second',
  }
}

export function periodDateRange({ year, month, half }) {
  const lastDay = new Date(year, month, 0).getDate()
  const startDay = half === 'first' ? 1 : 16
  const endDay   = half === 'first' ? 15 : lastDay
  return {
    period_start: `${year}-${pad(month)}-${pad(startDay)}`,
    period_end:   `${year}-${pad(month)}-${pad(endDay)}`,
  }
}

// 「コード文字列 ↔ 開始/終了時刻」変換
export function parseCode(code) {
  if (!code || code === 'X') return null
  if (code === 'F') return { start: 9, end: 18 }
  const m = code.match(/^O-(\d+(?:\.\d+)?)$/)
  if (m) return { start: 9, end: parseFloat(m[1]) }
  const m2 = code.match(/^(\d+(?:\.\d+)?)[.-](\d+(?:\.\d+)?|L)$/)
  if (m2) return { start: parseFloat(m2[1]), end: m2[2] === 'L' ? 22 : parseFloat(m2[2]) }
  return null
}

function toCode(sh, eh) {
  if (sh === 9 && eh === 18) return 'F'
  if (sh === 9)  return `O-${eh}`
  if (eh === 22) return `${sh}-L`
  return `${sh}-${eh}`
}

function hhmm(h) {
  const hh = Math.floor(h)
  const mm = Math.round((h - hh) * 60)
  return `${pad(hh)}:${pad(mm)}:00`
}

async function getMyEmployeeId() {
  const { data } = await supabase
    .from('employees')
    .select('id')
    .maybeSingle()
  return data?.id ?? null
}

export async function findOrCreatePeriod({ storeId, periodName }) {
  // 既存のperiodを名前で検索
  const { data: existing } = await supabase
    .from('shift_periods')
    .select('*')
    .eq('store_id', storeId)
    .eq('name', periodName)
    .maybeSingle()
  if (existing) return existing

  const parsed = parsePeriodName(periodName)
  if (!parsed) throw new Error(`期間名の形式が不正: ${periodName}`)
  const range = periodDateRange(parsed)

  // 仮の締め切り = 期間開始の1週間前
  const startDate = new Date(`${range.period_start}T00:00:00Z`)
  const deadline = new Date(startDate)
  deadline.setUTCDate(deadline.getUTCDate() - 7)

  const { data, error } = await supabase
    .from('shift_periods')
    .insert({
      store_id:            storeId,
      name:                periodName,
      period_start:        range.period_start,
      period_end:          range.period_end,
      submission_deadline: deadline.toISOString(),
      status:              'open',
    })
    .select()
    .single()
  if (error) throw error
  return data
}

// マネージャー向け: ストア内の全社員のシフト希望提出を期間ごとにまとめて取得
// 戻り値: [{ period: { id, name, period_start, period_end }, requests: [{ employeeId, employeeName, date, preferredStart, preferredEnd, isAvailable, status }] }, ...]
export async function listAllSubmissions({ storeId }) {
  if (!storeId) return []
  const { data: periods, error: pErr } = await supabase
    .from('shift_periods')
    .select('*')
    .eq('store_id', storeId)
    .order('period_start', { ascending: false })
  if (pErr) { console.error('[shiftRequests.listAll.periods]', pErr); throw pErr }
  if (!periods?.length) return []

  const periodIds = periods.map(p => p.id)
  const { data: reqs, error: rErr } = await supabase
    .from('shift_requests')
    .select('*, employee:employees!shift_requests_employee_id_fkey(id, name)')
    .in('period_id', periodIds)
    .order('date', { ascending: true })
  if (rErr) { console.error('[shiftRequests.listAll.reqs]', rErr); throw rErr }

  // periodごとにグルーピング
  const byPeriod = {}
  for (const r of reqs ?? []) {
    (byPeriod[r.period_id] ||= []).push({
      employeeId:     r.employee_id,
      employeeName:   r.employee?.name ?? '—',
      date:           r.date,
      preferredStart: r.preferred_start,
      preferredEnd:   r.preferred_end,
      isAvailable:    r.is_available,
      status:         r.status,
      note:           r.note,
      submittedAt:    r.submitted_at,
    })
  }
  return periods.map(p => ({
    period: { id: p.id, name: p.name, periodStart: p.period_start, periodEnd: p.period_end, status: p.status },
    requests: byPeriod[p.id] ?? [],
  }))
}

export async function listSubmissions({ storeId }) {
  if (!storeId) return []
  const myId = await getMyEmployeeId()
  if (!myId) return []

  // ストア内の全期間を取得
  const { data: periods, error: pErr } = await supabase
    .from('shift_periods')
    .select('*')
    .eq('store_id', storeId)
    .order('period_start', { ascending: false })
  if (pErr) throw pErr
  if (!periods?.length) return []

  // 自分のすべてのrequestsを一度に取得
  const { data: reqs, error: rErr } = await supabase
    .from('shift_requests')
    .select('*')
    .eq('employee_id', myId)
    .in('period_id', periods.map(p => p.id))
    .order('date', { ascending: true })
  if (rErr) throw rErr

  // period_id ごとにグループ化して shiftRow を組み立て
  const byPeriod = {}
  for (const r of reqs ?? []) {
    (byPeriod[r.period_id] ||= []).push(r)
  }

  const result = []
  for (const p of periods) {
    const myReqs = byPeriod[p.id]
    if (!myReqs?.length) continue
    const startDate = new Date(p.period_start + 'T00:00:00')
    const endDate   = new Date(p.period_end + 'T00:00:00')
    const dayCount  = Math.floor((endDate - startDate) / 86400000) + 1
    const shiftRow  = Array(dayCount).fill('X')
    let submitted = null
    let confirmed = false
    let anyDraft  = false
    for (const r of myReqs) {
      const date = new Date(r.date + 'T00:00:00')
      const idx = Math.floor((date - startDate) / 86400000)
      if (idx >= 0 && idx < dayCount) {
        if (r.is_available && r.preferred_start && r.preferred_end) {
          const sh = parseInt(r.preferred_start.slice(0, 2)) + parseInt(r.preferred_start.slice(3, 5)) / 60
          const eh = parseInt(r.preferred_end.slice(0, 2))   + parseInt(r.preferred_end.slice(3, 5))   / 60
          shiftRow[idx] = toCode(sh, eh)
        }
      }
      if (r.status === 'confirmed') confirmed = true
      if (r.status === 'draft')     anyDraft = true
      if (r.submitted_at && !submitted) submitted = r.submitted_at
    }
    const status = confirmed ? 'confirmed' : anyDraft ? 'draft' : 'submitted'
    result.push({
      id:           p.id,
      period:       p.name,
      shiftRow,
      status,
      submittedAt:  submitted ? new Date(submitted).toLocaleString('ja-JP').replace(/\//g, '-').slice(0, 16) : null,
      lastEditedAt: null,
    })
  }
  return result
}

export async function saveSubmission({ storeId, periodName, shiftRow, submit }) {
  const myId = await getMyEmployeeId()
  if (!myId) throw new Error('社員データが見つかりません')
  const period = await findOrCreatePeriod({ storeId, periodName })
  const startDate = new Date(period.period_start + 'T00:00:00')
  const status = submit ? 'submitted' : 'draft'
  const submittedAt = submit ? new Date().toISOString() : null

  // 既存のmy requests を全削除（同一period内）
  await supabase
    .from('shift_requests')
    .delete()
    .eq('period_id', period.id)
    .eq('employee_id', myId)

  // shiftRow を bulk insert
  const rows = []
  for (let i = 0; i < shiftRow.length; i++) {
    const d = new Date(startDate)
    d.setDate(d.getDate() + i)
    const dateStr = d.toISOString().slice(0, 10)
    const parsed = parseCode(shiftRow[i])
    if (parsed) {
      rows.push({
        period_id:       period.id,
        employee_id:     myId,
        date:            dateStr,
        preferred_start: hhmm(parsed.start),
        preferred_end:   hhmm(parsed.end),
        is_available:    true,
        status,
        submitted_at:    submittedAt,
      })
    } else {
      rows.push({
        period_id:    period.id,
        employee_id:  myId,
        date:         dateStr,
        is_available: false,
        status,
        submitted_at: submittedAt,
      })
    }
  }
  if (rows.length) {
    const { error } = await supabase
      .from('shift_requests')
      .insert(rows)
    if (error) throw error
  }

  // 提出時 (submit=true) は管理者にお知らせ
  if (submit) {
    try {
      // store の親 org（会社） に通知（recipient_id=NULL で org全員宛だが、staffも見える点には注意）
      const { data: store } = await supabase
        .from('organizations')
        .select('parent_id, name')
        .eq('id', storeId)
        .maybeSingle()
      const orgId = store?.parent_id ?? storeId
      // 自分の名前を取得
      const { data: me } = await supabase
        .from('employees')
        .select('name')
        .eq('id', myId)
        .maybeSingle()
      await supabase.from('notifications').insert({
        org_id:       orgId,
        recipient_id: null,
        type:         'submit',
        title:        `${me?.name ?? '従業員'} からシフト希望が提出されました`,
        body:         `${periodName} のシフト希望が提出されました。確認してください。`,
        read:         false,
      })
    } catch (e) {
      console.error('[shiftRequests.saveSubmission.notify]', e)
    }
  }

  return period.id
}
