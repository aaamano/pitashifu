import { useState, useRef, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { staff as mockStaff, daysConfig, YEAR_MONTH, shiftSubmissions as initialSubmissions } from '../../data/mockData'
import EmployeeTabBar from '../../components/EmployeeTabBar'
import { useOrg } from '../../context/OrgContext'
import { useMe } from '../../hooks/useMe'
import { listSubmissions, saveSubmission } from '../../api/shiftRequests'
const HOURS = Array.from({ length: 15 }, (_, i) => i + 8)

function parseCode(code) {
  if (!code || code === 'X') return null
  if (code === 'F') return { start: 9, end: 18 }
  const m = code.match(/^O-(\d+(?:\.\d+)?)$/)
  if (m) return { start: 9, end: parseFloat(m[1]) }
  const m2 = code.match(/^(\d+(?:\.\d+)?)[.-](\d+(?:\.\d+)?|L)$/)
  if (m2) return { start: parseFloat(m2[1]), end: m2[2] === 'L' ? 22 : parseFloat(m2[2]) }
  return null
}

const STATUS_LABEL = { draft: '下書き', submitted: '提出済み', confirmed: '確定済み' }
const STATUS_BADGE = {
  draft:     { background:'#fef3c7', color:'#92400e' },
  submitted: { background:'#eef0fe', color:'#3730a3' },
  confirmed: { background:'#d1fae5', color:'#065f46' },
}
const badgeStyle = (status) => ({ fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:10, whiteSpace:'nowrap', ...STATUS_BADGE[status] })

// Resolve which cell (di, h) is under a touch point
function getCellFromPoint(x, y) {
  const el = document.elementFromPoint(x, y)
  if (!el) return null
  let target = el
  while (target && target.dataset?.di === undefined) target = target.parentElement
  if (!target || !target.dataset) return null
  const di = parseInt(target.dataset.di)
  const h  = parseInt(target.dataset.h)
  if (isNaN(di) || isNaN(h)) return null
  return { di, h }
}

// Convert shift hours to code string
function toCode(sh, eh) {
  if (sh === 9 && eh === 18) return 'F'
  if (sh === 9) return `O-${eh}`
  if (eh === 22) return `${sh}-L`
  return `${sh}-${eh}`
}

export default function ShiftSubmit({ base: baseProp, sukima = false }) {
  const { orgId } = useParams()
  const base = baseProp ?? `/${orgId}/employee`
  const { stores } = useOrg()
  const storeId = stores[0]?.id
  const { me } = useMe()
  const meDisp = me ?? mockStaff[0]
  const [submissions, setSubmissions] = useState(initialSubmissions)
  const [mode, setMode]               = useState('list')
  const [errMsg, setErrMsg]           = useState('')

  useEffect(() => {
    if (!storeId) return
    let cancelled = false
    listSubmissions({ storeId })
      .then(rows => { if (!cancelled && rows.length) setSubmissions(rows) })
      .catch(e => { if (!cancelled) setErrMsg(e.message || '読み込みに失敗しました') })
    return () => { cancelled = true }
  }, [storeId])
  const [active, setActive]           = useState(null)
  const [editRow, setEditRow]         = useState([])
  const [previewRange, setPreviewRange] = useState(null)

  // Mouse drag refs
  const dragging    = useRef(false)
  const startCell   = useRef(null)
  const selectVal   = useRef(null)

  // Touch drag refs (separate to avoid cross-contamination)
  const touchActive  = useRef(false)
  const touchStart   = useRef(null)
  const touchSelVal  = useRef(null)
  const editRowRef   = useRef([])
  const tableRef     = useRef(null)

  // Keep editRowRef in sync
  useEffect(() => { editRowRef.current = editRow }, [editRow])

  // Attach non-passive touchmove so we can preventDefault (stops page scroll during drag)
  useEffect(() => {
    const el = tableRef.current
    if (!el) return
    const handleTouchMove = (e) => {
      if (!touchActive.current) return
      e.preventDefault()
      const touch = e.touches[0]
      const cell = getCellFromPoint(touch.clientX, touch.clientY)
      if (!cell || !touchStart.current || cell.di !== touchStart.current.di) return
      setPreviewRange({ di: cell.di, startH: touchStart.current.h, endH: cell.h })
    }
    el.addEventListener('touchmove', handleTouchMove, { passive: false })
    return () => el.removeEventListener('touchmove', handleTouchMove)
  }, [mode]) // re-attach when mode changes (new DOM)

  const commitRange = (pr, selVal) => {
    if (!pr) return
    const lo = Math.min(pr.startH, pr.endH)
    const hi = Math.max(pr.startH, pr.endH)
    setEditRow(prev => {
      const next = [...prev]
      if (selVal === 'erase') { next[pr.di] = 'X' }
      else { next[pr.di] = toCode(lo, hi + 1) }
      editRowRef.current = next
      return next
    })
    setPreviewRange(null)
  }

  // ── Mouse handlers ──
  const onMouseDown = (di, h) => {
    dragging.current = true; startCell.current = { di, h }
    const ex = parseCode(editRow[di])
    selectVal.current = ex && h >= ex.start && h < ex.end ? 'erase' : 'draw'
    setPreviewRange({ di, startH: h, endH: h })
  }
  const onMouseEnter = (di, h) => {
    if (!dragging.current || !startCell.current || startCell.current.di !== di) return
    setPreviewRange({ di, startH: startCell.current.h, endH: h })
  }
  const onMouseUp = () => {
    if (!dragging.current) return
    dragging.current = false
    commitRange(previewRange, selectVal.current)
    startCell.current = null; selectVal.current = null
  }

  // ── Touch handlers ──
  const onTouchStart = (e, di, h) => {
    // Don't preventDefault here — let it bubble so scrolling still works outside drag
    touchActive.current = true
    touchStart.current  = { di, h }
    const ex = parseCode(editRowRef.current[di])
    touchSelVal.current = ex && h >= ex.start && h < ex.end ? 'erase' : 'draw'
    setPreviewRange({ di, startH: h, endH: h })
  }
  const onTouchEnd = () => {
    if (!touchActive.current) return
    touchActive.current = false
    setPreviewRange(pr => {
      commitRange(pr, touchSelVal.current)
      return null
    })
    touchStart.current = null; touchSelVal.current = null
  }

  const isInPreview = (di, h) => {
    if (!previewRange || previewRange.di !== di) return false
    const lo = Math.min(previewRange.startH, previewRange.endH)
    const hi = Math.max(previewRange.startH, previewRange.endH)
    return h >= lo && h <= hi
  }

  const openEdit = (sub) => { setActive(sub); setEditRow([...sub.shiftRow]); setMode('edit') }
  const openNew  = () => {
    const s = { _isNew: true, id: Date.now(), period: '2026年5月 後半', submittedAt: null, lastEditedAt: null, status: 'draft', shiftRow: Array(15).fill('X') }
    setActive(s); setEditRow(Array(15).fill('X')); setMode('edit')
  }
  const persist = async (submit) => {
    if (!storeId) { setErrMsg('店舗IDが取得できません'); return }
    try {
      await saveSubmission({ storeId, periodName: active.period, shiftRow: [...editRow], submit })
      // 再読込でstate同期
      const fresh = await listSubmissions({ storeId })
      setSubmissions(fresh)
      setMode('list')
    } catch (e) {
      setErrMsg(e.message || '保存に失敗しました')
    }
  }
  const saveDraft  = () => persist(false)
  const submitShift = () => persist(true)

  // ── Confirmed view (read-only) ──
  if (mode === 'edit' && active.status === 'confirmed') return (
    <>
      <div className="pita-phone-header">
        <button onClick={() => setMode('list')} style={{ fontSize:12, color:'#5B67F8', background:'none', border:'none', cursor:'pointer', padding:'0 4px', fontWeight:600 }}>← 戻る</button>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:13, fontWeight:700, color:'var(--pita-text)' }}>{active.period}</div>
          <div style={{ fontSize:9, color:'var(--pita-muted)' }}>シフト確認（編集不可）</div>
        </div>
        <span style={badgeStyle(active.status)}>{STATUS_LABEL[active.status]}</span>
      </div>
      <div className="pita-mode-bar">
        <span className="pita-mode-chip" style={{ background:'#dcfce7', color:'#14532d' }}>確定済み</span>
        <span style={{ fontSize:9, color:'var(--pita-muted)' }}>マネージャーが確定したシフトです</span>
      </div>
      <div className="pita-phone-body">
        <div style={{ overflowX:'auto' }}>
          <table className="pita-shift-grid" style={{ userSelect:'none' }}>
            <thead><tr><th className="pita-time-col">日</th>{HOURS.map(h => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>
              {daysConfig.map((d, di) => {
                const shift = parseCode(editRow[di])
                return (
                  <tr key={d.day}>
                    <td className="pita-time-col" style={{ color: d.isWeekend ? '#dc2626' : 'var(--pita-text)', fontSize:9 }}>{d.day}/{d.dow}</td>
                    {HOURS.map(h => (
                      <td key={h} className={shift && h >= shift.start && h < shift.end ? 'pita-cell-work' : 'pita-cell-off'} style={{ cursor:'default' }} />
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      <EmployeeTabBar base={base} sukima={sukima} />
    </>
  )

  // ── Edit mode ──
  if (mode === 'edit') return (
    <>
      <div className="pita-phone-header">
        <button onClick={() => setMode('list')} style={{ fontSize:12, color:'#5B67F8', background:'none', border:'none', cursor:'pointer', padding:'0 4px', fontWeight:600 }}>← 戻る</button>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:13, fontWeight:700, color:'var(--pita-text)' }}>{active.period}</div>
          <div style={{ fontSize:9, color:'var(--pita-muted)' }}>タップ&ドラッグでシフト入力</div>
        </div>
        <span style={badgeStyle(active.status)}>{STATUS_LABEL[active.status]}</span>
      </div>
      <div className="pita-mode-bar">
        <span className="pita-mode-chip editing">編集中</span>
        <span style={{ fontSize:9, color:'var(--pita-muted)' }}>行を横にドラッグして時間を選択</span>
      </div>

      {/* Grid: larger cells for touch (40×40px) */}
      <div
        className="pita-phone-body"
        ref={tableRef}
        onMouseLeave={() => { if (dragging.current) { dragging.current = false; setPreviewRange(null) } }}
        onMouseUp={onMouseUp}
        onTouchEnd={onTouchEnd}
      >
        <div style={{ overflowX:'auto' }}>
          <table className="pita-shift-grid" style={{ userSelect:'none' }}>
            <thead>
              <tr>
                <th className="pita-time-col" style={{ width:36, fontSize:9 }}>日</th>
                {HOURS.map(h => <th key={h} style={{ width:40, height:36, fontSize:11 }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {daysConfig.map((d, di) => {
                const shift = parseCode(editRow[di])
                return (
                  <tr key={d.day}>
                    <td
                      className="pita-time-col"
                      style={{ color: d.isWeekend ? '#dc2626' : 'var(--pita-text)', fontSize:9, width:36 }}
                    >
                      {d.day}<br/><span style={{ fontSize:8 }}>{d.dow}</span>
                    </td>
                    {HOURS.map(h => {
                      const inShift  = shift && h >= shift.start && h < shift.end
                      const inPrev   = isInPreview(di, h)
                      let bg = inPrev
                        ? (selectVal.current === 'erase' || touchSelVal.current === 'erase' ? 'var(--pita-bg)' : '#fbbf24')
                        : inShift ? 'var(--pita-shift-work)' : 'var(--pita-bg)'
                      return (
                        <td
                          key={h}
                          data-di={di}
                          data-h={h}
                          style={{ width:40, height:40, background:bg, cursor:'crosshair', touchAction:'none' }}
                          onMouseDown={() => onMouseDown(di, h)}
                          onMouseEnter={() => onMouseEnter(di, h)}
                          onTouchStart={(e) => onTouchStart(e, di, h)}
                        />
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ padding:'10px 12px', borderTop:'1px solid #e5e7eb', display:'flex', gap:8, background:'white', flexShrink:0 }}>
        <button onClick={saveDraft} style={{ flex:1, padding:'12px 0', borderRadius:10, border:'1px solid #e5e7eb', background:'white', color:'#374151', fontSize:13, fontWeight:600, cursor:'pointer' }}>下書き保存</button>
        {active.status !== 'confirmed' && (
          <button onClick={submitShift} style={{ flex:2, padding:'12px 0', borderRadius:10, border:'none', background:'#5B67F8', color:'white', fontSize:13, fontWeight:700, cursor:'pointer' }}>提出する</button>
        )}
      </div>
      <EmployeeTabBar base={base} sukima={sukima} />
    </>
  )

  // ── List mode ──
  return (
    <>
      <div className="pita-phone-header">
        <div style={{ width:32, height:32, borderRadius:'50%', background:'#5B67F8', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, flexShrink:0 }}>{meDisp.name[0]}</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:14, fontWeight:700, color:'var(--pita-text)' }}>シフト管理</div>
          <div style={{ fontSize:10, color:'var(--pita-muted)', marginTop:1 }}>{YEAR_MONTH}</div>
        </div>
        <button onClick={openNew} style={{ fontSize:11, height:32, padding:'0 14px', borderRadius:16, border:'none', background:'#5B67F8', color:'white', fontWeight:600, cursor:'pointer' }}>+ 新規作成</button>
      </div>
      <div className="pita-phone-body">
        {errMsg && (
          <div style={{ margin:'8px 12px', padding:'8px 10px', background:'#FEE2E2', color:'#991B1B', border:'1px solid #FECACA', borderRadius:6, fontSize:11 }}>
            {errMsg}
          </div>
        )}
        <div style={{ padding:'8px 0' }}>
          {submissions.length === 0 && (
            <div style={{ textAlign:'center', padding:'40px 16px' }}>
              <div style={{ fontSize:36, marginBottom:12 }}>📋</div>
              <div style={{ fontSize:14, fontWeight:600, color:'var(--pita-text)', marginBottom:4 }}>まだシフトを提出していません</div>
              <div style={{ fontSize:12, color:'var(--pita-muted)', marginBottom:20 }}>「+ 新規作成」からシフトを入力してください</div>
              <button onClick={openNew} style={{ padding:'12px 24px', borderRadius:10, border:'none', background:'#5B67F8', color:'white', fontSize:13, fontWeight:700, cursor:'pointer' }}>シフトを作成する</button>
            </div>
          )}
          {submissions.map(sub => (
            <div key={sub.id} style={{ margin:'0 12px 10px', background:'white', border:'1px solid #e5e7eb', borderRadius:12, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
              {/* Status accent bar */}
              <div style={{ height:4, background: sub.status === 'confirmed' ? '#10b981' : sub.status === 'submitted' ? '#5B67F8' : '#f59e0b' }} />
              <div style={{ padding:'12px 14px' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                  <span style={{ fontSize:13, fontWeight:700, color:'var(--pita-text)' }}>{sub.period}</span>
                  <span style={badgeStyle(sub.status)}>{STATUS_LABEL[sub.status]}</span>
                </div>
                <div style={{ fontSize:10, color:'var(--pita-muted)', marginBottom:12, lineHeight:1.7 }}>
                  <div>提出日時: {sub.submittedAt || '—'}</div>
                  <div>最終編集: {sub.lastEditedAt || '—'}</div>
                </div>
                <button
                  onClick={() => openEdit(sub)}
                  style={{ width:'100%', padding:'10px 0', borderRadius:8, border: sub.status === 'confirmed' ? '1px solid #e5e7eb' : 'none', background: sub.status === 'confirmed' ? '#f9fafb' : '#5B67F8', color: sub.status === 'confirmed' ? '#374151' : 'white', fontSize:13, fontWeight:600, cursor:'pointer' }}
                >
                  {sub.status === 'confirmed' ? '確認する' : '編集する'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <EmployeeTabBar base={base} sukima={sukima} />
    </>
  )
}
