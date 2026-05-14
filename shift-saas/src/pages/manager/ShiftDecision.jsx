import { useState, useMemo, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  daysConfig, assignedShifts, YEAR_MONTH,
  storeConfig, staffConstraints, dailyTargets, ORDER_DISTRIBUTION,
  generateSlots, parseShiftTimes, calcRequiredStaff, skillLabels,
  decomposeShiftHours, calcDailyPay, SALES_PATTERNS, dayPatterns as initialDayPatterns,
  shiftVersions,
} from '../../data/mockData'
import { readWorkbookFromFile, extractShifts } from '../../utils/excelImport.js'
import { useOrg } from '../../context/OrgContext'
import { supabase } from '../../lib/supabase'
import * as shiftsApi from '../../api/shifts'
import * as versionsApi from '../../api/versions'
import * as employeesApi from '../../api/employees'

// assigned[day][slot]=[empId,...] と employee.id から、その日の連続スロットを
// シフトコード文字列 ('F' / '9-18' / '13-L' / 'O-16' / 'X') に変換
function deriveDayCode(daySlots, empId) {
  if (!daySlots) return 'X'
  const hours = []
  for (const [slot, ids] of Object.entries(daySlots)) {
    if (Array.isArray(ids) && ids.includes(empId)) {
      const h = parseInt(slot.split(':')[0], 10)
      if (!Number.isNaN(h)) hours.push(h)
    }
  }
  if (!hours.length) return 'X'
  hours.sort((a, b) => a - b)
  const start = hours[0]
  const end   = hours[hours.length - 1] + 1
  if (start === 9 && end === 18) return 'F'
  if (start === 9)  return `O-${end}`
  if (end === 22)   return `${start}-L`
  return `${start}-${end}`
}

const AI_STAGES = [
  'シフトデータを解析中...',
  '相性・制約条件を照合中...',
  '最適配置を算出中...',
]

const TASK_TOGGLE_ON = {
  orange: 'bg-orange-100 border-orange-300 text-orange-800',
  purple: 'bg-purple-100 border-purple-300 text-purple-800',
}

function getTasksForSlotMin(slotMin, tasks) {
  return tasks.filter(t => {
    if (!t.enabled) return false
    const [sh, sm] = t.startTime.split(':').map(Number)
    const [eh, em] = t.endTime.split(':').map(Number)
    return slotMin >= sh * 60 + sm && slotMin < eh * 60 + em
  })
}

const LATE_THRESHOLD  = 21  // 前日この時刻以降終了 = 遅番
const EARLY_THRESHOLD = 9   // 当日この時刻以前開始 = 早番

const DEFAULT_AI_WEIGHTS = {
  retentionPriority: 10,
  incompatibility:   15,
  targetEarnings:     8,
  lateToEarly:       12,
  wage:               0,
}
function runAIForDays(days, slots, staffList, constraints, targets, specialTasks, shiftData, aiWeights = DEFAULT_AI_WEIGHTS) {
  const W = { ...DEFAULT_AI_WEIGHTS, ...(aiWeights || {}) }
  const result = {}
  let avoidedConflicts = 0
  for (const day of days) {
    const dailyOrders = targets.find(t => t.day === day)?.orders ?? 200
    const dayAssign = {}
    for (const slot of slots) {
      const [h, m] = slot.split(':').map(Number)
      const slotMin = h * 60 + m
      const taskExtra = getTasksForSlotMin(slotMin, specialTasks).reduce((s, t) => s + t.requiredStaff, 0)
      const required = calcRequiredStaff(dailyOrders, h, storeConfig.avgProductivity, taskExtra)
      const slotDec = h + m / 60
      const available = staffList.filter(s => {
        const times = parseShiftTimes(shiftData[s.id]?.[day - 1])
        return times && slotDec >= times.start && slotDec < times.end
      })
      const scored = available.map(s => {
        let score = (11 - (constraints[s.id]?.retentionPriority ?? 5)) * W.retentionPriority
        const alreadyIn = dayAssign[slot] || []
        for (const { staffId, severity } of (constraints[s.id]?.incompatible ?? [])) {
          if (alreadyIn.includes(staffId)) { score -= severity * W.incompatibility; avoidedConflicts++ }
        }
        if ((constraints[s.id]?.targetEarnings ?? 0) > 0) score += W.targetEarnings
        // Low-priority penalty: avoid early shift after late-night shift
        if (day > 1 && slotDec <= EARLY_THRESHOLD) {
          const prevTimes = parseShiftTimes(shiftData[s.id]?.[day - 2])
          if (prevTimes && prevTimes.end >= LATE_THRESHOLD) score -= W.lateToEarly
        }
        // Wage penalty: 時給が高いほど減点（基準=1000円、50円ごとに W ポイント減点）
        if (W.wage > 0) {
          const wage = s.wage ?? 1050
          score -= Math.max(0, (wage - 1000) / 50) * W.wage
        }
        return { s, score }
      })
      scored.sort((a, b) => b.score - a.score)
      dayAssign[slot] = scored.slice(0, required).map(x => x.s.id)
    }
    result[day] = dayAssign
  }
  const allStaffIds = new Set(Object.values(result).flatMap(d => Object.values(d).flat()))
  const staffWithTargets = staffList.filter(s => (constraints[s.id]?.targetEarnings ?? 0) > 0).length
  return { result, avoidedConflicts, staffWithTargets, totalAssigned: allStaffIds.size }
}

// Column widths
const LW = 100   // label / name
const SW = 64    // sub-label (top) = start+end cols (bottom)
const STW = 32   // start col
const ETW = 32   // end col
const SUMM = [
  { k: 'work',       l: '勤務',   w: 38 },
  { k: 'labor',      l: '労働',   w: 38 },
  { k: 'overtime',   l: '超勤',   w: 38 },
  { k: 'lateNight',  l: '深夜',   w: 38 },
  { k: 'otLateNight',l: '残深',   w: 38 },
  { k: 'pay',        l: '給与',   w: 72 },
  { k: 'trans',      l: '交通費', w: 60 },
]

