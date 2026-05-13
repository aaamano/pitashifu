import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useOrg } from '../../context/OrgContext'
import { loadPeriodMatrix, saveShiftCell } from '../../api/shiftRequests'
import * as employeesApi from '../../api/employees'

const pad = (n) => String(n).padStart(2, '0')

// "HH:MM:SS" → 数値時 (例: "11:00:00" → 11, "11:30:00" → 11.5)
function timeToNum(t) {
  if (!t) return null
  const [h, m] = t.split(':').map(Number)
  return h + (m || 0) / 60
}

// セルの表示コード ('F'/'9-18'/'13-L'/'O-16'/'X')
function codeOf(cell) {
  if (!cell || !cell.isAvailable) return null
  const s = timeToNum(cell.preferredStart)
  const e = timeToNum(cell.preferredEnd)
  if (s == null || e == null) return null
  if (s === 9 && e === 18) return 'F'
  if (s === 9) return `O-${e}`
  if (e === 22) return `${s}-L`
  return `${s}-${e}`
}

// バー描画用の left/width %
function barProps(cell) {
  if (!cell || !cell.isAvailable) return null
  const s = timeToNum(cell.preferredStart)
  const e = timeToNum(cell.preferredEnd)
  if (s == null || e == null) return null
  const left  = Math.max(2, ((s - 7) / 16) * 100)
  const width = Math.max(6, ((e - s) / 16) * 100)
  return { left, width, full: s === 9 && e === 18, closer: e >= 22 }
}

const HOURS = Array.from({ length: 15 }, (_, i) => i + 8) // 8〜22

