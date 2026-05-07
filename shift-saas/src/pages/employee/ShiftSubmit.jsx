import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { staff, daysConfig, YEAR_MONTH, shiftSubmissions as initialSubmissions } from '../../data/mockData'
import EmployeeTabBar from '../../components/EmployeeTabBar'

const ME = staff[0]
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

export default function ShiftSubmit({ base = '/employee', sukima = false }) {
  const [submissions, setSubmissions] = useState(initialSubmissions)
  const [mode, setMode] = useState('list')
  const [active, setActive] = useState(null)
  const [editRow, setEditRow] = useState([])
  const [previewRange, setPreviewRange] = useState(null)
  const dragging = useRef(false)
  const startCell = useRef(null)
  const selectVal = useRef(null)

  const openEdit = (sub) => {
    setActive(sub)
    setEditRow([...sub.shiftRow])
    setMode('edit')
  }
  const openNew = () => {
    const newSub = { id: Date.now(), period: '2026年5月 後半', submittedAt: null, lastEditedAt: null, status: 'draft', shiftRow: Array(15).fill('X') }
    setActive(newSub)
    setEditRow(Array(15).fill('X'))
    setMode('edit')
  }
  const saveDraft = () => {
    const now = new Date().toLocaleString('ja-JP').replace(/\//g,'-').slice(0,16)
    const updated = { ...active, shiftRow: [...editRow], lastEditedAt: now, status: active.status === 'confirmed' ? 'confirmed' : 'draft' }
    setSubmissions(prev => prev.find(s => s.id === active.id) ? prev.map(s => s.id === active.id ? updated : s) : [...prev, updated])
    setMode('list')
  }
  const submitShift = () => {
    const now = new Date().toLocaleString('ja-JP').replace(/\//g,'-').slice(0,16)
    const updated = { ...active, shiftRow: [...editRow], submittedAt: now, lastEditedAt: now, status: 'submitted' }
    setSubmissions(prev => prev.find(s => s.id === active.id) ? prev.map(s => s.id === active.id ? updated : s) : [...prev, updated])
    setMode('list')
  }

  const isInPreview = (di, h) => {
    if (!previewRange || previewRange.di !== di) return false
    const lo = Math.min(previewRange.startH, previewRange.endH)
    const hi = Math.max(previewRange.startH, previewRange.endH)
    return h >= lo && h <= hi
  }
  const onDown = (di, h) => {
    dragging.current = true; startCell.current = { di, h }
    const ex = parseCode(editRow[di]); selectVal.current = ex && h >= ex.start && h < ex.end ? 'erase' : 'draw'
    setPreviewRange({ di, startH: h, endH: h })
  }
  const onEnter = (di, h) => {
    if (!dragging.current || !startCell.current || startCell.current.di !== di) return
    setPreviewRange({ di, startH: startCell.current.h, endH: h })
  }
  const onUp = (di, h) => {
    if (!dragging.current) return; dragging.current = false
    const pr = previewRange; if (!pr || pr.di !== di) { setPreviewRange(null); return }
    const lo = Math.min(pr.startH, pr.endH), hi = Math.max(pr.startH, pr.endH)
    setEditRow(prev => {
      const next = [...prev]
      if (selectVal.current === 'erase') { next[di] = 'X' }
      else {
        const sh = lo, eh = hi + 1
        next[di] = sh === 9 && eh === 18 ? 'F' : sh === 9 ? `O-${eh}` : eh === 22 ? `${sh}-L` : `${sh}-${eh}`
      }
      return next
    })
    setPreviewRange(null); startCell.current = null; selectVal.current = null
  }

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
                    {HOURS.map(h => {
                      const inShift = shift && h >= shift.start && h < shift.end
                      return <td key={h} className={inShift ? 'pita-cell-work' : 'pita-cell-off'} style={{ cursor:'default' }} />
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      <EmployeeTabBar base={base} active="submit" sukima={sukima} />
    </>
  )

  if (mode === 'edit') return (
    <>
      <div className="pita-phone-header">
        <button onClick={() => setMode('list')} style={{ fontSize:12, color:'#5B67F8', background:'none', border:'none', cursor:'pointer', padding:'0 4px', fontWeight:600 }}>← 戻る</button>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:13, fontWeight:700, color:'var(--pita-text)' }}>{active.period}</div>
          <div style={{ fontSize:9, color:'var(--pita-muted)' }}>シフト提出</div>
        </div>
        <span style={badgeStyle(active.status)}>{STATUS_LABEL[active.status]}</span>
      </div>
      <div className="pita-mode-bar">
        <span className="pita-mode-chip editing">編集中</span>
        <span style={{ fontSize:9, color:'var(--pita-muted)' }}>ドラッグでシフト入力</span>
      </div>
      <div className="pita-phone-body" onMouseLeave={() => { if (dragging.current) { dragging.current = false; setPreviewRange(null) } }}>
        <div style={{ overflowX:'auto' }}>
          <table className="pita-shift-grid" style={{ userSelect:'none' }}>
            <thead><tr><th className="pita-time-col">日</th>{HOURS.map(h => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>
              {daysConfig.map((d, di) => {
                const shift = parseCode(editRow[di])
                return (
                  <tr key={d.day}>
                    <td className="pita-time-col" style={{ color: d.isWeekend ? '#dc2626' : 'var(--pita-text)', fontSize:9 }}>{d.day}/{d.dow}</td>
                    {HOURS.map(h => {
                      const inShift = shift && h >= shift.start && h < shift.end
                      const inPrev = isInPreview(di, h)
                      let cls = 'pita-cell-off'
                      if (inPrev) cls = selectVal.current === 'erase' ? 'pita-cell-off' : 'pita-cell-select'
                      else if (inShift) cls = 'pita-cell-work'
                      return <td key={h} className={cls} style={{ cursor:'crosshair' }} onMouseDown={() => onDown(di, h)} onMouseEnter={() => onEnter(di, h)} onMouseUp={() => onUp(di, h)} />
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div style={{ padding:'8px 12px', borderTop:'1px solid #e5e7eb', display:'flex', gap:8, background:'white', flexShrink:0 }}>
        <button onClick={saveDraft} style={{ flex:1, padding:'8px 0', borderRadius:8, border:'1px solid #e5e7eb', background:'white', color:'#374151', fontSize:12, fontWeight:600, cursor:'pointer' }}>下書き保存</button>
        {active.status !== 'confirmed' && (
          <button onClick={submitShift} style={{ flex:1, padding:'8px 0', borderRadius:8, border:'none', background:'#5B67F8', color:'white', fontSize:12, fontWeight:600, cursor:'pointer' }}>提出する</button>
        )}
      </div>
      <EmployeeTabBar base={base} active="submit" sukima={sukima} />
    </>
  )

  return (
    <>
      <div className="pita-phone-header">
        <div style={{ width:32, height:32, borderRadius:'50%', background:'#5B67F8', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, flexShrink:0 }}>{ME.name[0]}</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:14, fontWeight:700, color:'var(--pita-text)' }}>シフト提出</div>
          <div style={{ fontSize:10, color:'var(--pita-muted)', marginTop:1 }}>{YEAR_MONTH}</div>
        </div>
        <button onClick={openNew} style={{ fontSize:11, height:28, padding:'0 12px', borderRadius:14, border:'none', background:'#5B67F8', color:'white', fontWeight:600, cursor:'pointer' }}>+ 新規作成</button>
      </div>
      <div className="pita-phone-body">
        <div style={{ padding:'8px 0' }}>
          {submissions.length === 0 && (
            <div style={{ textAlign:'center', padding:'32px 16px', color:'var(--pita-faint)', fontSize:12 }}>提出済みのシフトはありません</div>
          )}
          {submissions.map(sub => (
            <div key={sub.id} style={{ margin:'0 10px 8px', padding:'10px 12px', background:'var(--pita-panel)', border:'1px solid var(--pita-border)', borderRadius:10 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
                <span style={{ fontSize:12, fontWeight:700, color:'var(--pita-text)' }}>{sub.period}</span>
                <span style={badgeStyle(sub.status)}>{STATUS_LABEL[sub.status]}</span>
              </div>
              <div style={{ fontSize:10, color:'var(--pita-muted)', marginBottom:8 }}>
                <div>提出: {sub.submittedAt || '—'}</div>
                <div>最終編集: {sub.lastEditedAt || '—'}</div>
              </div>
              <button onClick={() => openEdit(sub)} style={{ width:'100%', padding:'6px 0', borderRadius:6, border:'1px solid #e5e7eb', background:'#f9fafb', color:'#374151', fontSize:11, fontWeight:600, cursor:'pointer' }}>
                {sub.status === 'confirmed' ? '確認する' : '編集する'}
              </button>
            </div>
          ))}
        </div>
      </div>
      <EmployeeTabBar base={base} active="submit" sukima={sukima} />
    </>
  )
}
