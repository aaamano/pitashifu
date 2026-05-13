import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { OrgProvider } from './context/OrgContext'

import TopPage from './pages/TopPage'
import NotFound from './pages/NotFound'
import Login from './pages/auth/Login'
import Signup from './pages/auth/Signup'

import ManagerLayout from './components/ManagerLayout'
import EmployeeLayout from './components/EmployeeLayout'
import Dashboard from './pages/manager/Dashboard'
import Targets from './pages/manager/Targets'
import ShiftList from './pages/manager/ShiftList'
import ShiftDecision from './pages/manager/ShiftDecision'
import Members from './pages/manager/Members'
import MemberDetail from './pages/manager/MemberDetail'
import StoreSettings from './pages/manager/StoreSettings'
import ManagerNotifications from './pages/manager/Notifications'
import Payroll from './pages/manager/Payroll'
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

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/"        element={<TopPage />} />
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
            <Route path="members"       element={<Members />} />
            <Route path="members/:id"   element={<MemberDetail />} />
            <Route path="settings"      element={<StoreSettings />} />
            <Route path="payroll"       element={<Payroll />} />
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