export default function PeriodRequests() {
  const { orgId, periodId } = useParams()
  const navigate = useNavigate()
  const { stores } = useOrg()
  const storeId = stores[0]?.id

  const [matrix,    setMatrix]    = useState(null)
  const [employees, setEmployees] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [errMsg,    setErrMsg]    = useState('')
  const [editing,   setEditing]   = useState(false)
  const [editCell,  setEditCell]  = useState(null) // { employeeId, date, cell }
  const [saving,    setSaving]    = useState(false)

  const reload = async () => {
    if (!periodId || !orgId) return
    setLoading(true); setErrMsg('')
    try {
      const [m, emps] = await Promise.all([
        loadPeriodMatrix({ periodId }),
        employeesApi.listEmployees(orgId),
      ])
      setMatrix(m)
      setEmployees(emps ?? [])
    } catch (e) {
      console.error('[PeriodRequests.load]', e)
      setErrMsg(e.message || '読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { reload() }, [periodId, orgId])

  const handleCellClick = (employeeId, date) => {
    if (!editing) return
    const cell = matrix?.shifts?.[employeeId]?.[date]
    setEditCell({ employeeId, date, cell: cell ?? null })
  }

  const handleSaveCell = async ({ start, end }) => {
    if (!editCell || !periodId) return
    setSaving(true); setErrMsg('')
    try {
      await saveShiftCell({
        periodId,
        employeeId: editCell.employeeId,
        date:       editCell.date,
        start,
        end,
      })
      setEditCell(null)
      await reload()
    } catch (e) {
      setErrMsg(e.message || '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  // スタッフ別 出勤日数集計
  const summary = useMemo(() => {
    if (!matrix) return new Map()
    const map = new Map()
    for (const emp of employees) {
      const cells = matrix.shifts?.[emp.id] ?? {}
      let days = 0, hours = 0
      for (const date of Object.keys(cells)) {
        const c = cells[date]
        if (!c?.isAvailable) continue
        const s = timeToNum(c.preferredStart), e = timeToNum(c.preferredEnd)
        if (s != null && e != null) { days++; hours += Math.max(0, e - s - 1) }
      }
      map.set(emp.id, { days, hours })
    }
    return map
  }, [matrix, employees])

  return (
    <div className="mgr-page">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <button onClick={() => navigate(`/${orgId}/manager/shift`)}
          style={{ background: 'none', border: 'none', color: '#3730a3', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
          ← シフト管理に戻る
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0 }}>シフト希望一覧</h1>
          {matrix && (
            <p style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
              {matrix.period.name}（{matrix.period.periodStart} 〜 {matrix.period.periodEnd}）
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {!editing ? (
            <button onClick={() => setEditing(true)} className="mgr-btn-primary" style={{ fontSize: 12 }}>
              ✎ 修正
            </button>
          ) : (
            <button onClick={() => setEditing(false)} className="mgr-btn-secondary" style={{ fontSize: 12 }}>
              修正を終える
            </button>
          )}
        </div>
      </div>

      {errMsg && (
        <div style={{ marginBottom: 14, padding: '10px 14px', background: '#FEE2E2', color: '#991B1B', border: '1px solid #FECACA', borderRadius: 8, fontSize: 13 }}>
          {errMsg}
        </div>
      )}

      {loading && (
        <div className="mgr-card" style={{ padding: '48px 24px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>読み込み中…</div>
      )}

      {!loading && matrix && (
        <div className="mgr-card" style={{ marginBottom: 16, overflowX: 'auto' }}>
          <table className="pita-mgr-grid">
            <thead>
              <tr>
                <th className="name-col">スタッフ</th>
                <th className="meta-col">出勤日数</th>
                {matrix.days.map(d => (
                  <th key={d.date}
                    className={d.dow === '土' ? 'pita-dow-sat' : d.dow === '日' ? 'pita-dow-sun' : ''}
                    style={{ minWidth: 56 }}>
                    {d.day}<br />{d.dow}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employees.map(emp => {
                const summ = summary.get(emp.id) || { days: 0, hours: 0 }
                return (
                  <tr key={emp.id}>
                    <td className="name-col" style={{ fontWeight: 600 }}>{emp.name}</td>
                    <td className="meta-col" style={{ fontWeight: 600 }}>{summ.days}日 / {summ.hours.toFixed(1)}h</td>
                    {matrix.days.map(d => {
                      const cell = matrix.shifts?.[emp.id]?.[d.date]
                      const bar  = barProps(cell)
                      const code = codeOf(cell)
                      const editable = editing
                      const cellStyle = {
                        cursor: editable ? 'pointer' : 'default',
                        background: editable ? '#f5f3ff' : undefined,
                        outline: editable ? '1px dashed #c7d2fe' : undefined,
                      }
                      if (!bar) {
                        return (
                          <td key={d.date} className="pita-cell-off-bar"
                            onClick={() => handleCellClick(emp.id, d.date)}
                            style={cellStyle}>×</td>
                        )
                      }
                      return (
                        <td key={d.date} className="pita-cell-bar"
                          onClick={() => handleCellClick(emp.id, d.date)}
                          style={cellStyle}>
                          <div className={'pita-bar ' + (bar.full ? 'full' : bar.closer ? 'closer' : '')}
                            style={{ left: bar.left + '%', width: bar.width + '%' }} />
                          <span className="pita-code">{code}</span>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {editCell && (
        <CellEditor
          editCell={editCell}
          employeeName={employees.find(e => e.id === editCell.employeeId)?.name ?? ''}
          onSave={handleSaveCell}
          onCancel={() => setEditCell(null)}
          saving={saving}
        />
      )}
    </div>
  )
}

function CellEditor({ editCell, employeeName, onSave, onCancel, saving }) {
  const initStart = timeToNum(editCell.cell?.preferredStart) ?? 9
  const initEnd   = timeToNum(editCell.cell?.preferredEnd)   ?? 18
  const [available, setAvailable] = useState(editCell.cell?.isAvailable ?? true)
  const [start, setStart] = useState(initStart)
  const [end,   setEnd]   = useState(initEnd)

  const handleSave = () => {
    if (!available) { onSave({ start: null, end: null }); return }
    if (end <= start) { return }
    onSave({ start, end })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onCancel}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: 12, padding: 24, width: 'min(420px, 92vw)', boxShadow: '0 20px 50px rgba(15,23,42,0.25)' }}>
        <div style={{ fontSize: 14, color: '#64748b', marginBottom: 6 }}>{editCell.date} ／ {employeeName}</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>
          シフトを編集
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <button onClick={() => setAvailable(true)} style={chip(available)}>出勤</button>
          <button onClick={() => setAvailable(false)} style={chip(!available)}>休み</button>
        </div>

        {available && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label className="mgr-label">開始時刻</label>
              <select value={start} onChange={e => setStart(Number(e.target.value))} className="mgr-input">
                {HOURS.map(h => <option key={h} value={h}>{h}:00</option>)}
              </select>
            </div>
            <div>
              <label className="mgr-label">終了時刻</label>
              <select value={end} onChange={e => setEnd(Number(e.target.value))} className="mgr-input">
                {HOURS.map(h => <option key={h} value={h}>{h}:00</option>)}
              </select>
            </div>
          </div>
        )}

        {editCell.cell?.lastEditedAt && (
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 14 }}>
            最終編集: {editCell.cell.lastEditedByName ?? '—'} ／ {new Date(editCell.cell.lastEditedAt).toLocaleString('ja-JP')}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onCancel} className="mgr-btn-secondary">キャンセル</button>
          <button onClick={handleSave} disabled={saving} className="mgr-btn-primary">{saving ? '保存中…' : '保存'}</button>
        </div>
      </div>
    </div>
  )
}

function chip(active) {
  return {
    padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
    border: active ? '1px solid #4f46e5' : '1px solid #dde5f0',
    background: active ? '#4f46e5' : 'white',
    color: active ? 'white' : '#475569',
    fontFamily: 'inherit',
  }
}
