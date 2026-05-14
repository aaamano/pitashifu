import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useOrg } from '../../context/OrgContext'
import * as versionsApi from '../../api/versions'
import { listAllSubmissions, findOrCreatePeriod } from '../../api/shiftRequests'
import * as employeesApi from '../../api/employees'
import { createNotification } from '../../api/notifications'

const PER_PAGE = 12

const STATUS_LABEL = { draft: '下書き', confirmed: '確定済み' }
const STATUS_STYLE = {
  draft:     { background: '#fef3c7', color: '#92400e' },
  confirmed: { background: '#dcfce7', color: '#065f46' },
}

const pad = (n) => String(n).padStart(2, '0')

function fmtTime(t) {
  if (!t) return '休'
  return t.slice(0, 5)
}

function parsePeriodName(name) {
  const m = name?.match(/(\d{4})年(\d{1,2})月\s*(前半|後半)/)
  if (!m) return null
  return { year: parseInt(m[1]), month: parseInt(m[2]), half: m[3] === '前半' ? 'first' : 'second' }
}

function sortKey(name) {
  const p = parsePeriodName(name)
  if (!p) return 0
  return p.year * 10000 + p.month * 10 + (p.half === 'second' ? 1 : 0)
}

// 今月-1〜今月+2の 4ヶ月 × 2半期 = 8期間
function buildFuturePeriods() {
  const today = new Date()
  let y = today.getFullYear()
  let m = today.getMonth() - 1 // 0-indexed → 「1ヶ月前」から
  if (m < 0) { m += 12; y -= 1 }
  const out = []
  for (let i = 0; i < 4; i++) {
    const month = m + 1
    const lastDay = new Date(y, month, 0).getDate()
    out.push({ name: `${y}年${month}月 前半`, year: y, month, half: 'first',  periodStart: `${y}-${pad(month)}-01`, periodEnd: `${y}-${pad(month)}-15` })
    out.push({ name: `${y}年${month}月 後半`, year: y, month, half: 'second', periodStart: `${y}-${pad(month)}-16`, periodEnd: `${y}-${pad(month)}-${pad(lastDay)}` })
    m += 1
    if (m > 11) { m -= 12; y += 1 }
  }
  return out
}

