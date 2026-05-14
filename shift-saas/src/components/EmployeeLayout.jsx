import { Outlet } from 'react-router-dom'

export default function EmployeeLayout() {
  return (
    <div className="emp-wrap emp-stage">
      <div className="emp-frame">
        <Outlet />
      </div>
    </div>
  )
}
