import { useState, useEffect, useMemo } from 'react'
import { useOrg } from '../../context/OrgContext'
import { listAllSubmissions } from '../../api/shiftRequests'

const STATUS_LABEL = {
  draft:     '下書き',
  submitted: '提出済み',
  confirmed: '確定済み',
}
const STATUS_STYLE = {
  draft:     { background: '#fef3c7', color: '#92400e' },
  submitted: { background: '#dbeafe', color: '#1e40af' },
  confirmed: { background: '#dcfce7', color: '#065f46' },
}
const PER_PAGE = 12  // 6ヶ月 (前半/後半 × 6 = 12)

const pad = (n) => String(n).padStart(2, '0')

function fmtTime(t) {
  if (!t) return '休'
  return t.slice(0, 5)  // 'HH:MM:SS' → 'HH:MM'
}

// 「今月 -1」から「今月 +2」までの 4ヶ月 × 2 期間 = 8 期間を生成
function buildFuturePeriods() {
  const today = new Date()
  let y = today.getFullYear()
  let m = today.getMonth() // 0-indexed → 来月開始用に補正
  // -1 month から開始
  m -= 1
  if (m < 0) { m += 12; y -= 1 }
  const out = []
  for (let i = 0; i < 4; i++) {
    const month = m + 1  // 1-indexed
    const lastDay = new Date(y, month, 0).getDate()
    out.push({
      name:        `${y}年${month}月 前半`,
      year:        y,
      month:       month,
      half:        'first',
      periodStart: `${y}-${pad(month)}-01`,
      periodEnd:   `${y}-${pad(month)}-15`,
      status:      'open',
    })
    out.push({
      name:        `${y}年${month}月 後半`,
      year:        y,
      month:       month,
      half:        'second',
      periodStart: `${y}-${pad(month)}-16`,
      periodEnd:   `${y}-${pad(month)}-${pad(lastDay)}`,
      status:      'open',
    })
    m += 1
    if (m > 11) { m -= 12; y += 1 }
  }
  return out
}

// 「2026年5月 後半」 → { year, month, half }
function parsePeriodName(name) {
  const m = name.match(/(\d{4})年(\d{1,2})月\s*(前半|後半)/)
  if (!m) return null
  return {
    year:  parseInt(m[1]),
    month: parseInt(m[2]),
    half:  m[3] === '前半' ? 'first' : 'second',
  }
}

// 降順ソートのキー
function sortKey(name) {
  const p = parsePeriodName(name)
  if (!p) return 0
  return p.year * 10000 + p.month * 10 + (p.half === 'second' ? 1 : 0)
}

