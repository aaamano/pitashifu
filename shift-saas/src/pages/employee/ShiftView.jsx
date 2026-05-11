import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { staff, shiftData, daysConfig, YEAR_MONTH } from '../../data/mockData'

const ME = staff[0]
const myRow = shiftData[ME.id] || []

const HOURS = Array.from({ length: 15 }, (_, i) => i + 8) // 8 to 22

function parseShiftTimes(code) {
  if (!code || code === 'X') return null
  if (code === 'F') return { start: 9, end: 18 }
  const m = code.match(/^O-(\d+(?:\.\d+)?)$/)
  if (m) return { start: 9, end: parseFloat(m[1]) }
  const m2 = code.match(/^(\d+(?:\.\d+)?)[.-](\d+(?:\.\d+)?|L)$/)
  if (m2) return { start: parseFloat(m2[1]), end: m2[2] === 'L' ? 22 : parseFloat(m2[2]) }
  return null
}

function computeSummary(rowData) {
  const workDays = rowData.filter(c => c && c !== 'X').length
  const workHours = rowData.reduce((sum, code) => {
    const h = parseShiftTimes(code)
    return h ? sum + Math.max(0, h.end - h.start - 1) : sum
  }, 0)
  const estPay = workHours * ME.wage
  return { workDays, workHours, estPay }
}

