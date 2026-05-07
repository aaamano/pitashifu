import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import TopPage from './pages/TopPage'
import ManagerLayout from './components/ManagerLayout'
import EmployeeLayout from './components/EmployeeLayout'
import Dashboard from './pages/manager/Dashboard'
import Targets from './pages/manager/Targets'
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

        <Route path="/manager" element={<ManagerLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="targets" element={<Targets />} />
          <Route path="shift" element={<ShiftDecision />} />
          <Route path="members" element={<Members />} />
          <Route path="members/:id" element={<MemberDetail />} />
          <Route path="settings" element={<StoreSettings />} />
          <Route path="payroll" element={<Payroll />} />
          <Route path="notifications" element={<ManagerNotifications />} />
        </Route>

        <Route path="/employee" element={<EmployeeLayout />}>
          <Route index element={<Schedule />} />
          <Route path="submit" element={<ShiftSubmit />} />
          <Route path="notifications" element={<EmployeeNotifications />} />
        </Route>

        <Route path="/employee-ver2" element={<EmployeeLayout />}>
          <Route index element={<Schedule base="/employee-ver2" sukima={true} />} />
          <Route path="submit" element={<ShiftSubmit base="/employee-ver2" sukima={true} />} />
          <Route path="notifications" element={<EmployeeNotifications base="/employee-ver2" sukima={true} />} />
          <Route path="sukima" element={<SukimaTop />} />
          <Route path="sukima/:id" element={<SukimaDetail />} />
        </Route>

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  )
}
