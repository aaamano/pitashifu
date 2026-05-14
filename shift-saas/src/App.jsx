import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { OrgProvider } from './context/OrgContext'
import { supabase } from './lib/supabase'

import NotFound from './pages/NotFound'
import Login from './pages/auth/Login'
import Signup from './pages/auth/Signup'

import ManagerLayout from './components/ManagerLayout'
import EmployeeLayout from './components/EmployeeLayout'
import Dashboard from './pages/manager/Dashboard'
import Targets from './pages/manager/Targets'
import ShiftList from './pages/manager/ShiftList'
import ShiftDecision from './pages/manager/ShiftDecision'
import PeriodRequests from './pages/manager/PeriodRequests'
import Members from './pages/manager/Members'
import MemberDetail from './pages/manager/MemberDetail'
import StoreSettings from './pages/manager/StoreSettings'
import ManagerNotifications from './pages/manager/Notifications'
import Payroll from './pages/manager/Payroll'
import Import from './pages/manager/Import'
import Schedule from './pages/employee/Schedule'
import ShiftSubmit from './pages/employee/ShiftSubmit'
import EmployeeNotifications from './pages/employee/Notifications'
import SukimaTop from './pages/employee/SukimaTop'
import SukimaDetail from './pages/employee/SukimaDetail'
import Profile from './pages/employee/Profile'
import EmployeePayroll from './pages/employee/EmployeePayroll'

function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <div style={{ padding: 32 }}>読み込み中…</div>
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }
  return children
}

// orgId ルート以下を OrgProvider でラップして子ルートを描画
function OrgScope({ children }) {
  return <OrgProvider>{children}</OrgProvider>
}

// "/" は自動ルーティング: ログイン済 → 自分の組織画面、未ログイン → /login
function IndexRedirect() {
  const { user, loading } = useAuth()
  const [target, setTarget] = useState(null)

  useEffect(() => {
    if (loading) return
    if (!user) { setTarget('/login'); return }
    let cancelled = false
    ;(async () => {
      try {
        const { data: emp } = await supabase
          .from('employees')
          .select('org_id, role')
          .eq('auth_user_id', user.id)
          .maybeSingle()
        if (cancelled) return
        if (emp?.org_id) {
          const scope = emp.role === 'staff' ? 'employee' : 'manager'
          setTarget(`/${emp.org_id}/${scope}`)
        } else {
          setTarget('/login')
        }
      } catch (e) {
        console.error('[IndexRedirect]', e)
        setTarget('/login')
      }
    })()
    return () => { cancelled = true }
  }, [user, loading])

  if (!target) return <div style={{ padding: 32 }}>読み込み中…</div>
  return <Navigate to={target} replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/"        element={<IndexRedirect />} />
          <Route path="/login"   element={<Login />} />
          <Route path="/signup"  element={<Signup />} />
          <Route path="/404"     element={<NotFound />} />

          {/* Tenant scope: /:orgId/* */}
          <Route
            path="/:orgId/manager"
            element={
              <RequireAuth>
                <OrgScope>
                  <ManagerLayout />
                </OrgScope>
              </RequireAuth>
            }
          >
            <Route index                element={<Dashboard />} />
            <Route path="targets"       element={<Targets />} />
            <Route path="shift"         element={<ShiftList />} />
            <Route path="shift/:versionId" element={<ShiftDecision />} />
            <Route path="period-requests/:periodId" element={<PeriodRequests />} />
            <Route path="members"       element={<Members />} />
            <Route path="members/:id"   element={<MemberDetail />} />
            <Route path="settings"      element={<StoreSettings />} />
            <Route path="payroll"       element={<Payroll />} />
            <Route path="import"        element={<Import />} />
            <Route path="notifications" element={<ManagerNotifications />} />
          </Route>

          <Route
            path="/:orgId/employee"
            element={
              <RequireAuth>
                <OrgScope>
                  <EmployeeLayout />
                </OrgScope>
              </RequireAuth>
            }
          >
            <Route index                element={<Schedule />} />
            <Route path="submit"        element={<ShiftSubmit />} />
            <Route path="payroll"       element={<EmployeePayroll />} />
            <Route path="sukima"        element={<SukimaTop />} />
            <Route path="sukima/:id"    element={<SukimaDetail />} />
            <Route path="notifications" element={<EmployeeNotifications />} />
            <Route path="settings"      element={<Profile />} />
          </Route>

          {/* Backward-compat: 旧 /pitashif/* を新ルートへ */}
          <Route path="/pitashif/manager/*"  element={<Navigate to="/demo/manager" replace />} />
          <Route path="/pitashif/employee/*" element={<Navigate to="/demo/employee" replace />} />

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
