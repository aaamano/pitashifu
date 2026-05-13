import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// 現在ログイン中ユーザーの employees 行を返す
// 未認証 / 未登録の場合は null
export function useMe() {
  const [me, setMe] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (cancelled) return
        if (!user) { setMe(null); return }
        const { data, error } = await supabase
          .from('employees')
          .select('*')
          .eq('auth_user_id', user.id)
          .maybeSingle()
        if (cancelled) return
        if (error) console.error('[useMe]', error)
        setMe(data ?? null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  return { me, loading }
}
