import { Outlet, useParams, Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function EmployeeLayout() {
  const { orgId } = useParams()
  // 自分が manager 以上のロールなら「マネージャービューに戻る」リンクを表示
  const [canManage, setCanManage] = useState(false)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data } = await supabase
          .from('employees')
          .select('role')
          .eq('auth_user_id', user.id)
          .maybeSingle()
        if (cancelled) return
        if (data && ['owner', 'admin', 'manager'].includes(data.role)) {
          setCanManage(true)
        }
      } catch (e) {
        console.error('[EmployeeLayout.role]', e)
      }
    })()
    return () => { cancelled = true }
  }, [])

  return (
    <div className="emp-wrap emp-stage">
      {/* ビューラベル: 全画面共通の細い上部バー */}
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'center', gap:12,
        padding:'8px 16px', fontSize:11, color:'#475569',
        background:'transparent',
      }}>
        <span style={{
          fontWeight:700, color:'#3730A3',
          background:'#EEF0FE', padding:'3px 10px', borderRadius:10,
        }}>スタッフビュー</span>
        {canManage && (
          <Link to={`/${orgId}/manager`} style={{
            fontSize:11, color:'#4F46E5', textDecoration:'none', fontWeight:600,
          }}>↩ マネージャービューに戻る</Link>
        )}
      </div>
      <div className="emp-frame">
        <Outlet />
      </div>
    </div>
  )
}