export default function ShiftDecision() {
  const { versionId, orgId } = useParams()
  const navigate = useNavigate()
  const { stores } = useOrg()
  const storeIdForSave = stores[0]?.id
  const [saveError, setSaveError] = useState('')
  const [dbEmployees, setDbEmployees] = useState([])
  const currentVersion = shiftVersions.find(v => v.id === versionId) || { id: versionId, name: versionId || 'ver1', status: 'draft', author: '' }

  // DB社員をロード
  useEffect(() => {
    if (!orgId) return
    employeesApi.listEmployees(orgId).then(setDbEmployees).catch(e => console.error('[ShiftDecision.loadEmployees]', e))
  }, [orgId])
  const [selectedDay,  setSelectedDay]  = useState(1)
  const [assigned,     setAssigned]     = useState({}) // 初期は空。DBから loadAssignments で復元
  const [specialTasks, setSpecialTasks] = useState(storeConfig.specialTasks)

  // staff / shiftData は DB のみ（mockData の flash を防止）
  const staff = dbEmployees
  const shiftData = useMemo(() => {
    const out = {}
    for (const emp of dbEmployees) {
      out[emp.id] = daysConfig.map(d => deriveDayCode(assigned?.[d.day], emp.id))
    }
    return out
  }, [dbEmployees, assigned])
  const [showAI,        setShowAI]       = useState(false)
  const [aiPhase,       setAIPhase]      = useState('select')
  const [aiStage,       setAIStage]      = useState(0)
  const [aiDays,        setAIDays]       = useState(() => new Set(daysConfig.map(d => d.day)))
  const [aiResult,      setAIResult]     = useState(null)
  const [dayTaskOverrides, setDayTaskOverrides] = useState({})  // { [day]: { [taskId]: Partial<Task> } }
  const [editDayTask,      setEditDayTask]      = useState(null) // taskId being edited for the day
  const [dayPatternMap,    setDayPatternMap]    = useState(initialDayPatterns) // day -> pattern key
  const [half,             setHalf]             = useState('first') // 'first' | 'second'
  const [viewMode,         setViewMode]         = useState('day')   // 'day' | 'week' | 'half' | 'month' | 'calendar'
  const [showCalendar,     setShowCalendar]     = useState(false)
  const [showDisplayPanel, setShowDisplayPanel] = useState(true)
  const [displayItems,     setDisplayItems]     = useState({
    salesPlan:      true,  // 実行計画売上
    salesActual:    true,  // 売上ACTUAL
    requiredStaff:  true,  // 必要人員数
    assignedStaff:  true,  // 配置済み人数
    skillBreakdown: true,  // スキル別配置数
    totalTime:      true,  // 合計時間
    specialTasks:   true,  // 特別業務 toggles
    workSummary:    true,  // 勤務/労働/超勤/深夜/残深 列
    paySummary:     true,  // 給与/交通費 列
  })
  const toggleDisplay = (k) => setDisplayItems(prev => ({ ...prev, [k]: !prev[k] }))

  // Picker: 期間内の全日（半月単位）。常にこのリストをタブとして表示する
  const pickerDays = useMemo(() => {
    return daysConfig.filter(d => half === 'first' ? d.day <= 15 : d.day >= 16)
  }, [half])

  // visibleDays: 集計対象の日（viewMode に応じて切替）
  const visibleDays = useMemo(() => {
    if (viewMode === 'day')   return daysConfig.filter(d => d.day === selectedDay)
    if (viewMode === 'week') {
      const end = Math.min(daysConfig.length, selectedDay + 6)
      return daysConfig.filter(d => d.day >= selectedDay && d.day <= end)
    }
    if (viewMode === 'calendar') return daysConfig
    // half: 期間内の全日
    return pickerDays
  }, [viewMode, half, selectedDay, pickerDays])

  // 週モードで selectedDay が選べる範囲（期間末から6日以内まで）
  const weekRangeForDay = (day) => {
    const end = Math.min(daysConfig.length, day + 6)
    return { start: day, end }
  }

  const visibleSumm = useMemo(() => SUMM.filter(s => {
    if (['work','labor','overtime','lateNight','otLateNight'].includes(s.k)) return displayItems.workSummary
    if (['pay','trans'].includes(s.k)) return displayItems.paySummary
    return true
  }), [displayItems.workSummary, displayItems.paySummary])
  const [shiftStatus,      setShiftStatus]      = useState(currentVersion.status)   // 'draft' | 'confirmed'
  const [saveFlash,     setSaveFlash]    = useState('')          // 'saved' | 'confirmed' | ''
  const [showPublish,   setShowPublish]  = useState(false)
  const [publishEndDay, setPublishEndDay] = useState(15)
  const [published,     setPublished]    = useState(false)
  // CSV upload
  const [showCsvModal,       setShowCsvModal]       = useState(false)
  const [pendingCsvFile,     setPendingCsvFile]     = useState(null)
  const [pendingAltCsvFile,  setPendingAltCsvFile]  = useState(null)
  const [altCsvFormat,       setAltCsvFormat]       = useState('airreji')
  const [csvMsg,             setCsvMsg]             = useState('')
  const [shiftDataVersion,   setShiftDataVersion]   = useState(0) // bump to force re-render after mutating shiftData
  const csvFileRef    = useRef(null)
  const csvAltFileRef = useRef(null)

  // Load assignments from DB on mount / versionId change
  // - 既存の shifts (確定/下書きで入っている割当) を優先
  // - 空の場合は同期間の shift_requests (希望) を seed として使う
  useEffect(() => {
    if (!versionId) return
    let cancelled = false
    ;(async () => {
      try {
        const dbAssigned = await shiftsApi.loadAssignments({ versionId })
        if (cancelled) return
        if (Object.keys(dbAssigned).length > 0) {
          setAssigned(dbAssigned)
          return
        }
        // version の period_id を取得
        const { data: ver } = await supabase
          .from('shift_versions')
          .select('period_id')
          .eq('id', versionId)
          .maybeSingle()
        if (cancelled || !ver?.period_id) return
        // その期間の shift_requests を取得
        const { data: reqs } = await supabase
          .from('shift_requests')
          .select('employee_id, date, preferred_start, preferred_end, is_available')
          .eq('period_id', ver.period_id)
        if (cancelled || !reqs?.length) return
        // shift_requests を assigned[day][slot]=[empId,...] に変換
        const seeded = {}
        for (const r of reqs) {
          if (!r.is_available || !r.preferred_start || !r.preferred_end) continue
          const day = parseInt(r.date.slice(8, 10), 10)
          const sH  = parseInt(r.preferred_start.slice(0, 2), 10) + parseInt(r.preferred_start.slice(3, 5), 10) / 60
          const eH  = parseInt(r.preferred_end.slice(0, 2),   10) + parseInt(r.preferred_end.slice(3, 5),   10) / 60
          for (let h = sH; h < eH - 0.001; h += 0.25) {
            const hh = Math.floor(h + 0.0001)
            const mm = Math.round(((h + 0.0001) - hh) * 60)
            const slot = `${hh}:${String(mm).padStart(2, '0')}`
            ;(seeded[day] ||= {})[slot] ||= []
            if (!seeded[day][slot].includes(r.employee_id)) {
              seeded[day][slot].push(r.employee_id)
            }
          }
        }
        if (Object.keys(seeded).length > 0) {
          setAssigned(seeded)
        }
      } catch (e) {
        if (!cancelled) setSaveError(e.message || '読み込みに失敗しました')
      }
    })()
    return () => { cancelled = true }
  }, [versionId])

  const handleSaveDraft = async () => {
    setShiftStatus('draft')
    setSaveFlash('saved')
    setTimeout(() => setSaveFlash(''), 2000)
    if (!storeIdForSave) return
    try {
      await shiftsApi.saveAssignments({ versionId, storeId: storeIdForSave, assignedByDay: assigned })
      try { await versionsApi.updateVersion(versionId, { status: 'draft' }) } catch {}
    } catch (e) {
      setSaveFlash('')
      setSaveError(e.message || '保存に失敗しました')
    }
  }
  const handleConfirm = async () => {
    setShiftStatus('confirmed')
    setSaveFlash('confirmed')
    setTimeout(() => setSaveFlash(''), 2000)
    if (!storeIdForSave) return
    try {
      await shiftsApi.saveAssignments({ versionId, storeId: storeIdForSave, assignedByDay: assigned })
      try { await versionsApi.updateVersion(versionId, { status: 'confirmed' }) } catch {}
    } catch (e) {
      setSaveFlash('')
      setSaveError(e.message || '確定に失敗しました')
    }
  }
  const handlePublish = () => {
    setPublished(true)
    setShowPublish(false)
  }

  // ── CSV upload helpers ────────────────────────────────────────────────────
  const parseCsvLine = (line) => {
    const out = []
    let cur = '', inQ = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '"') { if (inQ && line[i+1] === '"') { cur += '"'; i++ } else { inQ = !inQ } }
      else if (c === ',' && !inQ) { out.push(cur); cur = '' }
      else cur += c
    }
    out.push(cur)
    return out.map(s => s.trim())
  }

  // 時刻 "9:00" → 数値時 9
  const parseHour = (s) => {
    if (!s) return null
    const m = s.match(/^(\d{1,2}):(\d{2})$/)
    if (!m) return null
    return parseInt(m[1]) + parseInt(m[2]) / 60
  }
  // 数値時 → "h-h2" 形式 (整数が望ましいが半時間も対応)
  const fmtRange = (start, end) => {
    const f = (h) => Number.isInteger(h) ? `${h}` : `${h}`
    return `${f(start)}-${f(end)}`
  }

  // 日付 "2026/5/14" → 月内の日 (1-31)。年月不一致の場合は無視
  const parseDayFromDate = (s) => {
    if (!s) return null
    const m = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/) || s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
    if (!m) return null
    return parseInt(m[3])
  }

  // ピタシフ形式: 日にち,曜日,氏名,開始時間,終了時間
  const PITASHIFT_SHIFT_HEADER = ['日にち','曜日','氏名','開始時間','終了時間']

  const downloadShiftCsvFormat = () => {
    const header = PITASHIFT_SHIFT_HEADER.join(',')
    const rows = []
    daysConfig.forEach(d => {
      staff.forEach(s => {
        const code = shiftData[s.id]?.[d.day - 1]
        if (!code || code === 'X') return
        const t = parseShiftTimes(code)
        if (!t) return
        const fmt = (h) => `${Math.floor(h)}:${String(Math.round((h - Math.floor(h)) * 60)).padStart(2, '0')}`
        rows.push([`2026/4/${d.day}`, d.dow, s.name, fmt(t.start), fmt(t.end)].join(','))
      })
    })
    const csv = [header, ...rows].join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `shifts_${currentVersion.id || 'v1'}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  // 共通: 行 [date, name, start, end] の配列 → shiftData にマージ
  const applyShiftRows = (rows) => {
    let count = 0, unmatched = 0
    rows.forEach(({ day, name, start, end }) => {
      const sm = staff.find(s => s.name === name || s.name.replace(/\s+/g, '') === name.replace(/\s+/g, ''))
      if (!sm) { unmatched++; return }
      if (day < 1 || day > daysConfig.length) return
      const sH = parseHour(start), eH = parseHour(end)
      if (sH == null || eH == null) return
      // 既存行を確保
      if (!shiftData[sm.id]) shiftData[sm.id] = Array.from({ length: daysConfig.length }, () => 'X')
      shiftData[sm.id][day - 1] = fmtRange(sH, eH)
      count++
    })
    if (count) setShiftDataVersion(v => v + 1)
    return { count, unmatched }
  }

  // .xlsx の ｼﾌﾄ原本 シートから 1〜31日のシフトコードを直接取り込む
  //   - NO. 列 (A) を id にして staff にマッチ。コードは 'F' / 'X' / 'O-16' / '13-L' / '9-18' 等そのまま。
  const executePitashiftShiftExcelUpload = async () => {
    if (!pendingCsvFile) return
    try {
      const wb = await readWorkbookFromFile(pendingCsvFile)
      const { rows } = extractShifts(wb)
      if (!rows.length) { setCsvMsg('Excel からシフトを読み取れませんでした。'); setShowCsvModal(false); return }
      let count = 0, unmatched = 0
      rows.forEach(({ no, days }) => {
        const sm = staff.find(s => s.id === no)
        if (!sm) { unmatched++; return }
        if (!shiftData[sm.id]) shiftData[sm.id] = Array.from({ length: daysConfig.length }, () => 'X')
        days.forEach((code, i) => {
          if (i >= daysConfig.length) return
          // 空セル・参照エラー (#REF!) は X に丸める
          const v = (!code || /^#REF/.test(code)) ? 'X' : code
          shiftData[sm.id][i] = v
        })
        count++
      })
      if (count) setShiftDataVersion(v => v + 1)
      setCsvMsg(`✓ Excel取込: ${count}名分のシフトを反映` + (unmatched ? ` (未マッチ ${unmatched}件)` : ''))
      setTimeout(() => setCsvMsg(''), 4000)
    } catch {
      setCsvMsg('Excel の読み込みに失敗しました。')
    }
    setShowCsvModal(false)
    setPendingCsvFile(null)
  }

  const executePitashiftShiftUploadAny = () => {
    if (!pendingCsvFile) return
    const ext = (pendingCsvFile.name.split('.').pop() || '').toLowerCase()
    if (ext === 'xlsx' || ext === 'xls') return executePitashiftShiftExcelUpload()
    return executePitashiftShiftUpload()
  }

  const executePitashiftShiftUpload = () => {
    if (!pendingCsvFile) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const text = ev.target.result.replace(/^﻿/, '').trim()
        const lines = text.split(/\r?\n/).filter(l => l.trim()).slice(1)
        const rows = []
        lines.forEach(line => {
          const c = parseCsvLine(line)
          if (c.length < 5) return
          const day  = parseDayFromDate(c[0])
          const name = c[2]
          const start = c[3], end = c[4]
          if (day && name && start && end) rows.push({ day, name, start, end })
        })
        const { count, unmatched } = applyShiftRows(rows)
        if (count === 0) { setCsvMsg('CSVの形式が正しくないか、有効な行がありませんでした。'); setShowCsvModal(false); return }
        setCsvMsg(`✓ ${count}件のシフトを取り込みました` + (unmatched ? ` (未マッチ ${unmatched}件)` : ''))
        setTimeout(() => setCsvMsg(''), 4000)
      } catch { setCsvMsg('CSVの読み込みに失敗しました') }
    }
    reader.readAsText(pendingCsvFile, 'UTF-8')
    setShowCsvModal(false)
    setPendingCsvFile(null)
  }

  // ── 印刷プレビュー (新ウィンドウ) ────────────────────────────────────
  const openPrintPreview = () => {
    const win = window.open('', '_blank', 'width=1400,height=800')
    if (!win) { alert('ポップアップがブロックされました。許可してください。'); return }
    const fmt = (h) => {
      if (h == null) return ''
      const hh = Math.floor(h)
      const mm = Math.round((h - hh) * 60)
      return `${hh}:${String(mm).padStart(2, '0')}`
    }
    const rows = staff.map(s => {
      const cells = daysConfig.map(d => {
        const code = shiftData[s.id]?.[d.day - 1]
        if (!code || code === 'X') return '<td style="border:1px solid #cbd5e1;padding:3px 4px;"></td>'
        const t = parseShiftTimes(code); if (!t) return '<td style="border:1px solid #cbd5e1;padding:3px 4px;"></td>'
        const isToday = d.day === selectedDay
        const bg = isToday ? 'background:#bfdbfe;color:#1e3a8a;font-weight:700;' : 'background:#eff6ff;color:#1e40af;'
        return `<td style="${bg}border:1px solid #cbd5e1;padding:3px 4px;font-size:9.5px;text-align:center;white-space:nowrap;">${fmt(t.start)}〜${fmt(t.end)}</td>`
      }).join('')
      return `<tr><td style="border:1px solid #cbd5e1;padding:3px 8px;font-size:11px;font-weight:600;background:#f8fafc;white-space:nowrap;">${s.name}</td>${cells}</tr>`
    }).join('')
    const dateHdr = daysConfig.map(d => {
      const isWE = d.dow === '土' || d.dow === '日'
      return `<th style="border:1px solid #cbd5e1;padding:3px 4px;font-size:9.5px;background:#e2e8f0;color:${isWE ? '#be123c' : '#1e293b'};white-space:nowrap;">4/${d.day} (${d.dow})</th>`
    }).join('')
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>シフト印刷プレビュー</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", sans-serif; padding: 24px; margin: 0; }
        .head { display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:14px; }
        .title { font-size:13px; font-weight:700; color:#0f172a; }
        .store { font-size:11px; color:#64748b; }
        .actions { margin-bottom:12px; }
        button { padding:6px 14px; border-radius:6px; border:1px solid #cbd5e1; background:white; font-size:12px; cursor:pointer; margin-right:6px; }
        button.primary { background:#4f46e5; color:white; border-color:#4f46e5; }
        table { border-collapse:collapse; }
        @media print { .actions { display:none; } body { padding: 8mm; } @page { size: landscape; } }
      </style></head><body>
      <div class="actions">
        <button class="primary" onclick="window.print()">印刷</button>
        <button onclick="window.close()">閉じる</button>
      </div>
      <div class="head">
        <div class="title">${YEAR_MONTH} 1日(${daysConfig[0]?.dow || ''})〜${daysConfig.length}日(${daysConfig[daysConfig.length-1]?.dow || ''})のシフト ${currentVersion.name ? '「' + currentVersion.name + '」' : ''}</div>
        <div class="store">${stores[0]?.name ?? ''}</div>
      </div>
      <table>
        <thead><tr><th style="border:1px solid #cbd5e1;padding:6px 10px;font-size:11px;background:#e2e8f0;color:#1e293b;text-align:left;">スタッフ</th>${dateHdr}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
      </body></html>`
    win.document.write(html); win.document.close()
  }

  // Airレジ「シフト管理」CSV → ピタシフ形式に変換
  const executeAirrejiShiftUpload = () => {
    if (!pendingAltCsvFile) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const text = ev.target.result.replace(/^﻿/, '').trim()
        const lines = text.split(/\r?\n/).filter(l => l.trim()).slice(1)
        // Airレジ列: No=0, 日にち=1, 曜日=2, 開始=3, 終了=4, 表示名=5, 氏名-姓=6, 氏名-名=7,
        // グループ=8, 退職者=9, 休憩開始=10, 休憩終了=11, 労働時間=12, 実労働=13, 休憩=14,
        // ｺｰﾄﾞ=15, ﾒﾓ=16, 業務=17, ｼﾌﾄﾊﾟﾀｰﾝ=18
        const rows = []
        lines.forEach(line => {
          const c = parseCsvLine(line)
          if (c.length < 8) return
          const day = parseDayFromDate(c[1])
          const start = c[3], end = c[4]
          const lastN = c[6], firstN = c[7]
          const name = `${lastN} ${firstN}`.replace(/\s+/g, ' ').trim()
          if (day && name && start && end) rows.push({ day, name, start, end })
        })
        const { count, unmatched } = applyShiftRows(rows)
        if (count === 0) { setCsvMsg('Airレジ形式から有効な行が見つかりませんでした'); setShowCsvModal(false); return }
        setCsvMsg(`✓ Airレジ取込: ${count}件のシフトを反映` + (unmatched ? ` (未マッチ ${unmatched}件)` : ''))
        setTimeout(() => setCsvMsg(''), 4000)
      } catch { setCsvMsg('Airレジ CSV の読み込みに失敗しました') }
    }
    reader.readAsText(pendingAltCsvFile, 'UTF-8')
    setShowCsvModal(false)
    setPendingAltCsvFile(null)
  }

  const getEffectiveTasks = (day) => specialTasks.map(t => ({ ...t, ...(dayTaskOverrides[day]?.[t.id] || {}) }))
  const setDayOverride = (day, taskId, patch) =>
    setDayTaskOverrides(prev => ({
      ...prev,
      [day]: { ...(prev[day] || {}), [taskId]: { ...(prev[day]?.[taskId] || {}), ...patch } },
    }))

  const slots = useMemo(
    () => generateSlots(15, storeConfig.openHour, storeConfig.closeHour),
    []
  )
  const slotW = 20
  const hours = [...new Set(slots.map(s => parseInt(s.split(':')[0])))]

  const dayTarget   = dailyTargets.find(t => t.day === selectedDay)
  const dailyOrders = dayTarget?.orders ?? 200

  // ── 集約ビュー (週/半月/月) 用: 日ごとの簡易サマリーを計算 ──
  const summarizeDay = (day) => {
    const t        = dailyTargets.find(x => x.day === day)
    const patKey   = dayPatternMap[day] || 'weekday1'
    const pattern  = SALES_PATTERNS[patKey]
    const plannedSalesYen = pattern
      ? Object.values(pattern.hourlySales).reduce((a,b) => a + (b||0), 0)
      : (t?.sales ?? 0) * 1000
    // ピーク必要人員（その日の業務込み）
    const tasks    = getEffectiveTasks(day).filter(x => x.enabled)
    const orders   = t?.orders ?? 200
    const peakRequired = Math.max(0, ...hours.map(h => {
      const extra = tasks.filter(x => {
        if (!x.startTime || !x.endTime) return false
        const [sh, sm = 0] = x.startTime.split(':').map(Number)
        const [eh, em = 0] = x.endTime.split(':').map(Number)
        const sMin = sh*60+sm, eMin = eh*60+em
        const hMin = h*60
        return hMin >= sMin && hMin < eMin
      }).reduce((acc, x) => acc + (x.requiredStaff || 0), 0)
      return calcRequiredStaff(orders, h, storeConfig.avgProductivity, extra)
    }))
    // 配置時間 (assigned[day][slot] の延べ要素数 × 0.25h)
    let assignedSlotCount = 0
    let peakAssigned = 0
    if (assigned[day]) {
      for (const ids of Object.values(assigned[day])) {
        if (Array.isArray(ids)) {
          assignedSlotCount += ids.length
          peakAssigned = Math.max(peakAssigned, ids.length)
        }
      }
    }
    const assignedHours = assignedSlotCount * 0.25
    // 概算人件費（配置スタッフの wage × 時間）
    let estLaborYen = 0
    if (assigned[day]) {
      const perEmpSlots = {}
      for (const ids of Object.values(assigned[day])) {
        if (!Array.isArray(ids)) continue
        for (const id of ids) perEmpSlots[id] = (perEmpSlots[id] || 0) + 1
      }
      for (const [id, n] of Object.entries(perEmpSlots)) {
        const emp = staff.find(s => String(s.id) === String(id))
        const wage = emp?.wage ?? 1050
        estLaborYen += wage * (n * 0.25)
      }
    }
    const laborRatio = plannedSalesYen > 0 ? (estLaborYen / plannedSalesYen * 100) : null
    return {
      day,
      dow: t?.dow ?? daysConfig.find(d => d.day === day)?.dow,
      isWeekend: daysConfig.find(d => d.day === day)?.isWeekend ?? false,
      plannedSalesYen,
      peakRequired,
      peakAssigned,
      assignedHours,
      estLaborYen,
      laborRatio,
      taskCount: tasks.length,
    }
  }

  const effectiveTasks = getEffectiveTasks(selectedDay)
  const getRequired = (slot) => {
    const [h, m] = slot.split(':').map(Number)
    const extra = getTasksForSlotMin(h * 60 + m, effectiveTasks).reduce((s, t) => s + t.requiredStaff, 0)
    return calcRequiredStaff(dailyOrders, h, storeConfig.avgProductivity, extra)
  }
  const getAssignedList = (slot) => assigned[selectedDay]?.[slot] || []
  const isWorking = (staffId, slot) => {
    const times = parseShiftTimes(shiftData[staffId]?.[selectedDay - 1])
    if (!times) return false
    const [h, m] = slot.split(':').map(Number)
    const dec = h + m / 60
    return dec >= times.start && dec < times.end
  }
  const toggleCell = (staffId, slot) => {
    // シフトコードが入っている場合は勤務時間内のみクリック可
    // 空の場合 (='X') はどのスロットも配置可能（その時間が勤務時間として確定する）
    const code = shiftData[staffId]?.[selectedDay - 1]
    if (code && code !== 'X' && !isWorking(staffId, slot)) return
    setAssigned(prev => {
      const dd = { ...(prev[selectedDay] || {}) }
      const list = [...(dd[slot] || [])]
      const idx = list.indexOf(staffId)
      if (idx >= 0) list.splice(idx, 1); else list.push(staffId)
      dd[slot] = list
      return { ...prev, [selectedDay]: dd }
    })
  }

  const currentPatternKey = dayPatternMap[selectedDay] || 'weekday1'
  const currentPattern    = SALES_PATTERNS[currentPatternKey]

  const slotSalesKen = (slot) => {
    const [h] = slot.split(':').map(Number)
    // Use pattern's hourly amount (in 円) → 千円
    const amt = currentPattern?.hourlySales[h]
    if (amt != null) return Math.round(amt / 1000)
    return Math.round((dayTarget?.sales ?? 0) * (ORDER_DISTRIBUTION[h] ?? 0))
  }
  const cumSales = useMemo(() => {
    let cum = 0
    return slots.map(s => { cum += slotSalesKen(s); return cum })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, selectedDay, currentPatternKey])

  const isLateEarlyAlert = (staffId) => {
    if (selectedDay <= 1) return false
    const prevTimes = parseShiftTimes(shiftData[staffId]?.[selectedDay - 2])
    const currTimes = parseShiftTimes(shiftData[staffId]?.[selectedDay - 1])
    return !!(prevTimes && currTimes && prevTimes.end >= LATE_THRESHOLD && currTimes.start <= EARLY_THRESHOLD)
  }

  const getShiftSummary = (staffId) => {
    const code = shiftData[staffId]?.[selectedDay - 1] || 'X'
    const t = parseShiftTimes(code)
    if (!t) return null
    const member = staff.find(s => s.id === staffId)
    const wage   = member?.wage ?? 1050
    const trans  = member?.transitPerDay ?? 0
    const decomp = decomposeShiftHours(t.start, t.end)
    const { work, labor, overtime, lateNight, otLateNight, breakStart, breakEnd } = decomp
    const pay = calcDailyPay(wage, labor, overtime, lateNight, otLateNight)
    return { start: t.start, end: t.end, work, labor, overtime, lateNight, otLateNight, pay: Math.round(pay), trans, breakStart, breakEnd }
  }

  const reqColor = (cnt, req) => {
    if (cnt === 0 && req > 0) return { background: '#fee2e2', color: '#991b1b' }
    if (cnt < req)            return { background: '#fef3c7', color: '#92400e' }
    if (cnt >= req && req > 0)return { background: '#d1fae5', color: '#065f46' }
    return { background: 'var(--pita-bg)', color: 'var(--pita-faint)' }
  }

  const slotSalesPH = (slot) => {
    const cnt = staff.filter(s => isWorking(s.id, slot)).length
    return cnt > 0 ? Math.round(slotSalesKen(slot) * 1000 / cnt) : 0
  }

  // 当日にシフト持ちのスタッフを抽出。誰もいない場合は全員を表示して
  // マネージャーが配置作業を始められるようにする
  const workingStaff = (() => {
    const withShift = staff.filter(s => getShiftSummary(s.id) !== null)
    return withShift.length > 0 ? withShift : staff
  })()

  const openAI = () => { setAIDays(new Set(daysConfig.map(d => d.day))); setAIResult(null); setAIPhase('select'); setShowAI(true) }
  const runAI = async () => {
    setAIPhase('loading'); setAIStage(0)
    try {
      for (let i = 0; i < AI_STAGES.length; i++) { setAIStage(i); await new Promise(r => setTimeout(r, 700)) }
      const days = [...aiDays].sort((a, b) => a - b)
      const aiWeights = stores?.[0]?.settings?.aiConfig?.weights
      const { result, avoidedConflicts, staffWithTargets, totalAssigned } = runAIForDays(days, slots, staff, staffConstraints, dailyTargets, specialTasks, shiftData, aiWeights)
      const merged = { ...assigned, ...result }
      setAssigned(merged)
      setAIResult({ days, avoidedConflicts, staffWithTargets, totalAssigned })
      setAIPhase('done')
      // AI配置結果を自動でDBに保存
      if (storeIdForSave && versionId) {
        try {
          await shiftsApi.saveAssignments({ versionId, storeId: storeIdForSave, assignedByDay: merged })
        } catch (e) {
          console.error('[ShiftDecision.runAI.autoSave]', e)
          setSaveError('AI配置の自動保存に失敗: ' + (e.message || e))
        }
      }
    } catch (e) {
      console.error('[ShiftDecision.runAI]', e)
      setSaveError('AI実行エラー: ' + (e.message || e))
      setAIPhase('select') // ローディングを抜けてやり直し可能に
    }
  }
  const toggleAIDay = (day) => setAIDays(prev => { const n = new Set(prev); n.has(day) ? n.delete(day) : n.add(day); return n })

  // Shared table styles
  const B = '1px solid #dde5f0'
  const BB = '1px solid #c4d0e2'
  const td = (extra = {}) => ({ border: B, padding: '5px 7px', textAlign: 'right', whiteSpace: 'nowrap', fontSize: 12.5, fontVariantNumeric: 'tabular-nums', background: 'var(--pita-panel)', ...extra })
  const th = (extra = {}) => ({ border: B, padding: '6px 8px', textAlign: 'center', whiteSpace: 'nowrap', fontSize: 12.5, fontWeight: 700, background: '#e2e8f0', color: '#1e293b', ...extra })
  const sL0 = { position: 'sticky', left: 0,        zIndex: 5 }
  const sL1 = { position: 'sticky', left: LW,        zIndex: 5 }
  const sL2 = { position: 'sticky', left: LW + STW,  zIndex: 5 }
  const sH0 = { position: 'sticky', left: 0,        zIndex: 15 }
  const sH1 = { position: 'sticky', left: LW,        zIndex: 15 }
  const sH2 = { position: 'sticky', left: LW + STW,  zIndex: 15 }

  return (
    <div style={{ padding:'20px 24px 16px', background:'#f0f5f9', display:'flex', flexDirection:'column', gap:12 }}>

      {/* ── Header ── */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
        <div>
          <div style={{ fontSize:11, color:'#94a3b8', marginBottom:4, display:'flex', alignItems:'center', gap:6 }}>
            <button
              onClick={() => navigate(`/${orgId}/manager/shift`)}
              style={{ background:'none', border:'none', color:'#6366f1', fontSize:11, fontWeight:600, cursor:'pointer', padding:0, fontFamily:'inherit' }}
            >
              ← バージョン一覧
            </button>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <h1 style={{ fontSize:22, fontWeight:700, color:'#0f172a', margin:0, letterSpacing:'-0.01em' }}>
              シフト決定 — 時間帯人員配置
            </h1>
            <span style={{
              fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:10, whiteSpace:'nowrap',
              background: shiftStatus === 'confirmed' ? '#d1fae5' : '#f1f5f9',
              color:      shiftStatus === 'confirmed' ? '#065f46' : '#64748b',
            }}>
              {saveFlash === 'saved' ? '✓ 保存しました' : saveFlash === 'confirmed' ? '✓ 確定しました' : shiftStatus === 'confirmed' ? '確定済み' : '下書き'}
            </span>
            {published && <span style={{ fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:10, background:'#dbeafe', color:'#1d4ed8' }}>📢 展開済み</span>}
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          {csvMsg && <span style={{ fontSize:12, color: csvMsg.startsWith('✓') ? '#10b981' : '#ef4444' }}>{csvMsg}</span>}
          <button onClick={() => setShowCsvModal(true)} style={{ padding:'8px 14px', borderRadius:8, border:'1px solid #dde5f0', background:'white', color:'#334155', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>CSV / Excel アップロード</button>
          <button onClick={handleSaveDraft} style={{ padding:'8px 14px', borderRadius:8, border:'1px solid #dde5f0', background:'white', color:'#334155', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>下書き保存</button>
          <button onClick={handleConfirm} style={{ padding:'8px 14px', borderRadius:8, border:'none', background:'#10b981', color:'white', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>シフト確定</button>
          <button onClick={() => setShowPublish(true)} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:8, border:'none', background:'#f59e0b', color:'white', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>📢 シフト展開</button>
          <button onClick={openAI} style={{ display:'flex', alignItems:'center', gap:6, border:'none', borderRadius:8, padding:'8px 14px', fontSize:12, fontWeight:600, cursor:'pointer', color:'white', background:'#4f46e5', fontFamily:'inherit' }}>✨ AI自動配置</button>
        </div>
      </div>

      {saveError && (
        <div style={{ margin:'8px 16px 0', padding:'10px 14px', background:'#FEE2E2', color:'#991B1B', border:'1px solid #FECACA', borderRadius:8, fontSize:13 }}>
          {saveError}
        </div>
      )}

      {/* ── View mode + Print ── */}
      <div style={{ display:'flex', alignItems:'center', flexWrap:'wrap', gap:10 }}>
        <div style={{ fontSize:12, color:'#64748b' }}>
          表示単位: {viewMode === 'day' ? `${selectedDay}日のみ` : viewMode === 'week' ? `${selectedDay}日から7日間` : viewMode === 'half' ? `${half === 'first' ? '前半 (1〜15日)' : `後半 (16〜${daysConfig.length}日)`}` : 'カレンダー'}
        </div>

        {/* Right: View mode buttons + カレンダー + 印刷プレビュー */}
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ display:'inline-flex', border:'1px solid #cbd5e1', borderRadius:6, overflow:'hidden' }}>
            {[
              { k:'day',   l:'日' },
              { k:'week',  l:'週' },
              { k:'half',  l:'半月' },
            ].map(o => (
              <button key={o.k} onClick={() => setViewMode(o.k)} style={{
                padding:'5px 14px', fontSize:12, fontWeight: viewMode === o.k ? 700 : 500,
                background: viewMode === o.k ? '#4f46e5' : 'white',
                color:      viewMode === o.k ? 'white'   : '#475569',
                border:'none', borderLeft: o.k !== 'day' ? '1px solid #e2e8f0' : 'none',
                cursor:'pointer', fontFamily:'inherit',
              }}>{o.l}</button>
            ))}
          </div>
          <button onClick={() => { setViewMode('calendar'); setShowCalendar(true) }} style={{
            padding:'4px 8px', fontSize:12, color:'#0284c7', background:'none', border:'none', cursor:'pointer', textDecoration:'underline', fontFamily:'inherit',
          }}>カレンダー</button>
          <button onClick={openPrintPreview} style={{
            padding:'4px 8px', fontSize:12, color:'#0284c7', background:'none', border:'none', cursor:'pointer', textDecoration:'underline', fontFamily:'inherit',
          }}>印刷プレビュー</button>
        </div>
      </div>

      {/* ── Day selector (期間内の全日。viewMode で意味が変わる) ── */}
      <div style={{ display:'flex', gap:4, overflowX:'auto', paddingBottom:2, }}>
        {pickerDays.map(d => {
          // viewMode ごとに「選択中」を判定
          let inRange = false
          if (viewMode === 'day') {
            inRange = d.day === selectedDay
          } else if (viewMode === 'week') {
            const { start, end } = weekRangeForDay(selectedDay)
            inRange = d.day >= start && d.day <= end
          } else if (viewMode === 'half') {
            inRange = true  // 半月モードは全日が選択中
          }
          // 週モードでは「選択の起点」を別表示にしてマウス操作の意味を分かりやすく
          const isAnchor = viewMode === 'week' && d.day === selectedDay
          const clickable = viewMode !== 'half'
          return (
            <button key={d.day}
              onClick={clickable ? () => setSelectedDay(d.day) : undefined}
              style={{
                flexShrink:0, width:44, padding:'5px 0', borderRadius:7,
                border: isAnchor ? '2px solid #312e81' : 'none',
                cursor: clickable ? 'pointer' : 'default',
                fontSize:11, fontWeight:600, fontFamily:'inherit',
                background: inRange
                  ? (isAnchor ? '#312e81' : '#4f46e5')
                  : (d.isWeekend ? '#fff1f2' : '#e8edf4'),
                color: inRange
                  ? 'white'
                  : (d.isWeekend ? '#be123c' : '#64748b'),
              }}>
              <div>{d.day}</div><div style={{ fontSize:9, fontWeight:400 }}>{d.dow}</div>
            </button>
          )
        })}
      </div>

      {/* ── 集約サマリー（週/半月/月） ── */}
      {viewMode !== 'day' && (() => {
        const days = visibleDays
        const summaries = days.map(d => summarizeDay(d.day))
        const totals = summaries.reduce((acc, s) => ({
          plannedSalesYen: acc.plannedSalesYen + s.plannedSalesYen,
          peakRequiredSum: acc.peakRequiredSum + s.peakRequired,
          peakAssignedSum: acc.peakAssignedSum + s.peakAssigned,
          assignedHours:   acc.assignedHours   + s.assignedHours,
          estLaborYen:     acc.estLaborYen     + s.estLaborYen,
        }), { plannedSalesYen:0, peakRequiredSum:0, peakAssignedSum:0, assignedHours:0, estLaborYen:0 })
        const totalLaborRatio = totals.plannedSalesYen > 0
          ? (totals.estLaborYen / totals.plannedSalesYen * 100) : null

        const headLabel = viewMode === 'week'  ? '週サマリー (7日)'
                       : viewMode === 'half'  ? `半月サマリー (${half === 'first' ? '前半1〜15日' : `後半16〜${daysConfig.length}日`})`
                       : `月サマリー (${daysConfig.length}日)`

        const cellTd = { padding:'7px 8px', textAlign:'right', fontVariantNumeric:'tabular-nums', borderBottom:'1px solid #f1f5f9', fontSize:12, color:'#0F172A', whiteSpace:'nowrap' }
        const cellTh = { padding:'8px 8px', textAlign:'center', background:'#F1F5F9', fontWeight:700, fontSize:11.5, color:'#1e293b', borderBottom:'1px solid #cbd5e1', whiteSpace:'nowrap' }

        return (
          <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:10, padding:'14px 16px', boxShadow:'0 1px 3px rgba(15,23,42,0.05)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
              <h3 style={{ fontSize:13, fontWeight:700, color:'#0F172A', margin:0 }}>{headLabel}</h3>
              <span style={{ fontSize:11, color:'#94a3b8' }}>日付クリックで「日」ビューに切替</span>
            </div>
            <div style={{ overflowX:'auto' }}>
              <table style={{ borderCollapse:'collapse', minWidth:'100%', fontSize:12 }}>
                <thead>
                  <tr>
                    <th style={{ ...cellTh, textAlign:'left', position:'sticky', left:0, zIndex:2 }}>項目</th>
                    {summaries.map(s => (
                      <th key={s.day} style={{
                        ...cellTh,
                        cursor:'pointer',
                        color: s.isWeekend ? '#be123c' : cellTh.color,
                        background: s.isWeekend ? '#FEF2F2' : cellTh.background,
                      }}
                      onClick={() => { setViewMode('day'); setSelectedDay(s.day) }}>
                        <div>{s.day}日</div>
                        <div style={{ fontSize:10, fontWeight:400 }}>{s.dow}</div>
                      </th>
                    ))}
                    <th style={{ ...cellTh, background:'#94a3b8', color:'white' }}>合計/平均</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ ...cellTd, textAlign:'left', fontWeight:600, color:'#334155' }}>計画売上 (¥)</td>
                    {summaries.map(s => (
                      <td key={s.day} style={cellTd}>{Math.round(s.plannedSalesYen).toLocaleString()}</td>
                    ))}
                    <td style={{ ...cellTd, background:'#e8edf4', fontWeight:700 }}>{Math.round(totals.plannedSalesYen).toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td style={{ ...cellTd, textAlign:'left', fontWeight:600, color:'#334155' }}>ピーク必要人員</td>
                    {summaries.map(s => (
                      <td key={s.day} style={cellTd}>{s.peakRequired}</td>
                    ))}
                    <td style={{ ...cellTd, background:'#e8edf4', fontWeight:700 }}>—</td>
                  </tr>
                  <tr>
                    <td style={{ ...cellTd, textAlign:'left', fontWeight:600, color:'#334155' }}>ピーク配置人員</td>
                    {summaries.map(s => (
                      <td key={s.day} style={{
                        ...cellTd,
                        color: s.peakAssigned < s.peakRequired ? '#B91C1C' : '#0F172A',
                        fontWeight: s.peakAssigned < s.peakRequired ? 700 : 'normal',
                      }}>{s.peakAssigned}</td>
                    ))}
                    <td style={{ ...cellTd, background:'#e8edf4', fontWeight:700 }}>—</td>
                  </tr>
                  <tr>
                    <td style={{ ...cellTd, textAlign:'left', fontWeight:600, color:'#334155' }}>配置時間合計 (h)</td>
                    {summaries.map(s => (
                      <td key={s.day} style={cellTd}>{s.assignedHours.toFixed(1)}</td>
                    ))}
                    <td style={{ ...cellTd, background:'#e8edf4', fontWeight:700 }}>{totals.assignedHours.toFixed(1)}</td>
                  </tr>
                  <tr>
                    <td style={{ ...cellTd, textAlign:'left', fontWeight:600, color:'#334155' }}>概算人件費 (¥)</td>
                    {summaries.map(s => (
                      <td key={s.day} style={cellTd}>{Math.round(s.estLaborYen).toLocaleString()}</td>
                    ))}
                    <td style={{ ...cellTd, background:'#e8edf4', fontWeight:700 }}>{Math.round(totals.estLaborYen).toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td style={{ ...cellTd, textAlign:'left', fontWeight:600, color:'#334155' }}>人件比率 (%)</td>
                    {summaries.map(s => (
                      <td key={s.day} style={{
                        ...cellTd,
                        color: s.laborRatio == null ? '#94a3b8'
                          : s.laborRatio > 35 ? '#B91C1C'
                          : s.laborRatio > 30 ? '#92400E'
                          : '#0F172A',
                        fontWeight: s.laborRatio != null && s.laborRatio > 30 ? 700 : 'normal',
                      }}>
                        {s.laborRatio == null ? '—' : s.laborRatio.toFixed(1)}
                      </td>
                    ))}
                    <td style={{ ...cellTd, background:'#e8edf4', fontWeight:700 }}>
                      {totalLaborRatio == null ? '—' : totalLaborRatio.toFixed(1)}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ ...cellTd, textAlign:'left', fontWeight:600, color:'#334155' }}>特別業務 (件)</td>
                    {summaries.map(s => (
                      <td key={s.day} style={cellTd}>{s.taskCount}</td>
                    ))}
                    <td style={{ ...cellTd, background:'#e8edf4', fontWeight:700 }}>—</td>
                  </tr>

                  {/* スタッフ別の配置概要（期間の合計時間順） */}
                  {(() => {
                    // 期間内の各スタッフの合計時間を計算
                    const rows = staff.map(s => {
                      let totalHours = 0
                      const perDay = {}
                      for (const d of days) {
                        const code = shiftData[s.id]?.[d.day - 1] || 'X'
                        perDay[d.day] = code
                        const t = parseShiftTimes(code)
                        if (t) totalHours += Math.max(0, t.end - t.start - 1)
                      }
                      return { staff: s, totalHours, perDay }
                    }).filter(r => r.totalHours > 0)
                      .sort((a, b) => b.totalHours - a.totalHours)

                    if (rows.length === 0) return null
                    return (
                      <>
                        <tr>
                          <td colSpan={summaries.length + 2}
                            style={{ padding:'12px 8px 6px', fontSize:11, fontWeight:700, color:'#475569', background:'#FAFAFC', borderTop:'2px solid #cbd5e1' }}>
                            スタッフ別シフト ({rows.length} 名)
                          </td>
                        </tr>
                        {rows.map(({ staff: s, totalHours, perDay }) => (
                          <tr key={s.id}>
                            <td style={{ ...cellTd, textAlign:'left', fontWeight:600, color:'#0F172A', position:'sticky', left:0, background:'white' }}>
                              {s.name}
                              <span style={{ marginLeft:6, fontSize:10, color:'#94a3b8', fontWeight:500 }}>
                                {totalHours.toFixed(1)}h
                              </span>
                            </td>
                            {summaries.map(sum => {
                              const code = perDay[sum.day] || 'X'
                              const isOff = !code || code === 'X'
                              const isFull = code === 'F'
                              const isCloser = /-L$/.test(code) || /23$/.test(code)
                              const bg = isOff ? '#F8FAFC'
                                : isFull ? '#FEF3C7'
                                : isCloser ? '#FED7AA'
                                : '#E0E7FF'
                              const color = isOff ? '#94A3B8' : '#0F172A'
                              return (
                                <td key={sum.day} style={{
                                  ...cellTd, textAlign:'center', fontWeight:600,
                                  background: bg, color, fontFamily:'monospace', fontSize:11,
                                }}>
                                  {isOff ? '×' : code}
                                </td>
                              )
                            })}
                            <td style={{ ...cellTd, background:'#e8edf4', fontWeight:700, textAlign:'right' }}>
                              {totalHours.toFixed(1)}h
                            </td>
                          </tr>
                        ))}
                      </>
                    )
                  })()}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop:10, fontSize:11, color:'#64748b', display:'flex', gap:14, flexWrap:'wrap' }}>
              <span>⚠ <span style={{ color:'#B91C1C' }}>赤字</span>: 配置人員 &lt; 必要人員、または人件比率 35% 超過</span>
              <span style={{ display:'flex', alignItems:'center', gap:4 }}>
                <span style={{ width:12, height:12, background:'#FEF3C7', borderRadius:2, display:'inline-block' }} /> F (フルタイム)
              </span>
              <span style={{ display:'flex', alignItems:'center', gap:4 }}>
                <span style={{ width:12, height:12, background:'#FED7AA', borderRadius:2, display:'inline-block' }} /> 〜L (ラストまで)
              </span>
              <span style={{ display:'flex', alignItems:'center', gap:4 }}>
                <span style={{ width:12, height:12, background:'#E0E7FF', borderRadius:2, display:'inline-block' }} /> 通常
              </span>
            </div>
          </div>
        )
      })()}

      {/* ── Daily pattern selector ── */}
      {viewMode === 'day' && (
      <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', }}>
        <span style={{ fontSize:12, color:'#64748b' }}>{selectedDay}日のパターン:</span>
        {Object.entries(SALES_PATTERNS).map(([key, p]) => {
          const on = currentPatternKey === key
          return (
            <button key={key} onClick={() => setDayPatternMap(prev => ({ ...prev, [selectedDay]: key }))} style={{
              padding:'5px 14px', borderRadius:18, border:'none', cursor:'pointer', fontSize:12,
              fontWeight: on ? 700 : 500, fontFamily:'inherit',
              background: on ? '#4f46e5' : '#f0f5f9',
              color:      on ? 'white'   : '#475569',
            }}>{p.label}</button>
          )
        })}
        <span style={{ fontSize:11, color:'#94a3b8', marginLeft:'auto' }}>
          適用パターン売上合計: ¥{Object.values(currentPattern?.hourlySales || {}).reduce((a,b)=>a+b,0).toLocaleString()}
        </span>
      </div>
      )}

      {viewMode === 'day' && (
      <>
      {/* ── Special task toggles (per-day) ── */}
      {displayItems.specialTasks && (
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'flex-start', }}>
        <span style={{ fontSize:12, color:'#64748b', paddingTop:6 }}>特別業務:</span>
        {effectiveTasks.map(t => {
          const isEditing = editDayTask === t.id
          const ov = dayTaskOverrides[selectedDay]?.[t.id]
          return (
            <div key={t.id} style={{ display:'flex', flexDirection:'column', gap:4 }}>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <button
                  onClick={() => setDayOverride(selectedDay, t.id, { enabled: !t.enabled })}
                  style={{
                    fontSize:12, padding:'4px 12px', borderRadius:20, border:`1px solid ${t.enabled ? '#cbd5e1' : '#dde5f0'}`,
                    background: t.enabled ? '#eef2ff' : '#f8fafc', color: t.enabled ? '#1e293b' : '#94a3b8',
                    fontWeight: t.enabled ? 600 : 400, cursor:'pointer', fontFamily:'inherit',
                  }}>
                  {t.enabled ? '✓' : '○'} {t.name} ({t.startTime}〜{t.endTime} /{t.requiredStaff}名)
                </button>
                <button onClick={() => setEditDayTask(isEditing ? null : t.id)}
                  style={{ fontSize:10, color:'#6366f1', background:'none', border:'none', cursor:'pointer', textDecoration:'underline', fontFamily:'inherit' }}>
                  {isEditing ? '閉じる' : 'この日のみ変更'}
                </button>
                {ov && <span style={{ fontSize:10, color:'#f59e0b', fontWeight:600 }}>※上書き中</span>}
              </div>
              {isEditing && (
                <div style={{ display:'flex', gap:8, padding:'8px 12px', background:'#fafafa', border:'1px solid #e2e8f0', borderRadius:8, alignItems:'center', flexWrap:'wrap', fontSize:12 }}>
                  <label style={{ color:'#475569', fontWeight:600 }}>開始</label>
                  <input type="time" defaultValue={t.startTime.padStart(5,'0')}
                    onChange={e => setDayOverride(selectedDay, t.id, { startTime: e.target.value })}
                    style={{ padding:'3px 6px', borderRadius:6, border:'1px solid #dde5f0', fontSize:12, fontFamily:'inherit' }} />
                  <label style={{ color:'#475569', fontWeight:600 }}>終了</label>
                  <input type="time" defaultValue={t.endTime.padStart(5,'0')}
                    onChange={e => setDayOverride(selectedDay, t.id, { endTime: e.target.value })}
                    style={{ padding:'3px 6px', borderRadius:6, border:'1px solid #dde5f0', fontSize:12, fontFamily:'inherit' }} />
                  <label style={{ color:'#475569', fontWeight:600 }}>必要人数</label>
                  <input type="number" min={1} max={10} defaultValue={t.requiredStaff}
                    onChange={e => setDayOverride(selectedDay, t.id, { requiredStaff: Number(e.target.value) })}
                    style={{ width:48, padding:'3px 6px', borderRadius:6, border:'1px solid #dde5f0', fontSize:12, fontFamily:'inherit', textAlign:'center' }} />
                  <button onClick={() => { setDayTaskOverrides(prev => { const n = {...prev}; if(n[selectedDay]) { delete n[selectedDay][t.id] }; return n }); setEditDayTask(null) }}
                    style={{ fontSize:11, color:'#94a3b8', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit' }}>リセット</button>
                </div>
              )}
            </div>
          )
        })}
      </div>
      )}

      {/* ── 表示設定 (display items checkboxes) ── */}
      <div style={{ background:'white', border:'1px solid #dde5f0', borderRadius:8, padding:'8px 12px' }}>
        <button onClick={() => setShowDisplayPanel(v => !v)} style={{
          background:'none', border:'none', cursor:'pointer', padding:0, fontFamily:'inherit',
          fontSize:12, fontWeight:600, color:'#475569', display:'flex', alignItems:'center', gap:4,
        }}>
          <span style={{ fontSize:10, color:'#64748b' }}>{showDisplayPanel ? '▼' : '▶'}</span>
          表示設定
          <span style={{ fontSize:10, fontWeight:400, color:'#94a3b8', marginLeft:4 }}>※ 各表示項目における合計値は下書きシフトと確定シフトの合計となります。</span>
        </button>
        {showDisplayPanel && (
          <div style={{ marginTop:8, display:'flex', flexWrap:'wrap', gap:'6px 16px', fontSize:12 }}>
            {[
              { k:'salesPlan',      l:'売上予算' },
              { k:'salesActual',    l:'売上ACTUAL' },
              { k:'requiredStaff',  l:'必要人数' },
              { k:'assignedStaff',  l:'シフト人数' },
              { k:'skillBreakdown', l:'スキル別人員' },
              { k:'totalTime',      l:'合計時間' },
              { k:'specialTasks',   l:'業務内容' },
              { k:'workSummary',    l:'労働時間' },
              { k:'paySummary',     l:'概算人件費' },
            ].map(({ k, l }) => (
              <label key={k} style={{ display:'flex', alignItems:'center', gap:5, cursor:'pointer', userSelect:'none' }}>
                <input type="checkbox" checked={displayItems[k]} onChange={() => toggleDisplay(k)} style={{ accentColor:'#4f46e5' }} />
                <span style={{ color: displayItems[k] ? '#0f172a' : '#94a3b8' }}>{l}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* ── Main grid ── */}
      <div style={{ overflowX:'auto', background:'white', border:B, borderRadius:10, boxShadow:'0 1px 3px rgba(15,23,42,0.05)' }}>
        <table style={{ borderCollapse:'collapse', tableLayout:'fixed', minWidth:'max-content', fontSize:11, fontVariantNumeric:'tabular-nums' }}>
          <colgroup>
            <col style={{ width:LW }} />
            <col style={{ width:STW }} />
            <col style={{ width:ETW }} />
            {slots.map((_, i) => <col key={i} style={{ width:slotW }} />)}
            <col style={{ width:52 }} />
            {visibleSumm.map(s => <col key={s.k} style={{ width:s.w }} />)}
          </colgroup>
          <thead>
            <tr>
              <th rowSpan={2} style={th({ ...sH0, textAlign:'left' })}>指標</th>
              <th rowSpan={2} colSpan={2} style={th({ ...sH1 })}></th>
              {hours.map(h => <th key={h} colSpan={slots.filter(s => parseInt(s) === h).length} style={th({ borderBottom:'1px solid #cbd5e1' })}>{h}:00</th>)}
              <th rowSpan={2} style={th({ background:'#94a3b8', color:'white', fontWeight:700 })}>合計</th>
              <th rowSpan={2} colSpan={visibleSumm.length} style={{ border:B, background:'#e2e8f0' }} />
            </tr>
            <tr>
              {slots.map(slot => <th key={slot} style={th({ fontSize:10, fontWeight:400, color:'#94a3b8' })}>{slot.split(':')[1]}</th>)}
            </tr>
          </thead>
          <tbody>
            {/* ── 実行計画売上 ── */}
            {displayItems.salesPlan && (<>
            <tr>
              <td rowSpan={2} style={td({ ...sL0, textAlign:'left', background:'white', color:'#334155', fontWeight:600, borderRight:BB, lineHeight:1.4 })}>実行計画売上<br/><span style={{ fontSize:9, fontWeight:400 }}>(千円)</span></td>
              <td colSpan={2} style={td({ ...sL1, background:'white', color:'#64748b', fontSize:10 })}>PLAN</td>
              {slots.map(slot => { const v = slotSalesKen(slot); return <td key={slot} style={td({ color: v > 0 ? '#0f172a' : '#cbd5e1' })}>{v > 0 ? v : ''}</td> })}
              <td style={td({ background:'#e8edf4', color:'#1e293b', fontWeight:700 })}>{dayTarget?.sales ?? 0}</td>
              {visibleSumm.map(s => <td key={s.k} style={td()} />)}
            </tr>
            <tr>
              <td colSpan={2} style={td({ ...sL1, background:'white', color:'#94a3b8', fontSize:10 })}>累計</td>
              {cumSales.map((v, i) => <td key={i} style={td({ color:'#94a3b8', fontSize:10 })}>{v}</td>)}
              <td style={td()} />
              {visibleSumm.map(s => <td key={s.k} style={td()} />)}
            </tr>
            </>)}
            {/* ── 売上ACTUAL ── */}
            {displayItems.salesActual && (<>
            <tr>
              <td rowSpan={2} style={td({ ...sL0, textAlign:'left', background:'white', color:'#334155', fontWeight:600, borderRight:BB, lineHeight:1.4 })}>売上ACTUAL<br/><span style={{ fontSize:9, fontWeight:400 }}>(千円)</span></td>
              <td colSpan={2} style={td({ ...sL1, background:'white', color:'#64748b', fontSize:10 })}>ACTUAL</td>
              {slots.map(slot => <td key={slot} style={td()} />)}
              <td style={td()} />
              {visibleSumm.map(s => <td key={s.k} style={td()} />)}
            </tr>
            <tr>
              <td colSpan={2} style={td({ ...sL1, background:'white', color:'#94a3b8', fontSize:10 })}>累計</td>
              {slots.map(slot => <td key={slot} style={td()} />)}
              <td style={td()} />
              {visibleSumm.map(s => <td key={s.k} style={td()} />)}
            </tr>
            </>)}
            {/* ── 必要人員数 ── */}
            {displayItems.requiredStaff && (
            <tr>
              <td style={td({ ...sL0, textAlign:'left', background:'white', color:'#334155', fontWeight:600, borderRight:BB })}>必要人員数</td>
              <td colSpan={2} style={td({ ...sL1, background:'white', color:'#64748b', fontSize:10 })}>PLAN</td>
              {slots.map(slot => { const r = getRequired(slot); return <td key={slot} style={td({ fontWeight: r > 0 ? 600 : 400, color: r > 0 ? '#1e293b' : '#cbd5e1' })}>{r > 0 ? r.toFixed(2) : ''}</td> })}
              <td style={td({ background:'#e8edf4', color:'#1e293b', fontWeight:700 })}>{slots.reduce((s, slot) => s + getRequired(slot), 0).toFixed(2)}</td>
              {visibleSumm.map(s => <td key={s.k} style={td()} />)}
            </tr>
            )}
            {/* ── 配置済み人数 ── */}
            {displayItems.assignedStaff && (
            <tr>
              <td style={td({ ...sL0, textAlign:'left', background:'white', color:'#334155', fontWeight:600, borderRight:BB })}>配置済み人数</td>
              <td colSpan={2} style={td({ ...sL1, background:'white', color:'#64748b', fontSize:10 })}>実績</td>
              {slots.map(slot => { const cnt = getAssignedList(slot).length; const req = getRequired(slot); return <td key={slot} style={td({ ...reqColor(cnt, req), fontWeight:600 })}>{cnt > 0 ? cnt : ''}</td> })}
              <td style={td()} />
              {visibleSumm.map(s => <td key={s.k} style={td()} />)}
            </tr>
            )}
            {/* ── スキル別配置数 ── */}
            {displayItems.skillBreakdown && Object.entries(skillLabels).map(([key, label]) => (
              <tr key={key}>
                <td style={td({ ...sL0, textAlign:'left', background:'#fafafa', color:'#475569', fontWeight:600, borderRight:BB, fontSize:11 })}>
                  スキル: {label}<br/><span style={{ fontSize:9, fontWeight:400, color:'#94a3b8' }}>配置数</span>
                </td>
                <td colSpan={2} style={td({ ...sL1, background:'#fafafa', color:'#94a3b8', fontSize:10 })}>人数</td>
                {slots.map(slot => {
                  const cnt = getAssignedList(slot).filter(id => staff.find(s => s.id === id)?.skills.includes(key)).length
                  return <td key={slot} style={td({ background: cnt > 0 ? '#eef2ff' : '#fafafa', color: cnt > 0 ? '#3730a3' : '#e2e8f0', fontWeight: cnt > 0 ? 700 : 400 })}>{cnt > 0 ? cnt : ''}</td>
                })}
                <td style={td({ background:'#eef2ff', color:'#3730a3', fontWeight:700 })}>
                  {slots.reduce((s, slot) => s + getAssignedList(slot).filter(id => staff.find(m => m.id === id)?.skills.includes(key)).length, 0)}
                </td>
                {visibleSumm.map(s => <td key={s.k} style={td({ background:'#fafafa' })} />)}
              </tr>
            ))}

            {/* ── 合計時間 ── */}
            {displayItems.totalTime && (
            <tr>
              <td style={td({ ...sL0, textAlign:'left', background:'white', color:'#334155', fontWeight:600, borderRight:BB, borderBottom:'2px solid #cbd5e1' })}>合計時間</td>
              <td colSpan={2} style={td({ ...sL1, background:'white', color:'#64748b', fontSize:10, borderBottom:'2px solid #cbd5e1' })}>PLAN</td>
              {slots.map(slot => { const r = getRequired(slot); return <td key={slot} style={td({ color: r > 0 ? '#0f172a' : '#cbd5e1', borderBottom:'2px solid #cbd5e1' })}>{r > 0 ? r.toFixed(2) : ''}</td> })}
              <td style={td({ background:'#e8edf4', color:'#1e293b', fontWeight:700, borderBottom:'2px solid #cbd5e1' })}>{slots.reduce((s, slot) => s + getRequired(slot), 0).toFixed(2)}</td>
              {visibleSumm.map(s => <td key={s.k} style={td({ borderBottom:'2px solid #cbd5e1' })} />)}
            </tr>
            )}
          </tbody>

          <tbody>
            {/* ── STAFF section header ── */}
            <tr>
              <th rowSpan={2} style={th({ ...sH0, textAlign:'left' })}>スタッフ</th>
              <th rowSpan={2} colSpan={2} style={th({ ...sH1 })}>勤務時間</th>
              {hours.map(h => <th key={h} colSpan={slots.filter(s => parseInt(s) === h).length} style={th({ borderBottom:'1px solid #cbd5e1' })}>{h}:00</th>)}
              <th rowSpan={2} style={{ border:B, background:'#e2e8f0' }} />
              {visibleSumm.map(s => <th key={s.k} rowSpan={2} style={th({ background:'#94a3b8', color:'white', fontWeight:700 })}>{s.l}</th>)}
            </tr>
            <tr>
              {slots.map(slot => <th key={slot} style={th({ fontSize:10, fontWeight:400, color:'#94a3b8' })}>{slot.split(':')[1]}</th>)}
            </tr>
            {workingStaff.map((s, idx) => {
              const summ = getShiftSummary(s.id)
              const alert = isLateEarlyAlert(s.id)
              const rowBg = alert ? '#fff7ed' : idx % 2 === 0 ? 'white' : '#fafafa'
              const nameBg = alert ? '#fed7aa' : rowBg
              return (
                <tr key={s.id}>
                  <td style={td({ ...sL0, textAlign:'left', background:nameBg, fontWeight:600, color: alert ? '#9a3412' : '#0f172a', borderRight:BB })}>
                    {alert && <span style={{ fontSize:9, marginRight:4, color:'#ea580c' }}>⚠</span>}
                    {s.name}
                  </td>
                  <td style={td({ ...sL1, background:rowBg, textAlign:'center', color:'#64748b' })}>{summ ? summ.start.toFixed(2) : ''}</td>
                  <td style={td({ ...sL2, background:rowBg, textAlign:'center', color:'#64748b' })}>{summ ? summ.end.toFixed(2) : ''}</td>
                  {slots.map(slot => {
                    const w = isWorking(s.id, slot)
                    const a = getAssignedList(slot).includes(s.id)
                    const [sh, sm] = slot.split(':').map(Number)
                    const slotDec = sh + sm / 60
                    const isBreak = summ?.breakStart != null && slotDec >= summ.breakStart && slotDec < summ.breakEnd
                    let bg = rowBg
                    let color = '#6366f1'
                    if (a)       { bg = '#818cf8'; color = 'white' }
                    else if (isBreak && w) { bg = '#fed7aa'; color = '#9a3412' }
                    else if (w)  { bg = alert ? '#ffe4cc' : '#e0e7ff' }
                    return (
                      <td key={slot} onClick={() => toggleCell(s.id, slot)} style={td({
                        padding:0, textAlign:'center', cursor: w ? 'pointer' : 'default',
                        background: bg, color,
                      })}>
                        {isBreak && w && !a ? <span style={{ fontSize:8 }}>休</span> : w && !a ? <span style={{ fontSize:8 }}>·</span> : ''}
                      </td>
                    )
                  })}
                  <td style={td({ background:rowBg })} />
                  {visibleSumm.map(col => {
                    const v = summ ? (
                      col.k === 'work'         ? summ.work.toFixed(2) :
                      col.k === 'labor'        ? summ.labor.toFixed(2) :
                      col.k === 'overtime'     ? (summ.overtime > 0    ? summ.overtime.toFixed(2)    : '') :
                      col.k === 'lateNight'    ? (summ.lateNight > 0   ? summ.lateNight.toFixed(2)   : '') :
                      col.k === 'otLateNight'  ? (summ.otLateNight > 0 ? summ.otLateNight.toFixed(2) : '') :
                      col.k === 'pay'          ? `¥${summ.pay.toLocaleString()}` :
                      col.k === 'trans'        ? `¥${summ.trans.toLocaleString()}` : ''
                    ) : ''
                    return <td key={col.k} style={td({ background: rowBg, color:'#334155', fontWeight: v ? 500 : 400 })}>{v}</td>
                  })}
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr style={{ borderTop:'2px solid var(--pita-border-strong)' }}>
              <td style={td({ ...sL0, textAlign:'left', background:'var(--pita-bg-subtle)', fontWeight:700 })}>計{workingStaff.length}名</td>
              <td colSpan={2} style={td({ ...sL1, background:'var(--pita-bg-subtle)', textAlign:'left', fontSize:9, color:'var(--pita-muted)' })}>時間帯別計画時間</td>
              {slots.map(slot => { const r = getRequired(slot); return <td key={slot} style={td({ background:'var(--pita-bg-subtle)', fontWeight: r > 0 ? 700 : 400, color: r > 0 ? '#1e293b' : 'var(--pita-faint)' })}>{r > 0 ? r.toFixed(2) : ''}</td> })}
              <td style={td({ background:'var(--pita-bg-subtle)' })} />
              {visibleSumm.map(s => <td key={s.k} style={td({ background:'var(--pita-bg-subtle)' })} />)}
            </tr>
            <tr>
              <td style={td({ ...sL0, background:'var(--pita-bg-subtle)' })} />
              <td colSpan={2} style={td({ ...sL1, background:'var(--pita-bg-subtle)', textAlign:'left', fontSize:9, color:'var(--pita-muted)' })}>時間帯別人時売上高</td>
              {slots.map(slot => { const v = slotSalesPH(slot); return <td key={slot} style={td({ background:'var(--pita-bg-subtle)', fontSize:9, color:'var(--pita-muted)' })}>{v > 0 ? `¥${v.toLocaleString()}` : ''}</td> })}
              <td style={td({ background:'var(--pita-bg-subtle)' })} />
              {visibleSumm.map(s => <td key={s.k} style={td({ background:'var(--pita-bg-subtle)' })} />)}
            </tr>
          </tfoot>
        </table>
      </div>
      </>
      )}


      {/* ── Legend ── */}
      <div style={{ display:'flex', gap:16, fontSize:10, color:'var(--pita-muted)', flexWrap:'wrap', }}>
        {[
          { bg:'#818cf8',              color:'white',   label:'配置済み（クリックで解除）' },
          { bg:'#e0e7ff',              color:'#6366f1', label:'出勤中・未配置（クリックで配置）', border:B },
          { bg:'#fed7aa',              color:'#9a3412', label:'休憩時間帯' },
          { bg:'#fff7ed',              color:'#9a3412', label:'⚠ 遅番→早番アラート行', border:'1px solid #fed7aa' },
          { bg:'var(--pita-bg-subtle)', color:'',       label:'休み', border:B },
        ].map(({ bg, label, border: bd, color }) => (
          <span key={label} style={{ display:'flex', alignItems:'center', gap:4 }}>
            <span style={{ width:16, height:12, borderRadius:2, background:bg, border:bd, display:'inline-block' }} />
            <span style={{ color }}>{label}</span>
          </span>
        ))}
      </div>

      {/* ── Publish Modal ── */}
      {showPublish && (
        <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.45)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'white', borderRadius:16, width:'100%', maxWidth:440, boxShadow:'0 20px 60px rgba(15,23,42,0.18)' }}>
            <div style={{ padding:'20px 24px', borderBottom:'1px solid #e2e8f0' }}>
              <div style={{ fontSize:17, fontWeight:700, color:'#0f172a' }}>📢 シフト受付を開始する</div>
              <div style={{ fontSize:12, color:'#64748b', marginTop:4 }}>スタッフへシフト提出の通知を送ります</div>
            </div>
            <div style={{ padding:'20px 24px', display:'flex', flexDirection:'column', gap:16 }}>
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:'#475569', display:'block', marginBottom:8 }}>提出期限日</label>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <select value={publishEndDay} onChange={e => setPublishEndDay(Number(e.target.value))}
                    style={{ padding:'8px 12px', borderRadius:8, border:'1px solid #dde5f0', fontSize:13, color:'#0f172a', fontFamily:'inherit', outline:'none' }}>
                    {daysConfig.map(d => <option key={d.day} value={d.day}>{d.day}日({d.dow})</option>)}
                  </select>
                  <span style={{ fontSize:13, color:'#64748b' }}>まで</span>
                </div>
              </div>
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:'#475569', display:'block', marginBottom:6 }}>通知プレビュー</label>
                <div style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:8, padding:'12px 14px', fontSize:12, color:'#334155', lineHeight:1.7 }}>
                  【シフト受付開始】<br/>
                  {YEAR_MONTH}前半のシフト提出をお願いします。<br/>
                  {publishEndDay}日までにアプリからご提出ください。
                </div>
              </div>
            </div>
            <div style={{ padding:'12px 24px 20px', display:'flex', gap:10 }}>
              <button onClick={() => setShowPublish(false)} style={{ flex:1, padding:'10px 0', borderRadius:8, border:'1px solid #dde5f0', background:'white', color:'#475569', fontSize:13, fontWeight:600, cursor:'pointer' }}>キャンセル</button>
              <button onClick={handlePublish} style={{ flex:1, padding:'10px 0', borderRadius:8, border:'none', background:'#f59e0b', color:'white', fontSize:13, fontWeight:700, cursor:'pointer' }}>通知を送る</button>
            </div>
          </div>
        </div>
      )}

      {/* ── AI Modal ── */}
      {showAI && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            {aiPhase === 'select' && (
              <div className="p-6">
                <h3 className="font-bold text-gray-900 text-lg mb-1">AI自動配置 — 対象日を選択</h3>
                <p className="text-sm text-gray-500 mb-4">配置を自動生成する日にちを選択してください</p>
                <div className="flex items-center gap-2 mb-3">
                  <button onClick={() => setAIDays(new Set(daysConfig.map(d => d.day)))} className="text-xs px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 font-medium">全選択</button>
                  <button onClick={() => setAIDays(new Set())} className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 font-medium">全解除</button>
                  <span className="ml-auto text-xs text-gray-500">{aiDays.size}日 選択中</span>
                </div>
                <div className="grid grid-cols-5 gap-1.5 mb-5">
                  {daysConfig.map(d => (
                    <button key={d.day} onClick={() => toggleAIDay(d.day)} className={`py-2 rounded-lg text-xs font-medium transition-colors border ${aiDays.has(d.day) ? 'bg-blue-600 text-white border-blue-600' : d.isWeekend ? 'bg-red-50 text-red-400 border-red-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                      <div>{d.day}日</div><div className="text-[9px] opacity-70">{d.dow}</div>
                    </button>
                  ))}
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-5 text-xs text-blue-700">
                  <div className="font-semibold mb-1">AI配置の最適化基準:</div>
                  <div className="space-y-0.5 text-blue-600">
                    <div>① 相性の悪いスタッフを同時間帯に配置しない</div>
                    <div>② 目標月収に近づくよう稼働時間を考慮</div>
                    <div>③ 残留優先度の高いスタッフを優先配置</div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setShowAI(false)} className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-lg text-sm hover:bg-gray-50">キャンセル</button>
                  <button onClick={runAI} disabled={aiDays.size === 0} className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-40">✨ AI配置を実行</button>
                </div>
              </div>
            )}
            {aiPhase === 'loading' && (
              <div className="p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center">
                  <span className="text-2xl animate-spin inline-block">✨</span>
                </div>
                <h3 className="font-bold text-gray-900 mb-5">AI が最適配置を計算中...</h3>
                <div className="space-y-3 text-left">
                  {AI_STAGES.map((stage, i) => (
                    <div key={i} className={`flex items-center gap-3 text-sm ${i <= aiStage ? 'text-blue-700' : 'text-gray-300'}`}>
                      <span className="w-5 text-center font-bold">{i < aiStage ? '✓' : i === aiStage ? '⟳' : '○'}</span>
                      {stage}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {aiPhase === 'done' && aiResult && (
              <div className="p-6 text-center">
                <div className="text-4xl mb-3">🎉</div>
                <h3 className="font-bold text-gray-900 text-lg mb-1">AI配置が完了しました</h3>
                <p className="text-sm text-gray-500 mb-5">{aiResult.days.slice(0,5).join('・')}日{aiResult.days.length > 5 ? ` ほか${aiResult.days.length-5}日` : ''}のシフトを最適化</p>
                <div className="grid grid-cols-3 gap-3 mb-6">
                  {[
                    { label:'対象日数',     value:`${aiResult.days.length}日`,      color:'bg-indigo-50 text-indigo-800' },
                    { label:'相性問題回避', value:`${aiResult.avoidedConflicts}件`, color:'bg-green-50 text-green-800' },
                    { label:'収入目標考慮', value:`${aiResult.staffWithTargets}名`, color:'bg-purple-50 text-purple-800' },
                  ].map((k, i) => (
                    <div key={i} className={`rounded-xl p-3 ${k.color}`}>
                      <div className="text-2xl font-bold">{k.value}</div>
                      <div className="text-[11px] opacity-70 mt-0.5">{k.label}</div>
                    </div>
                  ))}
                </div>
                <button onClick={() => setShowAI(false)} className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-semibold hover:bg-blue-700">確認する</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── カレンダー Modal ── */}
      {showCalendar && (
        <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.45)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
          onClick={() => setShowCalendar(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background:'white', borderRadius:16, width:'100%', maxWidth:680, boxShadow:'0 20px 60px rgba(15,23,42,0.18)', padding:'24px 28px' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
              <div>
                <div style={{ fontSize:16, fontWeight:700, color:'#0f172a' }}>カレンダー — {YEAR_MONTH}</div>
                <div style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>日付をクリックすると、その日のシフト編集に移動します</div>
              </div>
              <button onClick={() => setShowCalendar(false)} style={{ fontSize:20, lineHeight:1, background:'none', border:'none', cursor:'pointer', color:'#94a3b8' }}>×</button>
            </div>
            {/* 7-col calendar grid */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:4, fontSize:11 }}>
              {['日','月','火','水','木','金','土'].map(w => (
                <div key={w} style={{
                  textAlign:'center', padding:'6px 0', fontWeight:700, fontSize:11,
                  color: w === '土' ? '#2563eb' : w === '日' ? '#dc2626' : '#475569',
                }}>{w}</div>
              ))}
              {(() => {
                const dowIndex = ['日','月','火','水','木','金','土']
                const firstDow = dowIndex.indexOf(daysConfig[0]?.dow || '水')
                const blanks = Array.from({ length: firstDow }, (_, i) => <div key={`b${i}`} />)
                const cells = daysConfig.map(d => {
                  const cnt = staff.reduce((acc, s) => {
                    const code = shiftData[s.id]?.[d.day - 1]
                    return acc + (code && code !== 'X' ? 1 : 0)
                  }, 0)
                  const isSel = d.day === selectedDay
                  return (
                    <button key={d.day} onClick={() => { setSelectedDay(d.day); setHalf(d.day <= 15 ? 'first' : 'second'); setShowCalendar(false); setViewMode('day') }} style={{
                      padding:'10px 6px', borderRadius:8, border:`1px solid ${isSel ? '#4f46e5' : '#e2e8f0'}`,
                      background: isSel ? '#eef2ff' : 'white',
                      cursor:'pointer', fontFamily:'inherit', textAlign:'center', minHeight:64,
                      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-start', gap:4,
                    }}>
                      <span style={{ fontSize:13, fontWeight:700, color: d.dow === '土' ? '#2563eb' : d.dow === '日' ? '#dc2626' : '#0f172a' }}>{d.day}</span>
                      <span style={{ fontSize:9, color:'#94a3b8' }}>{cnt}名出勤</span>
                    </button>
                  )
                })
                return [...blanks, ...cells]
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ── CSV Upload Modal ── */}
      {showCsvModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.45)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'white', borderRadius:16, width:'100%', maxWidth:560, maxHeight:'90vh', display:'flex', flexDirection:'column', boxShadow:'0 20px 60px rgba(15,23,42,0.18)' }}>
            <div style={{ padding:'20px 24px', borderBottom:'1px solid #e2e8f0', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div>
                <div style={{ fontSize:17, fontWeight:700, color:'#0f172a' }}>シフト決定 CSV / Excel アップロード</div>
                <div style={{ fontSize:12, color:'#64748b', marginTop:3 }}>シフトデータを CSV / Excel から一括取込できます (バージョン: 「{currentVersion.name}」)</div>
              </div>
              <button onClick={() => setShowCsvModal(false)} style={{ fontSize:20, lineHeight:1, background:'none', border:'none', cursor:'pointer', color:'#94a3b8' }}>×</button>
            </div>
            <div style={{ padding:'20px 24px', display:'flex', flexDirection:'column', gap:20, overflowY:'auto' }}>

              {/* Section 1: ピタシフ */}
              <div style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:12, padding:'16px 18px' }}>
                <div style={{ fontSize:14, fontWeight:700, color:'#0f172a', marginBottom:14 }}>ピタシフのフォーマットを使う場合</div>
                <div style={{ marginBottom:14 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:'#334155', marginBottom:4 }}>① フォーマットをダウンロード</div>
                  <div style={{ fontSize:11, color:'#64748b', marginBottom:4, lineHeight:1.6 }}>
                    CSVの形式: <code style={{ background:'#e8edf4', padding:'1px 5px', borderRadius:4 }}>{PITASHIFT_SHIFT_HEADER.join(',')}</code>
                  </div>
                  <div style={{ fontSize:10.5, color:'#94a3b8', marginBottom:6 }}>氏名で既存スタッフを照合します。日にちはYYYY/M/D形式。</div>
                  <div style={{ fontSize:10.5, color:'#4f46e5', marginBottom:10 }}>
                    <strong>Excel (.xlsx) もそのままアップロード可</strong>: 「ｼﾌﾄ原本」シートの NO. 列と E〜AI 列のシフトコード (F / X / 9-18 / O-16 / 13-L 等) を1〜31日として取り込みます。
                  </div>
                  <button onClick={downloadShiftCsvFormat} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:8, border:'1px solid #4f46e5', background:'white', color:'#4f46e5', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                    ↓ フォーマットをダウンロード
                  </button>
                </div>
                <div style={{ marginBottom:12 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:'#334155', marginBottom:8 }}>② CSV / Excel ファイルを選択</div>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <button onClick={() => csvFileRef.current?.click()} style={{ padding:'8px 16px', borderRadius:8, border:'1px solid #dde5f0', background:'white', color:'#475569', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
                      ファイルを選択
                    </button>
                    <input ref={csvFileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
                      onChange={e => { setPendingCsvFile(e.target.files?.[0] || null); e.target.value = '' }} />
                    <span style={{ fontSize:12, color: pendingCsvFile ? '#0f172a' : '#94a3b8', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {pendingCsvFile ? pendingCsvFile.name : 'ファイルが選択されていません'}
                    </span>
                  </div>
                </div>
                <button onClick={executePitashiftShiftUploadAny} disabled={!pendingCsvFile} style={{ padding:'9px 18px', borderRadius:8, border:'none', background: pendingCsvFile ? '#4f46e5' : '#c7d2fe', color:'white', fontSize:13, fontWeight:600, cursor: pendingCsvFile ? 'pointer' : 'not-allowed', fontFamily:'inherit' }}>アップロードを実行</button>
              </div>

              {/* Section 2: 別フォーマット */}
              <div style={{ background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:12, padding:'16px 18px' }}>
                <div style={{ fontSize:14, fontWeight:700, color:'#0f172a', marginBottom:14 }}>別のフォーマットでアップロード</div>
                <div style={{ marginBottom:14 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:'#334155', marginBottom:8 }}>① フォーマットを選択</div>
                  <select value={altCsvFormat} onChange={e => setAltCsvFormat(e.target.value)} style={{
                    padding:'8px 12px', borderRadius:8, border:'1px solid #fed7aa', background:'white',
                    fontSize:13, fontWeight:600, color:'#334155', cursor:'pointer', fontFamily:'inherit', minWidth:160,
                  }}>
                    <option value="airreji">Airレジ</option>
                  </select>
                  <div style={{ fontSize:10.5, color:'#9a3412', marginTop:6, lineHeight:1.5 }}>
                    {altCsvFormat === 'airreji' && 'Airレジ「シフト管理」CSVをそのままアップロードできます。氏名・日付・開始/終了時間からシフトを取り込み、ピタシフ形式に変換して反映します。'}
                  </div>
                </div>
                <div style={{ marginBottom:12 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:'#334155', marginBottom:8 }}>② CSVファイルを選択</div>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <button onClick={() => csvAltFileRef.current?.click()} style={{ padding:'8px 16px', borderRadius:8, border:'1px solid #fed7aa', background:'white', color:'#9a3412', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
                      ファイルを選択
                    </button>
                    <input ref={csvAltFileRef} type="file" accept=".csv" className="hidden"
                      onChange={e => { setPendingAltCsvFile(e.target.files?.[0] || null); e.target.value = '' }} />
                    <span style={{ fontSize:12, color: pendingAltCsvFile ? '#0f172a' : '#94a3b8', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {pendingAltCsvFile ? pendingAltCsvFile.name : 'ファイルが選択されていません'}
                    </span>
                  </div>
                </div>
                <button onClick={executeAirrejiShiftUpload} disabled={!pendingAltCsvFile} style={{ padding:'9px 18px', borderRadius:8, border:'none', background: pendingAltCsvFile ? '#ea580c' : '#fed7aa', color:'white', fontSize:13, fontWeight:600, cursor: pendingAltCsvFile ? 'pointer' : 'not-allowed', fontFamily:'inherit' }}>アップロードを実行</button>
              </div>

            </div>
            <div style={{ padding:'14px 24px', borderTop:'1px solid #e2e8f0', display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button onClick={() => { setShowCsvModal(false); setPendingCsvFile(null); setPendingAltCsvFile(null) }} style={{ padding:'9px 18px', borderRadius:8, border:'1px solid #dde5f0', background:'white', color:'#475569', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>閉じる</button>
            </div>
          </div>
        </div>
      )}
      {/* hidden marker for shiftDataVersion: {shiftDataVersion} */}
    </div>
  )
}