export default function ShiftList() {
  const { orgId } = useParams()
  const navigate = useNavigate()
  const { stores } = useOrg()
  const storeId = stores[0]?.id

  const [submissions, setSubmissions] = useState([])  // listAllSubmissions の結果
  const [versions,    setVersions]    = useState([])  // listVersions の結果
  const [employees,   setEmployees]   = useState([])  // employees 全員
  const [loading,     setLoading]     = useState(true)
  const [errMsg,      setErrMsg]      = useState('')

  const [openCardId,  setOpenCardId]  = useState(null)
  const [openMode,    setOpenMode]    = useState(null)  // 'requests' | 'decide' | 'confirmed' | null
  const [page,        setPage]        = useState(0)
  const [creating,    setCreating]    = useState(false)
  const [showPublish, setShowPublish] = useState(false)
  const [publishPeriod, setPublishPeriod] = useState('')
  const [publishing,  setPublishing]  = useState(false)
  const [publishMsg,  setPublishMsg]  = useState('')

  useEffect(() => {
    if (!storeId || !orgId) return
    let cancelled = false
    setLoading(true)
    Promise.all([
      listAllSubmissions({ storeId }),
      versionsApi.listVersions(storeId),
      employeesApi.listEmployees(orgId),
    ])
      .then(([subs, vers, emps]) => {
        if (cancelled) return
        setSubmissions(subs ?? [])
        setVersions(vers ?? [])
        setEmployees(emps ?? [])
      })
      .catch(e => { if (!cancelled) setErrMsg(e.message || '読み込みに失敗しました') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [storeId, orgId])

  // 全期間カード（自動生成 + DB由来 をマージ・降順ソート）
  const cards = useMemo(() => {
    const subsByName = new Map(submissions.map(s => [s.period.name, s]))
    const generated  = buildFuturePeriods().map(p => ({
      period: { id: `gen-${p.name}`, name: p.name, periodStart: p.periodStart, periodEnd: p.periodEnd, status: 'open' },
      requests: [],
    }))
    const merged = new Map()
    for (const g of generated)      merged.set(g.period.name, g)
    for (const [k, v] of subsByName) merged.set(k, v)
    const list = [...merged.values()].map(({ period, requests }) => {
      const submittedIds = new Set(requests.filter(r => r.status === 'submitted' || r.status === 'confirmed').map(r => r.employeeId))
      return { period, requests, submittedCount: submittedIds.size, requestsByEmp: groupByEmployee(requests) }
    })
    list.sort((a, b) => sortKey(b.period.name) - sortKey(a.period.name))
    return list
  }, [submissions])

  const totalPages = Math.max(1, Math.ceil(cards.length / PER_PAGE))
  const pageItems  = cards.slice(page * PER_PAGE, (page + 1) * PER_PAGE)

  // この期間に紐づく versions を返す
  // 1) period_id が一致するもの優先
  // 2) period_id が無いが、name 内に「YYYY年M月 半期」を含むものをフォールバック
  function versionsForPeriod(periodName, periodDbId) {
    return versions.filter(v => {
      if (periodDbId && v.periodId === periodDbId) return true
      if (!v.periodId && v.name?.includes(periodName.split(' ')[0])) return true
      return false
    })
  }

  const handleCardClick = (cardId, mode) => {
    if (openCardId === cardId && openMode === mode) {
      setOpenCardId(null); setOpenMode(null)
    } else {
      setOpenCardId(cardId); setOpenMode(mode)
    }
  }

  const handleCreateDraft = async (periodName) => {
    if (!storeId) return
    setCreating(true); setErrMsg('')
    try {
      const period = await findOrCreatePeriod({ storeId, periodName })
      const nextName = computeNextVersionName(versions, periodName)
      const v = await versionsApi.createVersion({ storeId, name: nextName, periodId: period.id })
      setVersions(prev => [v, ...prev])
      window.open(`/${orgId}/manager/shift/${v.id}`, '_blank')
    } catch (e) {
      console.error('[ShiftList.createDraft]', e)
      setErrMsg(e.message || '新規作成に失敗しました')
    } finally {
      setCreating(false)
    }
  }

  // 確定済みバージョンが存在する期間の一覧（通達対象）
  const confirmedPeriodNames = useMemo(() => {
    const names = new Set()
    for (const v of versions) {
      if (v.status === 'confirmed' && v.name) {
        // 「2026年5月 前半 ver1」 → 「2026年5月 前半」
        const m = v.name.match(/(\d{4}年\d{1,2}月\s*(前半|後半))/)
        if (m) names.add(m[1])
      }
    }
    return [...names].sort((a, b) => sortKey(b) - sortKey(a))
  }, [versions])

  // 通達ポップアップを開く時、対象期間を指定（指定なしならデフォルト）
  const openPublishModal = (periodName) => {
    setPublishMsg('')
    setPublishPeriod(periodName ?? confirmedPeriodNames[0] ?? '')
    setShowPublish(true)
  }

  const handlePublish = async () => {
    if (!publishPeriod || !orgId) return
    setPublishing(true); setPublishMsg('')
    try {
      await createNotification({
        orgId,
        recipientId: null,
        type: 'confirmed',
        title: `${publishPeriod} の確定シフトが発表されました`,
        body:  `${publishPeriod} のシフトが確定しました。アプリのシフト画面からご確認ください。`,
      })
      setPublishMsg('通知を送信しました')
      setTimeout(() => setShowPublish(false), 900)
    } catch (e) {
      console.error('[ShiftList.publish]', e)
      setPublishMsg(e.message || '通知の送信に失敗しました')
    } finally {
      setPublishing(false)
    }
  }

  // 「シフト希望一覧」ボタン: 該当periodをDBに find-or-create して新URLへ遷移
  const handleOpenRequests = async (periodName) => {
    if (!storeId) return
    try {
      const period = await findOrCreatePeriod({ storeId, periodName })
      navigate(`/${orgId}/manager/period-requests/${period.id}`)
    } catch (e) {
      console.error('[ShiftList.openRequests]', e)
      setErrMsg(e.message || '希望一覧を開けませんでした')
    }
  }

  return (
    <div className="mgr-page">
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0 }}>シフト管理</h1>
        <p style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
          半月ごとにシフト希望の確認・シフト確定作業ができます。
        </p>
      </div>

      {errMsg && (
        <div style={{ marginBottom: 14, padding: '10px 14px', background: '#FEE2E2', color: '#991B1B', border: '1px solid #FECACA', borderRadius: 8, fontSize: 13 }}>
          {errMsg}
        </div>
      )}

      {loading && (
        <div className="mgr-card" style={{ padding: '48px 24px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>読み込み中…</div>
      )}

      {!loading && pageItems.map(({ period, requests, submittedCount, requestsByEmp }) => {
        const cardId      = period.id
        const totalEmps   = employees.length
        const periodVers  = versionsForPeriod(period.name, period.id?.startsWith('gen-') ? null : period.id)
        const drafts      = periodVers.filter(v => v.status === 'draft')
        const confirmedVs = periodVers.filter(v => v.status === 'confirmed')
        const isOpen      = openCardId === cardId

        return (
          <div key={cardId} className="mgr-card" style={{ marginBottom: 12 }}>
            <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{period.name}</div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                  {period.periodStart} 〜 {period.periodEnd}
                  <span style={{ marginLeft: 10, color: '#3730a3', fontWeight: 600 }}>
                    シフト希望登録 {submittedCount}人 ({totalEmps}人中)
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button onClick={() => handleOpenRequests(period.name)}
                  style={tabBtnStyle(false)}>シフト希望一覧</button>
                <button onClick={() => handleCardClick(cardId, 'decide')}
                  style={tabBtnStyle(isOpen && openMode === 'decide')}>シフト確定作業</button>
                <button onClick={() => handleCardClick(cardId, 'confirmed')}
                  style={tabBtnStyle(isOpen && openMode === 'confirmed')}>確定済みの確認</button>
                <button
                  onClick={() => openPublishModal(period.name)}
                  disabled={confirmedVs.length === 0}
                  title={confirmedVs.length === 0 ? '確定済みのシフトがありません' : ''}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '7px 12px', borderRadius: 8, border: 'none',
                    background: confirmedVs.length === 0 ? '#fde68a' : '#f59e0b',
                    color: confirmedVs.length === 0 ? '#a16207' : 'white',
                    fontSize: 12, fontWeight: 600,
                    cursor: confirmedVs.length === 0 ? 'not-allowed' : 'pointer',
                    opacity: confirmedVs.length === 0 ? 0.55 : 1,
                    fontFamily: 'inherit',
                  }}
                >📢 確定シフト通達</button>
              </div>
            </div>

            {isOpen && openMode === 'decide' && (
              <DecideView
                periodName={period.name}
                drafts={drafts}
                orgId={orgId}
                onCreate={() => handleCreateDraft(period.name)}
                creating={creating}
              />
            )}
            {isOpen && openMode === 'confirmed' && (
              <ConfirmedView confirmedVs={confirmedVs} orgId={orgId} />
            )}
          </div>
        )
      })}

      {/* ページネーション */}
      {!loading && totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 18 }}>
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
            style={pagerBtnStyle(page === 0)}>‹ 前のページ</button>
          {Array.from({ length: totalPages }, (_, i) => (
            <button key={i} onClick={() => setPage(i)} style={{
              padding: '7px 12px', borderRadius: 8, border: 'none',
              background: page === i ? '#4f46e5' : 'transparent',
              color: page === i ? 'white' : '#475569',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', minWidth: 32,
            }}>{i + 1}</button>
          ))}
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}
            style={pagerBtnStyle(page === totalPages - 1)}>次のページ ›</button>
        </div>
      )}

      {/* ── 確定シフト通達 Modal ── */}
      {showPublish && (
        <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.45)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
          onClick={() => !publishing && setShowPublish(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background:'white', borderRadius:16, width:'100%', maxWidth:440, boxShadow:'0 20px 60px rgba(15,23,42,0.18)' }}>
            <div style={{ padding:'20px 24px', borderBottom:'1px solid #e2e8f0' }}>
              <div style={{ fontSize:17, fontWeight:700, color:'#0f172a' }}>📢 確定シフト通達</div>
              <div style={{ fontSize:12, color:'#64748b', marginTop:4 }}>確定したシフトをスタッフへ通知します</div>
            </div>
            <div style={{ padding:'20px 24px', display:'flex', flexDirection:'column', gap:16 }}>
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:'#475569', display:'block', marginBottom:8 }}>通達するシフト期間</label>
                <select value={publishPeriod} onChange={e => setPublishPeriod(e.target.value)}
                  style={{ padding:'8px 12px', borderRadius:8, border:'1px solid #dde5f0', fontSize:13, color:'#0f172a', fontFamily:'inherit', outline:'none', width:'100%' }}>
                  {confirmedPeriodNames.map(name => <option key={name} value={name}>{name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:'#475569', display:'block', marginBottom:6 }}>通知プレビュー</label>
                <div style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:8, padding:'12px 14px', fontSize:12, color:'#334155', lineHeight:1.7 }}>
                  【確定シフトのお知らせ】<br/>
                  {publishPeriod} のシフトが確定しました。<br/>
                  アプリのシフト画面からご確認ください。
                </div>
              </div>
              {publishMsg && (
                <div style={{ fontSize:12, color: publishMsg.includes('失敗') ? '#dc2626' : '#059669', fontWeight:600 }}>{publishMsg}</div>
              )}
            </div>
            <div style={{ padding:'12px 24px 20px', display:'flex', gap:10 }}>
              <button onClick={() => setShowPublish(false)} disabled={publishing}
                style={{ flex:1, padding:'10px 0', borderRadius:8, border:'1px solid #dde5f0', background:'white', color:'#475569', fontSize:13, fontWeight:600, cursor: publishing ? 'not-allowed' : 'pointer', fontFamily:'inherit' }}>キャンセル</button>
              <button onClick={handlePublish} disabled={publishing || !publishPeriod}
                style={{ flex:1, padding:'10px 0', borderRadius:8, border:'none', background:'#f59e0b', color:'white', fontSize:13, fontWeight:700, cursor: publishing ? 'not-allowed' : 'pointer', fontFamily:'inherit', opacity: publishing ? 0.7 : 1 }}>
                {publishing ? '送信中…' : '通知を送る'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function tabBtnStyle(active) {
  return {
    padding: '7px 14px', borderRadius: 8,
    border: active ? '1px solid #4f46e5' : '1px solid #dde5f0',
    background: active ? '#eef0fe' : 'white',
    color: active ? '#3730a3' : '#334155',
    fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  }
}
function pagerBtnStyle(disabled) {
  return {
    padding: '7px 14px', borderRadius: 8, border: '1px solid #dde5f0',
    background: disabled ? '#f1f5f9' : 'white',
    color: disabled ? '#cbd5e1' : '#334155',
    fontSize: 12, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
  }
}

function groupByEmployee(requests) {
  const byEmp = {}
  for (const r of requests) {
    if (!byEmp[r.employeeId]) byEmp[r.employeeId] = { employeeName: r.employeeName, employeeId: r.employeeId, days: [], statuses: new Set() }
    byEmp[r.employeeId].days.push(r)
    byEmp[r.employeeId].statuses.add(r.status)
  }
  return Object.values(byEmp).sort((a, b) => a.employeeName.localeCompare(b.employeeName, 'ja'))
}

function computeNextVersionName(versions, periodName) {
  const sameVers = versions.filter(v => v.name?.startsWith(periodName))
  if (sameVers.length === 0) return `${periodName} ver1`
  const nums = sameVers.map(v => parseInt(v.name.match(/ver(\d+)/)?.[1] || '0')).filter(n => n > 0)
  const next = nums.length ? Math.max(...nums) + 1 : 1
  return `${periodName} ver${next}`
}

// ── タブ別の中身 ─────────────────────────────────────────────

function RequestsView({ requests }) {
  if (!requests.length) {
    return (
      <div style={{ padding: '20px 24px', borderTop: '1px solid #e2e8f0', textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>
        この期間の提出はまだありません
      </div>
    )
  }
  return (
    <div style={{ borderTop: '1px solid #e2e8f0', padding: '0 0 12px 0', overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#f8fafc' }}>
            <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#1e293b', borderBottom: '1px solid #e2e8f0' }}>スタッフ</th>
            <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: '#1e293b', borderBottom: '1px solid #e2e8f0' }}>ステータス</th>
            <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#1e293b', borderBottom: '1px solid #e2e8f0' }}>希望シフト</th>
          </tr>
        </thead>
        <tbody>
          {requests.map(emp => {
            const status = emp.statuses.has('confirmed') ? 'confirmed' : emp.statuses.has('submitted') ? 'submitted' : 'draft'
            const STATUS_LBL = { draft: '下書き', submitted: '提出済み', confirmed: '確定済み' }
            const STATUS_BG  = {
              draft:     { background: '#fef3c7', color: '#92400e' },
              submitted: { background: '#dbeafe', color: '#1e40af' },
              confirmed: { background: '#dcfce7', color: '#065f46' },
            }
            return (
              <tr key={emp.employeeId}>
                <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0f172a', borderBottom: '1px solid #f0f5f9' }}>{emp.employeeName}</td>
                <td style={{ padding: '10px 14px', textAlign: 'center', borderBottom: '1px solid #f0f5f9' }}>
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 600, ...STATUS_BG[status] }}>{STATUS_LBL[status]}</span>
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
    </div>
  )
}

function DecideView({ periodName, drafts, orgId, onCreate, creating }) {
  return (
    <div style={{ borderTop: '1px solid #e2e8f0', padding: '16px 20px' }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>新規作成</div>
        <button onClick={onCreate} disabled={creating} className="mgr-btn-primary" style={{ fontSize: 12 }}>
          {creating ? '作成中…' : `＋ ${periodName} の新しい下書きを作成`}
        </button>
      </div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>下書きから呼び出す</div>
        {drafts.length === 0 ? (
          <div style={{ fontSize: 12, color: '#94a3b8', padding: '10px 0' }}>この期間の下書きはまだありません。</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {drafts.map(v => (
              <a key={v.id}
                href={`/${orgId}/manager/shift/${v.id}`}
                target="_blank" rel="noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', borderRadius: 8, border: '1px solid #dde5f0', background: 'white',
                  color: '#0f172a', textDecoration: 'none', fontSize: 12, fontWeight: 600,
                }}>
                <span>{v.name}</span>
                <span style={{ fontSize: 10, color: '#94a3b8' }}>{v.updatedAt} / {v.author}</span>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ConfirmedView({ confirmedVs, orgId }) {
  if (!confirmedVs.length) {
    return (
      <div style={{ padding: '20px 24px', borderTop: '1px solid #e2e8f0', textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>
        この期間の確定済みシフトはまだありません
      </div>
    )
  }
  return (
    <div style={{ borderTop: '1px solid #e2e8f0', padding: '14px 20px' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>確定済みバージョン</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {confirmedVs.map(v => (
          <a key={v.id}
            href={`/${orgId}/manager/shift/${v.id}`}
            target="_blank" rel="noreferrer"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px', borderRadius: 8, border: '1px solid #dcfce7', background: '#f0fdf4',
              color: '#065f46', textDecoration: 'none', fontSize: 12, fontWeight: 600,
            }}>
            <span>✓ {v.name}</span>
            <span style={{ fontSize: 10, color: '#475569' }}>{v.updatedAt} / {v.author}</span>
          </a>
        ))}
      </div>
    </div>
  )
}
