import { createContext, useContext, useEffect, useState } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const OrgContext = createContext(null)

// CLAUDE.md「予約済みorgId（使用禁止）」
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
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!orgId || RESERVED_ORG_IDS.has(orgId)) {
      setNotFound(true)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setNotFound(false)

    ;(async () => {
      const { data: orgRow, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', orgId)
        .maybeSingle()

      if (cancelled) return
      if (error || !orgRow) {
        setNotFound(true)
        setLoading(false)
        return
      }

      setOrg(orgRow)

      // 会社配下の店舗一覧を取得（会社orgならその子、店舗orgなら自身のみ）
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

  if (notFound) return <Navigate to="/404" replace />

  return (
    <OrgContext.Provider value={{ orgId, org, stores, loading }}>
      {children}
    </OrgContext.Provider>
  )
}

export function useOrg() {
  const ctx = useContext(OrgContext)
  if (!ctx) throw new Error('useOrg must be used within OrgProvider')
  return ctx
}
