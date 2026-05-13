import { createContext, useContext, useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const OrgContext = createContext(null)

const RESERVED_ORG_IDS = new Set([
  'admin', 'app', 'api', 'login', 'signup',
  'settings', 'help', 'support', 'dashboard',
  'static', 'public',
])

export function OrgProvider({ children }) {
  const { orgId } = useParams()
  const [org, setOrg] = useState(null)
  const [stores, setStores] = useState([])
  const [loading, setLoading] = useState(true)
  const [reason, setReason] = useState(null) // null | 'reserved' | 'notfound' | 'rls' | 'error'
  const [errDetail, setErrDetail] = useState('')

  useEffect(() => {
    if (!orgId) { setReason('notfound'); setLoading(false); return }
    if (RESERVED_ORG_IDS.has(orgId)) { setReason('reserved'); setLoading(false); return }

    let cancelled = false
    setLoading(true)
    setReason(null)
    setErrDetail('')

    ;(async () => {
      const { data: orgRow, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', orgId)
        .maybeSingle()

      if (cancelled) return
      if (error) {
        console.error('[OrgContext.load]', error)
        setReason('error')
        setErrDetail(error.message)
        setLoading(false)
        return
      }
      if (!orgRow) {
        // 行が無いか、RLSで読めなかった → 自分の所属を確認
        const { data: { user } } = await supabase.auth.getUser()
        const { data: empMine } = await supabase
          .from('employees')
          .select('id, org_id, role')
          .eq('auth_user_id', user?.id ?? '')
          .maybeSingle()
        if (cancelled) return
        if (empMine && empMine.org_id !== orgId) {
          setReason('wrong_org')
          setErrDetail(`あなたの所属 org_id="${empMine.org_id}" と URL の org_id="${orgId}" が異なります`)
        } else if (!empMine) {
          setReason('no_employee')
          setErrDetail('ログイン中のユーザーに紐づく employees 行が見つかりません')
        } else {
          setReason('notfound')
        }
        setLoading(false)
        return
      }

      setOrg(orgRow)

      if (orgRow.type === 'company') {
        const { data: storeRows } = await supabase
          .from('organizations')
          .select('*')
          .eq('parent_id', orgRow.id)
          .eq('type', 'store')
        if (!cancelled) setStores(storeRows ?? [])
      } else {
        setStores([orgRow])
      }

      setLoading(false)
    })()

    return () => { cancelled = true }
  }, [orgId])

  if (reason) return <OrgErrorScreen orgId={orgId} reason={reason} detail={errDetail} />

  return (
    <OrgContext.Provider value={{ orgId, org, stores, loading }}>
      {children}
    </OrgContext.Provider>
  )
}

function OrgErrorScreen({ orgId, reason, detail }) {
  const navigate = useNavigate()
  const labels = {
    reserved:   '予約語のため使用できないURLです',
    notfound:   '組織が見つかりません',
    error:      '読み込みエラー',
    wrong_org:  'URL の組織IDがあなたの所属と異なります',
    no_employee: 'employees 行が紐付いていません',
  }
  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }
  const goToMine = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: emp } = await supabase
      .from('employees')
      .select('org_id, role')
      .eq('auth_user_id', user?.id ?? '')
      .maybeSingle()
    if (emp) {
      const scope = emp.role === 'staff' ? 'employee' : 'manager'
      navigate(`/${emp.org_id}/${scope}`, { replace: true })
    }
  }
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, background: 'linear-gradient(135deg,#EEF0FE 0%,#E0F2FE 100%)', fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{ maxWidth: 520, width: '100%', background: 'white', borderRadius: 14, padding: 32, boxShadow: '0 12px 36px rgba(15,23,42,0.12)' }}>
        <div style={{ fontSize: 36, marginBottom: 6 }}>⚠️</div>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', margin: '0 0 6px' }}>{labels[reason] || 'エラー'}</h1>
        <div style={{ fontSize: 12, color: '#475569', marginBottom: 14, fontFamily: 'monospace', wordBreak: 'break-all' }}>URL: /{orgId}/...</div>
        {detail && (
          <div style={{ fontSize: 12, color: '#991B1B', background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 12px', marginBottom: 14 }}>
            {detail}
          </div>
        )}
        <div style={{ fontSize: 12, color: '#475569', marginBottom: 18, lineHeight: 1.6 }}>
          原因として考えられること:
          <ul style={{ marginLeft: 18, marginTop: 6 }}>
            <li>組織IDが間違っている、または既に削除された</li>
            <li>このユーザーは別の組織に所属している（URLが古い）</li>
            <li>employees テーブルの auth_user_id が紐付いていない</li>
          </ul>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={goToMine} style={{ padding: '9px 16px', borderRadius: 8, background: '#4F46E5', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
            自分の組織に移動
          </button>
          <button onClick={handleLogout} style={{ padding: '9px 16px', borderRadius: 8, background: 'white', color: '#475569', border: '1px solid #E2E8F0', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
            ログアウト
          </button>
        </div>
      </div>
    </div>
  )
}

export function useOrg() {
  const ctx = useContext(OrgContext)
  if (!ctx) throw new Error('useOrg must be used within OrgProvider')
  return ctx
}
