import { useState, useRef, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { YEAR_MONTH } from '../../data/mockData'
import { useOrg } from '../../context/OrgContext'
import * as versionsApi from '../../api/versions'

const STATUS_LABEL = { draft: '下書き', confirmed: '確定済み' }
const STATUS_STYLE = {
  draft:     { background: '#f1f5f9', color: '#64748b' },
  confirmed: { background: '#d1fae5', color: '#065f46' },
}

export default function ShiftList() {
  const navigate = useNavigate()
  const { orgId } = useParams()
  const { stores } = useOrg()
  const storeId = stores[0]?.id // 会社配下の最初の店舗（後でセレクタ連動予定）
  const [versions, setVersions]         = useState([])
  const [loading, setLoading]           = useState(true)
  const [errMsg, setErrMsg]             = useState('')
  const [openMenuId, setOpenMenuId]     = useState(null)
  const [renamingId, setRenamingId]     = useState(null)
  const [renameValue, setRenameValue]   = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const menuRef = useRef(null)

  // Load versions from Supabase on mount / storeId change
  useEffect(() => {
    if (!storeId) return
    let cancelled = false
    setLoading(true)
    setErrMsg('')
    versionsApi.listVersions(storeId)
      .then(data => { if (!cancelled) setVersions(data) })
      .catch(e => { if (!cancelled) setErrMsg(e.message || '読み込みに失敗しました') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [storeId])

  // Close action menu on outside click
  useEffect(() => {
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpenMenuId(null)
    }
    if (openMenuId) document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [openMenuId])

  const nextVerName = () => {
    const nums = versions
      .map(v => v.name.match(/^ver(\d+)/i)?.[1])
      .filter(Boolean)
      .map(Number)
    const next = nums.length ? Math.max(...nums) + 1 : 1
    return `ver${next}`
  }

  const handleCreate = async () => {
    if (!storeId) return
    setOpenMenuId(null)
    try {
      const created = await versionsApi.createVersion({ storeId, name: nextVerName() })
      setVersions(prev => [created, ...prev])
    } catch (e) {
      setErrMsg(e.message || '作成に失敗しました')
    }
  }

  const handleConfirm = async (id) => {
    setOpenMenuId(null)
    try {
      const updated = await versionsApi.updateVersion(id, { status: 'confirmed' })
      setVersions(prev => prev.map(v => v.id === id ? updated : v))
    } catch (e) {
      setErrMsg(e.message || '確定に失敗しました')
    }
  }

  const handleDelete = async (id) => {
    setDeleteTarget(null)
    setOpenMenuId(null)
    try {
      await versionsApi.deleteVersion(id)
      setVersions(prev => prev.filter(v => v.id !== id))
    } catch (e) {
      setErrMsg(e.message || '削除に失敗しました')
    }
  }

  const startRename = (v) => {
    setRenamingId(v.id)
    setRenameValue(v.name)
  }
  const commitRename = async () => {
    if (!renamingId) { return }
    const trimmed = renameValue.trim()
    const id = renamingId
    setRenamingId(null)
    setRenameValue('')
    if (!trimmed) return
    try {
      const updated = await versionsApi.updateVersion(id, { name: trimmed })
      setVersions(prev => prev.map(v => v.id === id ? updated : v))
    } catch (e) {
      setErrMsg(e.message || 'リネームに失敗しました')
    }
  }

  const B = '1px solid #dde5f0'

  return (
    <div style={{ padding:'20px 24px', background:'#f0f5f9', minHeight:'100%' }}>

      {/* ── Header ── */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:10, marginBottom:16 }}>
        <div>
          <div style={{ fontSize:11, color:'#94a3b8', marginBottom:4 }}>{YEAR_MONTH}</div>
          <h1 style={{ fontSize:22, fontWeight:700, color:'#0f172a', margin:0, letterSpacing:'-0.01em' }}>
            シフト決定 — 時間帯人員配置
          </h1>
          <p style={{ fontSize:12, color:'#64748b', marginTop:6 }}>
            シフトのバージョンを作成・編集・確定できます。編集ボタンから配置画面に遷移します。
          </p>
        </div>
        <button
          onClick={handleCreate}
          disabled={!storeId}
          style={{
            display:'flex', alignItems:'center', gap:6, padding:'9px 16px', borderRadius:8,
            border:'none', background: storeId ? '#4f46e5' : '#c7d2fe', color:'white', fontSize:13, fontWeight:600,
            cursor: storeId ? 'pointer' : 'not-allowed', fontFamily:'inherit',
          }}
        >
          ＋ 新規バージョン作成
        </button>
      </div>

      {errMsg && (
        <div style={{ marginBottom:14, padding:'10px 14px', background:'#FEE2E2', color:'#991B1B', border:'1px solid #FECACA', borderRadius:8, fontSize:13 }}>
          {errMsg}
        </div>
      )}

      {/* ── Versions table ── */}
      <div style={{ background:'white', borderRadius:12, border:B, overflow:'visible' }}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'separate', borderSpacing:0, fontSize:13 }}>
            <thead>
              <tr style={{ background:'#e2e8f0' }}>
                <th style={{ padding:'12px 14px', textAlign:'left',  fontWeight:700, color:'#1e293b', borderBottom:B }}>バージョン名</th>
                <th style={{ padding:'12px 14px', textAlign:'center',fontWeight:700, color:'#1e293b', borderBottom:B, width:90  }}>ステータス</th>
                <th style={{ padding:'12px 14px', textAlign:'left',  fontWeight:700, color:'#1e293b', borderBottom:B, width:160 }}>作成日</th>
                <th style={{ padding:'12px 14px', textAlign:'left',  fontWeight:700, color:'#1e293b', borderBottom:B, width:160 }}>最終更新</th>
                <th style={{ padding:'12px 14px', textAlign:'left',  fontWeight:700, color:'#1e293b', borderBottom:B, width:130 }}>作成者</th>
                <th style={{ padding:'12px 14px', textAlign:'center',fontWeight:700, color:'#1e293b', borderBottom:B, width:120 }}>アクション</th>
                <th style={{ padding:'12px 14px', textAlign:'center',fontWeight:700, color:'#1e293b', borderBottom:B, width:90  }}>編集</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} style={{ padding:'48px 16px', textAlign:'center', color:'#94a3b8', fontSize:13 }}>
                    読み込み中…
                  </td>
                </tr>
              )}
              {!loading && versions.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding:'48px 16px', textAlign:'center', color:'#94a3b8', fontSize:13 }}>
                    シフトバージョンがありません。「＋ 新規バージョン作成」から作成してください。
                  </td>
                </tr>
              )}
              {versions.map(v => (
                <tr key={v.id} style={{ borderBottom:B }}>
                  {/* Name (rename inline) */}
                  <td style={{ padding:'12px 14px', borderBottom:B }}>
                    {renamingId === v.id ? (
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onBlur={commitRename}
                        onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') { setRenamingId(null); setRenameValue('') } }}
                        style={{ width:'100%', padding:'5px 8px', border:'1px solid #4f46e5', borderRadius:6, fontSize:13, fontFamily:'inherit' }}
                      />
                    ) : (
                      <span
                        onClick={() => startRename(v)}
                        title="クリックでリネーム"
                        style={{ fontWeight:600, color:'#0f172a', cursor:'text', display:'inline-flex', alignItems:'center', gap:6 }}
                      >
                        {v.name}
                        <span style={{ fontSize:10, color:'#cbd5e1' }}>✎</span>
                      </span>
                    )}
                  </td>

                  {/* Status */}
                  <td style={{ padding:'12px 14px', textAlign:'center', borderBottom:B }}>
                    <span style={{
                      display:'inline-block', padding:'3px 10px', borderRadius:10, fontSize:11, fontWeight:600,
                      ...STATUS_STYLE[v.status],
                    }}>
                      {STATUS_LABEL[v.status]}
                    </span>
                  </td>

                  <td style={{ padding:'12px 14px', color:'#475569', borderBottom:B, fontVariantNumeric:'tabular-nums' }}>{v.createdAt}</td>
                  <td style={{ padding:'12px 14px', color:'#475569', borderBottom:B, fontVariantNumeric:'tabular-nums' }}>{v.updatedAt}</td>
                  <td style={{ padding:'12px 14px', color:'#334155', borderBottom:B }}>{v.author}</td>

                  {/* Action dropdown */}
                  <td style={{ padding:'12px 14px', textAlign:'center', borderBottom:B, position:'relative' }}>
                    <button
                      onClick={() => setOpenMenuId(openMenuId === v.id ? null : v.id)}
                      style={{
                        padding:'6px 12px', borderRadius:6, border:'1px solid #dde5f0',
                        background:'white', color:'#334155', fontSize:12, fontWeight:600,
                        cursor:'pointer', fontFamily:'inherit', display:'inline-flex', alignItems:'center', gap:4,
                      }}
                    >
                      アクション <span style={{ fontSize:9, color:'#94a3b8' }}>▼</span>
                    </button>
                    {openMenuId === v.id && (
                      <div
                        ref={menuRef}
                        style={{
                          position:'absolute', top:'calc(100% + 2px)', right:14, zIndex:30,
                          background:'white', border:B, borderRadius:8,
                          boxShadow:'0 8px 24px rgba(15,23,42,0.12)', minWidth:160, overflow:'hidden',
                        }}
                      >
                        <button onClick={handleCreate}
                          style={menuItemStyle()}>
                          <span style={{ marginRight:6 }}>＋</span>新規作成
                        </button>
                        <button onClick={() => handleConfirm(v.id)} disabled={v.status === 'confirmed'}
                          style={menuItemStyle(v.status === 'confirmed')}>
                          <span style={{ marginRight:6 }}>✓</span>シフトの確定
                        </button>
                        <button onClick={() => { setDeleteTarget(v); setOpenMenuId(null) }}
                          style={{ ...menuItemStyle(), color:'#dc2626' }}>
                          <span style={{ marginRight:6 }}>🗑</span>削除
                        </button>
                      </div>
                    )}
                  </td>

                  {/* Edit button */}
                  <td style={{ padding:'12px 14px', textAlign:'center', borderBottom:B }}>
                    <button
                      onClick={() => navigate(`/${orgId}/manager/shift/${v.id}`)}
                      style={{
                        padding:'6px 14px', borderRadius:6, border:'none',
                        background:'#4f46e5', color:'white', fontSize:12, fontWeight:600,
                        cursor:'pointer', fontFamily:'inherit',
                      }}
                    >
                      編集
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Delete confirmation modal ── */}
      {deleteTarget && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(15,23,42,0.45)',
          display:'flex', alignItems:'center', justifyContent:'center', zIndex:100,
        }}
          onClick={() => setDeleteTarget(null)}
        >
          <div onClick={e => e.stopPropagation()} style={{
            background:'white', borderRadius:12, padding:24, width:'min(420px, 92vw)',
            boxShadow:'0 20px 50px rgba(15,23,42,0.25)',
          }}>
            <div style={{ fontSize:16, fontWeight:700, color:'#0f172a', marginBottom:8 }}>バージョンを削除</div>
            <div style={{ fontSize:13, color:'#475569', marginBottom:20, lineHeight:1.6 }}>
              「<b>{deleteTarget.name}</b>」を削除します。<br />
              この操作は取り消せません。
            </div>
            <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
              <button onClick={() => setDeleteTarget(null)}
                style={{ padding:'8px 16px', borderRadius:6, border:'1px solid #dde5f0', background:'white', color:'#334155', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                キャンセル
              </button>
              <button onClick={() => handleDelete(deleteTarget.id)}
                style={{ padding:'8px 16px', borderRadius:6, border:'none', background:'#dc2626', color:'white', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function menuItemStyle(disabled = false) {
  return {
    display:'block', width:'100%', textAlign:'left',
    padding:'9px 14px', fontSize:12.5, fontWeight:500,
    background:'white', border:'none', cursor: disabled ? 'not-allowed' : 'pointer',
    color: disabled ? '#cbd5e1' : '#334155',
    fontFamily:'inherit',
  }
}
