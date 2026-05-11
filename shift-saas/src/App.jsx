import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import TopPage from './pages/TopPage'
import NotFound from './pages/NotFound'
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

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<TopPage />} />

        <Route path="/pitashif/manager" element={<ManagerLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="targets" element={<Targets />} />
          <Route path="shift" element={<ShiftList />} />
          <Route path="shift/:versionId" element={<ShiftDecision />} />
          <Route path="members" element={<Members />} />
          <Route path="members/:id" element={<MemberDetail />} />
          <Route path="settings" element={<StoreSettings />} />
          <Route path="payroll" element={<Payroll />} />
          <Route path="notifications" element={<ManagerNotifications />} />
        </Route>

        <Route path="/pitashif/employee" element={<EmployeeLayout />}>
          <Route index element={<Schedule />} />
          <Route path="submit" element={<ShiftSubmit />} />
          <Route path="notifications" element={<EmployeeNotifications />} />
        </Route>

        <Route path="/pitashif/employee-ver2" element={<EmployeeLayout />}>
          <Route index element={<Schedule base="/pitashif/employee-ver2" sukima={true} />} />
          <Route path="submit" element={<ShiftSubmit base="/pitashif/employee-ver2" sukima={true} />} />
          <Route path="notifications" element={<EmployeeNotifications base="/pitashif/employee-ver2" sukima={true} />} />
          <Route path="sukima" element={<SukimaTop />} />
          <Route path="sukima/:id" element={<SukimaDetail />} />
        </Route>

        {/* Backward-compat: redirect old top-level paths to /pitashif/ */}
        <Route path="/manager/*"        element={<Navigate to="/pitashif/manager" replace />} />
        <Route path="/employee/*"       element={<Navigate to="/pitashif/employee" replace />} />
        <Route path="/employee-ver2/*"  element={<Navigate to="/pitashif/employee-ver2" replace />} />

        {/* 404 — replaces silent redirect so route mismatches are visible */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}
