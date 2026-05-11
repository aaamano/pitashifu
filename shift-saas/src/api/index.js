const BASE = '/api'

async function request(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`API ${method} ${path} failed: ${res.status}`)
  return res.json()
}

export const api = {
  // staff
  getStaff: () => request('GET', '/staff'),
  getStaffMember: (id) => request('GET', `/staff/${id}`),
  createStaff: (data) => request('POST', '/staff', data),
  updateStaff: (id, data) => request('PUT', `/staff/${id}`, data),
  deleteStaff: (id) => request('DELETE', `/staff/${id}`),

  // versions
  getVersions: () => request('GET', '/versions'),
  createVersion: (data) => request('POST', '/versions', data),
  updateVersion: (id, data) => request('PUT', `/versions/${id}`, data),
  deleteVersion: (id) => request('DELETE', `/versions/${id}`),

  // shift data
  getShiftData: (versionId) => request('GET', `/shift-data/${versionId}`),
  saveShiftData: (versionId, data) => request('PUT', `/shift-data/${versionId}`, data),
  getSlotAssignments: (versionId, day) => request('GET', `/slot-assignments/${versionId}/${day}`),
  saveSlotAssignments: (versionId, day, data) => request('PUT', `/slot-assignments/${versionId}/${day}`, data),

  // submissions
  getSubmissions: (staffId) => request('GET', `/submissions?staffId=${staffId}`),
  createSubmission: (data) => request('POST', '/submissions', data),
  updateSubmission: (id, data) => request('PUT', `/submissions/${id}`, data),
  deleteSubmission: (id) => request('DELETE', `/submissions/${id}`),

  // targets
  getTargets: () => request('GET', '/targets'),
  updateTarget: (day, data) => request('PUT', `/targets/${day}`, data),
  batchUpdateTargets: (data) => request('PUT', '/targets', data),

  // notifications
  getNotifications: (role) => request('GET', `/notifications?role=${role}`),
  markNotificationRead: (id) => request('PUT', `/notifications/${id}/read`, {}),
  createNotification: (data) => request('POST', '/notifications', data),
}