export default function ShiftRequests() {
  const { stores } = useOrg()
  const storeId = stores[0]?.id
  const [dbData, setDbData] = useState([])
  const [loading, setLoading] = useState(true)
  const [errMsg, setErrMsg] = useState('')
  const [openPeriod, setOpenPeriod] = useState(null)
  const [page, setPage] = useState(0)

  useEffect(() => {
    if (!storeId) return
    let cancelled = false
    setLoading(true)
    listAllSubmissions({ storeId })
      .then(rows => { if (!cancelled) setDbData(rows ?? []) })
      .catch(e => { if (!cancelled) setErrMsg(e.message || '読み込みに失敗しました') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [storeId])

  // 生成期間 + DB期間 をマージ・重複排除・降順ソート
  const periodCards = useMemo(() => {
    // DB由来をMap化（name → item）
    const dbByName = new Map()
    for (const item of dbData) {
      dbByName.set(item.period.name, item)
    }
    // 生成期間
    const generated = buildFuturePeriods().map(p => ({
      period: { id: `gen-${p.name}`, name: p.name, periodStart: p.periodStart, periodEnd: p.periodEnd, status: 'open' },
      requests: [],
    }))
    // マージ: DB由来があればそちら優先
    const merged = new Map()
    for (const g of generated)         merged.set(g.period.name, g)
    for (const [k, v] of dbByName)     merged.set(k, v)   // DBで上書き
    // 各periodを社員別にグループ化
    const list = [...merged.values()].map(({ period, requests }) => {
      const byEmp = {}
      for (const r of requests) {
        if (!byEmp[r.employeeId]) byEmp[r.employeeId] = { employeeName: r.employeeName, employeeId: r.employeeId, days: [], statuses: new Set() }
        byEmp[r.employeeId].days.push(r)
        byEmp[r.employeeId].statuses.add(r.status)
      }
      const employees = Object.values(byEmp).sort((a, b) => a.employeeName.localeCompare(b.employeeName, 'ja'))
      return { period, employees, totalRequests: requests.length }
    })
    // 降順ソート: 新しい期間ほど上
    list.sort((a, b) => sortKey(b.period.name) - sortKey(a.period.name))
    return list
  }, [dbData])

  const totalPages = Math.max(1, Math.ceil(periodCards.length / PER_PAGE))
  const pageItems  = periodCards.slice(page * PER_PAGE, (page + 1) * PER_PAGE)

  return (
    <div className="mgr-page">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0 }}>シフト希望提出</h1>
        <p style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>従業員から提出されたシフト希望を期間ごとに確認できます（直近6ヶ月分・降順）</p>
      </div>

      {errMsg && (
        <div style={{ marginBottom: 14, padding: '10px 14px', background: '#FEE2E2', color: '#991B1B', border: '1px solid #FECACA', borderRadius: 8, fontSize: 13 }}>
          {errMsg}
        </div>
      )}

      {loading && (
        <div className="mgr-card" style={{ padding: '48px 24px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>読み込み中…</div>
      )}

      {!loading && pageItems.map(({ period, employees, totalRequests }) => (
        <div key={period.id} className="mgr-card" style={{ marginBottom: 12 }}>
          <div
            onClick={() => setOpenPeriod(openPeriod === period.id ? null : period.id)}
            style={{ padding: '14px 20px', borderBottom: openPeriod === period.id ? '1px solid #e2e8f0' : 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{period.name}</div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                {period.periodStart} 〜 {period.periodEnd} ／ {employees.length}名提出 ／ {totalRequests}日分
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                fontSize: 11, padding: '3px 10px', borderRadius: 10, fontWeight: 600,
                ...(STATUS_STYLE[period.status] ?? STATUS_STYLE.draft),
              }}>{STATUS_LABEL[period.status] ?? period.status}</span>
              <span style={{ fontSize: 14, color: '#94a3b8' }}>{openPeriod === period.id ? '▲' : '▼'}</span>
            </div>
          </div>

          {openPeriod === period.id && (
            <div style={{ overflowX: 'auto', padding: '0 0 12px 0' }}>
              {employees.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>この期間の提出はまだありません</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#1e293b', borderBottom: '1px solid #e2e8f0' }}>スタッフ</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: '#1e293b', borderBottom: '1px solid #e2e8f0' }}>ステータス</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#1e293b', borderBottom: '1px solid #e2e8f0' }}>希望シフト</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map(emp => {
                      const status = emp.statuses.has('confirmed') ? 'confirmed' : emp.statuses.has('submitted') ? 'submitted' : 'draft'
                      return (
                        <tr key={emp.employeeId}>
                          <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0f172a', borderBottom: '1px solid #f0f5f9' }}>{emp.employeeName}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'center', borderBottom: '1px solid #f0f5f9' }}>
                            <span style={{
                              fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 600,
                              ...STATUS_STYLE[status],
                            }}>{STATUS_LABEL[status]}</span>
                          </td>
                          <td style={{ padding: '10px 14px', borderBottom: '1px solid #f0f5f9' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {emp.days.map((d, i) => (
                                <span key={i} style={{
                                  fontSize: 10, padding: '2px 7px', borderRadius: 6,
                                  background: d.isAvailable ? '#eef0fe' : '#f1f5f9',
                                  color:      d.isAvailable ? '#3730a3' : '#94a3b8',
                                  border: '1px solid #e2e8f0', whiteSpace: 'nowrap',
                                }}>
                                  {d.date.slice(5)} {d.isAvailable ? `${fmtTime(d.preferredStart)}〜${fmtTime(d.preferredEnd)}` : '休'}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      ))}

      {/* ページネーション */}
      {!loading && totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 18 }}>
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            style={{
              padding: '7px 14px', borderRadius: 8, border: '1px solid #dde5f0', background: page === 0 ? '#f1f5f9' : 'white',
              color: page === 0 ? '#cbd5e1' : '#334155', fontSize: 12, fontWeight: 600, cursor: page === 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
            }}
          >‹ 前のページ</button>
          {Array.from({ length: totalPages }, (_, i) => (
            <button key={i} onClick={() => setPage(i)} style={{
              padding: '7px 12px', borderRadius: 8, border: 'none',
              background: page === i ? '#4f46e5' : 'transparent',
              color: page === i ? 'white' : '#475569',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', minWidth: 32,
            }}>{i + 1}</button>
          ))}
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
            style={{
              padding: '7px 14px', borderRadius: 8, border: '1px solid #dde5f0',
              background: page === totalPages - 1 ? '#f1f5f9' : 'white',
              color: page === totalPages - 1 ? '#cbd5e1' : '#334155',
              fontSize: 12, fontWeight: 600,
              cursor: page === totalPages - 1 ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
            }}
          >次のページ ›</button>
        </div>
      )}
    </div>
  )
}