export default function ShiftView() {
  const [editing, setEditing] = useState(false)
  const [localRow, setLocalRow] = useState(() => [...myRow])
  const [previewRange, setPreviewRange] = useState(null) // { dayIdx, startH, endH } during drag

  const dragging = useRef(false)
  const startCell = useRef(null)  // { dayIdx, hour }
  const selectVal = useRef(null)  // 'draw' or 'erase'

  const { workDays, workHours, estPay } = computeSummary(localRow)

  const isInPreview = (dayIdx, hour) => {
    if (!previewRange || previewRange.dayIdx !== dayIdx) return false
    const lo = Math.min(previewRange.startH, previewRange.endH)
    const hi = Math.max(previewRange.startH, previewRange.endH)
    return hour >= lo && hour <= hi
  }

  const handleMouseDown = (dayIdx, hour) => {
    if (!editing) return
    dragging.current = true
    startCell.current = { dayIdx, hour }
    const existing = parseShiftTimes(localRow[dayIdx])
    const isWork = existing && hour >= existing.start && hour < existing.end
    selectVal.current = isWork ? 'erase' : 'draw'
    setPreviewRange({ dayIdx, startH: hour, endH: hour })
  }

  const handleMouseEnter = (dayIdx, hour) => {
    if (!editing || !dragging.current) return
    if (startCell.current && startCell.current.dayIdx === dayIdx) {
      setPreviewRange({ dayIdx, startH: startCell.current.hour, endH: hour })
    }
  }

  const handleMouseUp = (dayIdx, hour) => {
    if (!editing || !dragging.current) return
    dragging.current = false

    const pr = previewRange
    if (!pr || pr.dayIdx !== dayIdx) {
      setPreviewRange(null)
      return
    }

    const lo = Math.min(pr.startH, pr.endH)
    const hi = Math.max(pr.startH, pr.endH)

    if (selectVal.current === 'erase') {
      setLocalRow(prev => {
        const next = [...prev]
        next[dayIdx] = 'X'
        return next
      })
    } else {
      const startH = lo
      const endH = hi + 1
      let code
      if (startH === 9 && endH === 18) code = 'F'
      else if (startH === 9) code = `O-${endH}`
      else if (endH === 22) code = `${startH}-L`
      else code = `${startH}-${endH}`

      setLocalRow(prev => {
        const next = [...prev]
        next[dayIdx] = code
        return next
      })
    }

    setPreviewRange(null)
    startCell.current = null
    selectVal.current = null
  }

  const handleMouseLeaveTable = () => {
    if (dragging.current) {
      dragging.current = false
      setPreviewRange(null)
      startCell.current = null
      selectVal.current = null
    }
  }

  return (
    <div className="pita-phone-stage">
      {/* Left: phone */}
      <div>
        <div className="pita-phone">
          <div className="pita-phone-inner">
            <div className="pita-notch" />
            <div className="pita-status-bar">
              <span>9:41</span>
              <span>●●● 5G 100%</span>
            </div>

            {/* Header */}
            <div className="pita-phone-header">
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'var(--pita-accent)', color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700, flexShrink: 0,
              }}>
                {ME.name[0]}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--pita-text)', lineHeight: 1.2 }}>
                  シフト確認
                </div>
                <div style={{ fontSize: 10, color: 'var(--pita-muted)', marginTop: 1 }}>
                  {YEAR_MONTH} 前半
                </div>
              </div>
              <button
                className="pita-btn accent"
                style={{ fontSize: 10, height: 24 }}
                onClick={() => setEditing(v => !v)}
              >
                {editing ? '閲覧に戻る' : '編集'}
              </button>
            </div>

            {/* Mode bar */}
            <div className="pita-mode-bar">
              <span className={`pita-mode-chip${editing ? ' editing' : ''}`}>
                {editing ? '編集' : '閲覧'}
              </span>
              {editing && (
                <span style={{ fontSize: 9, color: 'var(--pita-muted)' }}>
                  セルをドラッグしてシフトを変更
                </span>
              )}
            </div>

            {/* Summary row */}
            <div className="pita-summary-row">
              <span>
                出勤 <strong>{workDays}日</strong>
              </span>
              <span>
                {workHours}h
              </span>
              <span>
                想定 <strong>¥{estPay.toLocaleString('ja-JP')}</strong>
              </span>
            </div>

            {/* Scrollable body */}
            <div className="pita-phone-body" onMouseLeave={handleMouseLeaveTable}>
              <div style={{ overflowX: 'auto' }}>
                <table
                  className="pita-shift-grid"
                  style={{ userSelect: 'none' }}
                >
                  <thead>
                    <tr>
                      <th className="pita-time-col">日</th>
                      {HOURS.map(h => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {daysConfig.map((d, di) => {
                      const code = localRow[di] || 'X'
                      const shift = parseShiftTimes(code)
                      return (
                        <tr key={d.day}>
                          <td
                            className="pita-time-col"
                            style={{
                              color: d.isWeekend ? 'oklch(0.50 0.12 20)' : 'var(--pita-text)',
                              fontSize: 9,
                            }}
                          >
                            {d.day}/{d.dow}
                          </td>
                          {HOURS.map(h => {
                            const inShift = shift && h >= shift.start && h < shift.end
                            const inPreview = editing && isInPreview(di, h)
                            let cellClass = 'pita-cell-off'
                            if (inPreview) {
                              cellClass = selectVal.current === 'erase' ? 'pita-cell-off' : 'pita-cell-select'
                            } else if (inShift) {
                              cellClass = 'pita-cell-work'
                            }
                            return (
                              <td
                                key={h}
                                className={cellClass}
                                style={{ cursor: editing ? 'crosshair' : 'default' }}
                                onMouseDown={() => handleMouseDown(di, h)}
                                onMouseEnter={() => handleMouseEnter(di, h)}
                                onMouseUp={() => handleMouseUp(di, h)}
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

            {/* Tab bar */}
            <div className="pita-phone-tabbar">
              <Link to="/pitashif/employee" className="pita-tab-item active">
                <span className="pita-tab-ico">📅</span>
                シフト
              </Link>
              <Link to="/pitashif/employee/edit" className="pita-tab-item">
                <span className="pita-tab-ico">✏️</span>
                希望
              </Link>
              <span className="pita-tab-item">
                <span className="pita-tab-ico">👤</span>
                アカウント
              </span>
            </div>
          </div>
        </div>
        <div style={{
          textAlign: 'center', marginTop: 12,
          fontFamily: 'var(--font-mono)', fontSize: 11,
          color: 'var(--pita-faint)',
        }}>
          URL: /employee
        </div>
      </div>

      {/* Right: side notes */}
      <div>
        <div className="pita-side-note">
          <div style={{
            fontFamily: 'var(--font-mono)', fontWeight: 600,
            marginBottom: 10, color: 'var(--pita-text)',
          }}>
            閲覧ガイド
          </div>
          <ul style={{ paddingLeft: 16, margin: '0 0 12px' }}>
            <li style={{ marginBottom: 6 }}>
              <strong style={{ color: 'var(--pita-text)' }}>シフトの見方</strong>
              <br />横軸が時間（8〜22時）、縦軸が日付です。色のついたセルがあなたのシフト時間です。
            </li>
            <li style={{ marginBottom: 6 }}>
              <strong style={{ color: 'var(--pita-text)' }}>編集モード</strong>
              <br />右上の「編集」ボタンを押すと編集モードになります。グリッドをドラッグしてシフト範囲を変更できます。
            </li>
            <li style={{ marginBottom: 6 }}>
              <strong style={{ color: 'var(--pita-text)' }}>ドラッグ操作</strong>
              <br />セルを押したままドラッグすると選択範囲（黄色）がプレビュー表示されます。離すと確定します。
            </li>
            <li style={{ marginBottom: 6 }}>
              <strong style={{ color: 'var(--pita-text)' }}>消去</strong>
              <br />すでに勤務中のセルからドラッグすると、その日のシフトを消去できます。
            </li>
          </ul>
          <hr style={{ border: 'none', borderTop: '1px solid var(--pita-border)', margin: '10px 0' }} />
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--pita-text)', marginBottom: 6, fontFamily: 'var(--font-mono)' }}>
              色凡例
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{
                  display: 'inline-block', width: 48, height: 16, borderRadius: 3,
                  background: 'var(--pita-shift-work)', flexShrink: 0,
                }} />
                <span style={{ fontSize: 11, color: 'var(--pita-muted)' }}>勤務時間</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{
                  display: 'inline-block', width: 48, height: 16, borderRadius: 3,
                  background: 'oklch(0.75 0.15 60)', flexShrink: 0,
                }} />
                <span style={{ fontSize: 11, color: 'var(--pita-muted)' }}>ドラッグ選択中</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{
                  display: 'inline-block', width: 48, height: 16, borderRadius: 3,
                  background: 'var(--pita-bg)',
                  border: '1px solid var(--pita-border)',
                  flexShrink: 0,
                }} />
                <span style={{ fontSize: 11, color: 'var(--pita-muted)' }}>休み</span>
              </div>
            </div>
          </div>
          <hr style={{ border: 'none', borderTop: '1px solid var(--pita-border)', margin: '10px 0' }} />
          <Link to="/" style={{
            fontFamily: 'var(--font-mono)', fontSize: 11,
            color: 'var(--pita-muted)', textDecoration: 'none',
          }}>
            ← TOPへ
          </Link>
        </div>
      </div>
    </div>
  )
}
