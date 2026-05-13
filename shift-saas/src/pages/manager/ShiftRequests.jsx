import { useState, useEffect } from 'react'
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

function fmtTime(t) {
  if (!t) return '休'
  return t.slice(0, 5)  // 'HH:MM:SS' → 'HH:MM'
}

export default function ShiftRequests() {
  const { stores } = useOrg()
  const storeId = stores[0]?.id
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [errMsg, setErrMsg] = useState('')
  const [openPeriod, setOpenPeriod] = useState(null)

  useEffect(() => {
    if (!storeId) return
    let cancelled = false
    setLoading(true)
    listAllSubmissions({ storeId })
      .then(rows => { if (!cancelled) setData(rows ?? []) })
      .catch(e => { if (!cancelled) setErrMsg(e.message || '読み込みに失敗しました') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [storeId])

  // 期間 → 社員別にグループ化
  const periods = data.map(({ period, requests }) => {
    const byEmp = {}
    for (const r of requests) {
      if (!byEmp[r.employeeId]) byEmp[r.employeeId] = { employeeName: r.employeeName, employeeId: r.employeeId, days: [], statuses: new Set() }
      byEmp[r.employeeId].days.push(r)
      byEmp[r.employeeId].statuses.add(r.status)
    }
    const employees = Object.values(byEmp).sort((a, b) => a.employeeName.localeCompare(b.employeeName, 'ja'))
    return { period, employees, totalRequests: requests.length }
  })

  return (
    <div className="mgr-page">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0 }}>シフト希望提出</h1>
        <p style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>従業員から提出されたシフト希望を期間ごとに確認できます</p>
      </div>

      {errMsg && (
        <div style={{ marginBottom: 14, padding: '10px 14px', background: '#FEE2E2', color: '#991B1B', border: '1px solid #FECACA', borderRadius: 8, fontSize: 13 }}>
          {errMsg}
        </div>
      )}

      {loading && (
        <div className="mgr-card" style={{ padding: '48px 24px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>読み込み中…</div>
      )}

      {!loading && periods.length === 0 && (
        <div className="mgr-card" style={{ padding: '48px 24px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
          まだシフト希望は提出されていません。
        </div>
      )}

      {!loading && periods.map(({ period, employees, totalRequests }) => (
        <div key={period.id} className="mgr-card" style={{ marginBottom: 16 }}>
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
                <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>このperiod の提出はまだありません</div>
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
    </div>
  )
}
