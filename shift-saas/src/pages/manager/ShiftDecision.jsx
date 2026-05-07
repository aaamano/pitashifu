import { useState, useMemo } from 'react'
import {
  staff, daysConfig, shiftData, assignedShifts, YEAR_MONTH,
  storeConfig, staffConstraints, dailyTargets, ORDER_DISTRIBUTION,
  generateSlots, parseShiftTimes, calcRequiredStaff, skillLabels,
  decomposeShiftHours, calcDailyPay, SALES_PATTERNS, dayPatterns as initialDayPatterns,
} from '../../data/mockData'

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

function runAIForDays(days, slots, staffList, constraints, targets, specialTasks) {
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
        let score = (11 - (constraints[s.id]?.retentionPriority ?? 5)) * 10
        const alreadyIn = dayAssign[slot] || []
        for (const { staffId, severity } of (constraints[s.id]?.incompatible ?? [])) {
          if (alreadyIn.includes(staffId)) { score -= severity * 15; avoidedConflicts++ }
        }
        if ((constraints[s.id]?.targetEarnings ?? 0) > 0) score += 8
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
  const [selectedDay,  setSelectedDay]  = useState(1)
  const [assigned,     setAssigned]     = useState(assignedShifts)
  const [specialTasks, setSpecialTasks] = useState(storeConfig.specialTasks)
  const [showAI,        setShowAI]       = useState(false)
  const [aiPhase,       setAIPhase]      = useState('select')
  const [aiStage,       setAIStage]      = useState(0)
  const [aiDays,        setAIDays]       = useState(() => new Set(daysConfig.map(d => d.day)))
  const [aiResult,      setAIResult]     = useState(null)
  const [dayTaskOverrides, setDayTaskOverrides] = useState({})  // { [day]: { [taskId]: Partial<Task> } }
  const [editDayTask,      setEditDayTask]      = useState(null) // taskId being edited for the day
  const [dayPatternMap,    setDayPatternMap]    = useState(initialDayPatterns) // day -> pattern key
  const [half,             setHalf]             = useState('first') // 'first' | 'second'
  const visibleDays = daysConfig.filter(d => half === 'first' ? d.day <= 15 : d.day >= 16)
  const [shiftStatus,      setShiftStatus]      = useState('draft')   // 'draft' | 'confirmed'
  const [saveFlash,     setSaveFlash]    = useState('')          // 'saved' | 'confirmed' | ''
  const [showPublish,   setShowPublish]  = useState(false)
  const [publishEndDay, setPublishEndDay] = useState(15)
  const [published,     setPublished]    = useState(false)

  const handleSaveDraft = () => {
    setShiftStatus('draft')
    setSaveFlash('saved')
    setTimeout(() => setSaveFlash(''), 2000)
  }
  const handleConfirm = () => {
    setShiftStatus('confirmed')
    setSaveFlash('confirmed')
    setTimeout(() => setSaveFlash(''), 2000)
  }
  const handlePublish = () => {
    setPublished(true)
    setShowPublish(false)
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
    if (!isWorking(staffId, slot)) return
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

  const getShiftSummary = (staffId) => {
    const code = shiftData[staffId]?.[selectedDay - 1] || 'X'
    const t = parseShiftTimes(code)
    if (!t) return null
    const member = staff.find(s => s.id === staffId)
    const wage   = member?.wage ?? 1050
    const trans  = member?.transitPerDay ?? 0
    const { work, labor, overtime, lateNight, otLateNight } = decomposeShiftHours(t.start, t.end)
    const pay = calcDailyPay(wage, labor, overtime, lateNight, otLateNight)
    return { start: t.start, end: t.end, work, labor, overtime, lateNight, otLateNight, pay: Math.round(pay), trans }
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

  const workingStaff = staff.filter(s => getShiftSummary(s.id) !== null)

  const openAI = () => { setAIDays(new Set(daysConfig.map(d => d.day))); setAIResult(null); setAIPhase('select'); setShowAI(true) }
  const runAI = async () => {
    setAIPhase('loading'); setAIStage(0)
    for (let i = 0; i < AI_STAGES.length; i++) { setAIStage(i); await new Promise(r => setTimeout(r, 700)) }
    const days = [...aiDays].sort((a, b) => a - b)
    const { result, avoidedConflicts, staffWithTargets, totalAssigned } = runAIForDays(days, slots, staff, staffConstraints, dailyTargets, specialTasks)
    setAssigned(prev => ({ ...prev, ...result }))
    setAIResult({ days, avoidedConflicts, staffWithTargets, totalAssigned })
    setAIPhase('done')
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
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden', padding:'20px 24px 16px', background:'#f0f5f9', gap:12 }}>

      {/* ── Header ── */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:10, flexShrink:0 }}>
        <div>
          <div style={{ fontSize:11, color:'#94a3b8', marginBottom:4 }}>{YEAR_MONTH} 前半</div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <h1 style={{ fontSize:22, fontWeight:700, color:'#0f172a', margin:0, letterSpacing:'-0.01em' }}>シフト決定 — 時間帯人員配置</h1>
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
          <button onClick={handleSaveDraft} style={{ padding:'8px 14px', borderRadius:8, border:'1px solid #dde5f0', background:'white', color:'#334155', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>下書き保存</button>
          <button onClick={handleConfirm} style={{ padding:'8px 14px', borderRadius:8, border:'none', background:'#10b981', color:'white', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>シフト確定</button>
          <button onClick={() => setShowPublish(true)} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:8, border:'none', background:'#f59e0b', color:'white', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>📢 シフト展開</button>
          <button onClick={openAI} style={{ display:'flex', alignItems:'center', gap:6, border:'none', borderRadius:8, padding:'8px 14px', fontSize:12, fontWeight:600, cursor:'pointer', color:'white', background:'#4f46e5', fontFamily:'inherit' }}>✨ AI自動配置</button>
        </div>
      </div>

      {/* ── Half toggle ── */}
      <div style={{ display:'flex', gap:6, alignItems:'center', flexShrink:0 }}>
        <span style={{ fontSize:12, color:'#64748b' }}>期間:</span>
        {[{ k:'first', l:'前半 (1〜15日)' }, { k:'second', l:'後半 (16〜30日)' }].map(o => (
          <button key={o.k} onClick={() => { setHalf(o.k); setSelectedDay(o.k === 'first' ? 1 : 16) }} style={{
            padding:'5px 14px', borderRadius:18, fontSize:12, fontWeight: half === o.k ? 700 : 500,
            background: half === o.k ? '#4f46e5' : '#f0f5f9',
            color:      half === o.k ? 'white'   : '#475569',
            border:'none', cursor:'pointer', fontFamily:'inherit',
          }}>{o.l}</button>
        ))}
      </div>

      {/* ── Day selector ── */}
      <div style={{ display:'flex', gap:4, overflowX:'auto', paddingBottom:2, flexShrink:0 }}>
        {visibleDays.map(d => (
          <button key={d.day} onClick={() => setSelectedDay(d.day)} style={{
            flexShrink:0, width:44, padding:'5px 0', borderRadius:7, border:'none', cursor:'pointer',
            fontSize:11, fontWeight:600, fontFamily:'inherit',
            background: selectedDay === d.day ? '#4f46e5' : d.isWeekend ? '#fff1f2' : '#e8edf4',
            color: selectedDay === d.day ? 'white' : d.isWeekend ? '#be123c' : '#64748b',
          }}>
            <div>{d.day}</div><div style={{ fontSize:9, fontWeight:400 }}>{d.dow}</div>
          </button>
        ))}
      </div>

      {/* ── Daily pattern selector ── */}
      <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', flexShrink:0 }}>
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

      {/* ── Special task toggles (per-day) ── */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'flex-start', flexShrink:0 }}>
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

      {/* ── Main grid ── */}
      <div style={{ flex:1, minHeight:0, overflowX:'auto', overflowY:'auto', background:'white', border:B, borderRadius:10, boxShadow:'0 1px 3px rgba(15,23,42,0.05)' }}>
        <table style={{ borderCollapse:'collapse', tableLayout:'fixed', minWidth:'max-content', fontSize:11, fontVariantNumeric:'tabular-nums' }}>
          <colgroup>
            <col style={{ width:LW }} />
            <col style={{ width:STW }} />
            <col style={{ width:ETW }} />
            {slots.map((_, i) => <col key={i} style={{ width:slotW }} />)}
            <col style={{ width:52 }} />
            {SUMM.map(s => <col key={s.k} style={{ width:s.w }} />)}
          </colgroup>
          <thead>
            <tr>
              <th rowSpan={2} style={th({ ...sH0, textAlign:'left' })}>指標</th>
              <th rowSpan={2} colSpan={2} style={th({ ...sH1 })}></th>
              {hours.map(h => <th key={h} colSpan={slots.filter(s => parseInt(s) === h).length} style={th({ borderBottom:'1px solid #cbd5e1' })}>{h}:00</th>)}
              <th rowSpan={2} style={th({ background:'#94a3b8', color:'white', fontWeight:700 })}>合計</th>
              <th rowSpan={2} colSpan={SUMM.length} style={{ border:B, background:'#e2e8f0' }} />
            </tr>
            <tr>
              {slots.map(slot => <th key={slot} style={th({ fontSize:10, fontWeight:400, color:'#94a3b8' })}>{slot.split(':')[1]}</th>)}
            </tr>
          </thead>
          <tbody>
            {/* ── 実行計画売上 ── */}
            <tr>
              <td rowSpan={2} style={td({ ...sL0, textAlign:'left', background:'white', color:'#334155', fontWeight:600, borderRight:BB, lineHeight:1.4 })}>実行計画売上<br/><span style={{ fontSize:9, fontWeight:400 }}>(千円)</span></td>
              <td colSpan={2} style={td({ ...sL1, background:'white', color:'#64748b', fontSize:10 })}>PLAN</td>
              {slots.map(slot => { const v = slotSalesKen(slot); return <td key={slot} style={td({ color: v > 0 ? '#0f172a' : '#cbd5e1' })}>{v > 0 ? v : ''}</td> })}
              <td style={td({ background:'#e8edf4', color:'#1e293b', fontWeight:700 })}>{dayTarget?.sales ?? 0}</td>
              {SUMM.map(s => <td key={s.k} style={td()} />)}
            </tr>
            <tr>
              <td colSpan={2} style={td({ ...sL1, background:'white', color:'#94a3b8', fontSize:10 })}>累計</td>
              {cumSales.map((v, i) => <td key={i} style={td({ color:'#94a3b8', fontSize:10 })}>{v}</td>)}
              <td style={td()} />
              {SUMM.map(s => <td key={s.k} style={td()} />)}
            </tr>
            {/* ── 売上ACTUAL ── */}
            <tr>
              <td rowSpan={2} style={td({ ...sL0, textAlign:'left', background:'white', color:'#334155', fontWeight:600, borderRight:BB, lineHeight:1.4 })}>売上ACTUAL<br/><span style={{ fontSize:9, fontWeight:400 }}>(千円)</span></td>
              <td colSpan={2} style={td({ ...sL1, background:'white', color:'#64748b', fontSize:10 })}>ACTUAL</td>
              {slots.map(slot => <td key={slot} style={td()} />)}
              <td style={td()} />
              {SUMM.map(s => <td key={s.k} style={td()} />)}
            </tr>
            <tr>
              <td colSpan={2} style={td({ ...sL1, background:'white', color:'#94a3b8', fontSize:10 })}>累計</td>
              {slots.map(slot => <td key={slot} style={td()} />)}
              <td style={td()} />
              {SUMM.map(s => <td key={s.k} style={td()} />)}
            </tr>
            {/* ── 必要人員数 ── */}
            <tr>
              <td style={td({ ...sL0, textAlign:'left', background:'white', color:'#334155', fontWeight:600, borderRight:BB })}>必要人員数</td>
              <td colSpan={2} style={td({ ...sL1, background:'white', color:'#64748b', fontSize:10 })}>PLAN</td>
              {slots.map(slot => { const r = getRequired(slot); return <td key={slot} style={td({ fontWeight: r > 0 ? 600 : 400, color: r > 0 ? '#1e293b' : '#cbd5e1' })}>{r > 0 ? r.toFixed(2) : ''}</td> })}
              <td style={td({ background:'#e8edf4', color:'#1e293b', fontWeight:700 })}>{slots.reduce((s, slot) => s + getRequired(slot), 0).toFixed(2)}</td>
              {SUMM.map(s => <td key={s.k} style={td()} />)}
            </tr>
            {/* ── 配置済み人数 ── */}
            <tr>
              <td style={td({ ...sL0, textAlign:'left', background:'white', color:'#334155', fontWeight:600, borderRight:BB })}>配置済み人数</td>
              <td colSpan={2} style={td({ ...sL1, background:'white', color:'#64748b', fontSize:10 })}>実績</td>
              {slots.map(slot => { const cnt = getAssignedList(slot).length; const req = getRequired(slot); return <td key={slot} style={td({ ...reqColor(cnt, req), fontWeight:600 })}>{cnt > 0 ? cnt : ''}</td> })}
              <td style={td()} />
              {SUMM.map(s => <td key={s.k} style={td()} />)}
            </tr>
            {/* ── スキル別配置数 ── */}
            {Object.entries(skillLabels).map(([key, label]) => (
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
                {SUMM.map(s => <td key={s.k} style={td({ background:'#fafafa' })} />)}
              </tr>
            ))}

            {/* ── 合計時間 ── */}
            <tr>
              <td style={td({ ...sL0, textAlign:'left', background:'white', color:'#334155', fontWeight:600, borderRight:BB, borderBottom:'2px solid #cbd5e1' })}>合計時間</td>
              <td colSpan={2} style={td({ ...sL1, background:'white', color:'#64748b', fontSize:10, borderBottom:'2px solid #cbd5e1' })}>PLAN</td>
              {slots.map(slot => { const r = getRequired(slot); return <td key={slot} style={td({ color: r > 0 ? '#0f172a' : '#cbd5e1', borderBottom:'2px solid #cbd5e1' })}>{r > 0 ? r.toFixed(2) : ''}</td> })}
              <td style={td({ background:'#e8edf4', color:'#1e293b', fontWeight:700, borderBottom:'2px solid #cbd5e1' })}>{slots.reduce((s, slot) => s + getRequired(slot), 0).toFixed(2)}</td>
              {SUMM.map(s => <td key={s.k} style={td({ borderBottom:'2px solid #cbd5e1' })} />)}
            </tr>
          </tbody>

          <tbody>
            {/* ── STAFF section header ── */}
            <tr>
              <th rowSpan={2} style={th({ ...sH0, textAlign:'left' })}>スタッフ</th>
              <th rowSpan={2} colSpan={2} style={th({ ...sH1 })}>勤務時間</th>
              {hours.map(h => <th key={h} colSpan={slots.filter(s => parseInt(s) === h).length} style={th({ borderBottom:'1px solid #cbd5e1' })}>{h}:00</th>)}
              <th rowSpan={2} style={{ border:B, background:'#e2e8f0' }} />
              {SUMM.map(s => <th key={s.k} rowSpan={2} style={th({ background:'#94a3b8', color:'white', fontWeight:700 })}>{s.l}</th>)}
            </tr>
            <tr>
              {slots.map(slot => <th key={slot} style={th({ fontSize:10, fontWeight:400, color:'#94a3b8' })}>{slot.split(':')[1]}</th>)}
            </tr>
            {workingStaff.map((s, idx) => {
              const summ = getShiftSummary(s.id)
              const rowBg = idx % 2 === 0 ? 'white' : '#fafafa'
              return (
                <tr key={s.id}>
                  <td style={td({ ...sL0, textAlign:'left', background:rowBg, fontWeight:600, color:'#0f172a', borderRight:BB })}>{s.name}</td>
                  <td style={td({ ...sL1, background:rowBg, textAlign:'center', color:'#64748b' })}>{summ ? summ.start.toFixed(2) : ''}</td>
                  <td style={td({ ...sL2, background:rowBg, textAlign:'center', color:'#64748b' })}>{summ ? summ.end.toFixed(2) : ''}</td>
                  {slots.map(slot => {
                    const w = isWorking(s.id, slot)
                    const a = getAssignedList(slot).includes(s.id)
                    return (
                      <td key={slot} onClick={() => toggleCell(s.id, slot)} style={td({
                        padding:0, textAlign:'center', cursor: w ? 'pointer' : 'default',
                        background: a ? '#818cf8' : w ? '#e0e7ff' : rowBg,
                        color: a ? 'white' : '#6366f1',
                      })}>
                        {w && !a ? <span style={{ fontSize:8 }}>·</span> : ''}
                      </td>
                    )
                  })}
                  <td style={td({ background:rowBg })} />
                  {SUMM.map(col => {
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
              {SUMM.map(s => <td key={s.k} style={td({ background:'var(--pita-bg-subtle)' })} />)}
            </tr>
            <tr>
              <td style={td({ ...sL0, background:'var(--pita-bg-subtle)' })} />
              <td colSpan={2} style={td({ ...sL1, background:'var(--pita-bg-subtle)', textAlign:'left', fontSize:9, color:'var(--pita-muted)' })}>時間帯別人時売上高</td>
              {slots.map(slot => { const v = slotSalesPH(slot); return <td key={slot} style={td({ background:'var(--pita-bg-subtle)', fontSize:9, color:'var(--pita-muted)' })}>{v > 0 ? `¥${v.toLocaleString()}` : ''}</td> })}
              <td style={td({ background:'var(--pita-bg-subtle)' })} />
              {SUMM.map(s => <td key={s.k} style={td({ background:'var(--pita-bg-subtle)' })} />)}
            </tr>
          </tfoot>
        </table>
      </div>


      {/* ── Legend ── */}
      <div style={{ display:'flex', gap:16, fontSize:10, color:'var(--pita-muted)', flexWrap:'wrap', flexShrink:0 }}>
        {[
          { bg:'var(--pita-shift-work)', label:'配置済み（クリックで解除）' },
          { bg:'var(--pita-shift-soft)', label:'出勤中・未配置（クリックで配置）', border:B },
          { bg:'var(--pita-bg-subtle)',  label:'休み', border:B },
        ].map(({ bg, label, border: bd }) => (
          <span key={label} style={{ display:'flex', alignItems:'center', gap:4 }}>
            <span style={{ width:16, height:12, borderRadius:2, background:bg, border:bd, display:'inline-block' }} />
            {label}
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
    </div>
  )
}
