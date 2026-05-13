// Unified SVG icon set for ピタシフ — rounded, friendly, professional
const wrap = (paths, size = 18, stroke = 1.8) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {paths}
  </svg>
)

export const IconDashboard = ({ size }) => wrap(<>
  <rect x="3" y="3" width="7" height="9" rx="1.5"/>
  <rect x="14" y="3" width="7" height="5" rx="1.5"/>
  <rect x="14" y="12" width="7" height="9" rx="1.5"/>
  <rect x="3" y="16" width="7" height="5" rx="1.5"/>
</>, size)

export const IconTarget = ({ size }) => wrap(<>
  <circle cx="12" cy="12" r="9"/>
  <circle cx="12" cy="12" r="5"/>
  <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
</>, size)

export const IconShift = ({ size }) => wrap(<>
  <rect x="3" y="4" width="18" height="17" rx="2.5"/>
  <line x1="16" y1="2" x2="16" y2="6"/>
  <line x1="8"  y1="2" x2="8"  y2="6"/>
  <line x1="3"  y1="10" x2="21" y2="10"/>
  <rect x="6" y="13" width="4" height="2" rx="0.5" fill="currentColor" stroke="none"/>
  <rect x="11" y="13" width="6" height="2" rx="0.5" fill="currentColor" stroke="none" opacity="0.55"/>
  <rect x="6" y="16.5" width="7" height="2" rx="0.5" fill="currentColor" stroke="none" opacity="0.55"/>
</>, size)

export const IconStaff = ({ size }) => wrap(<>
  <circle cx="9" cy="8" r="3.5"/>
  <path d="M3 21c0-3.3 2.7-6 6-6s6 2.7 6 6"/>
  <circle cx="17" cy="9" r="2.5"/>
  <path d="M15 21c0-2.5 1.7-4.5 4-5"/>
</>, size)

export const IconPayroll = ({ size }) => wrap(<>
  <rect x="3" y="6" width="18" height="13" rx="2"/>
  <circle cx="12" cy="12.5" r="2.5"/>
  <path d="M5 9h2 M17 9h2 M5 16h2 M17 16h2"/>
</>, size)

export const IconStore = ({ size }) => wrap(<>
  <path d="M3 9 L4.5 4 H19.5 L21 9"/>
  <path d="M4 9 v11 a1 1 0 0 0 1 1 H19 a1 1 0 0 0 1 -1 v-11"/>
  <path d="M3 9 a3 3 0 0 0 6 0 a3 3 0 0 0 6 0 a3 3 0 0 0 6 0"/>
  <rect x="9" y="13" width="6" height="8"/>
</>, size)

export const IconBell = ({ size }) => wrap(<>
  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
</>, size)

export const IconSettings = ({ size }) => wrap(<>
  <circle cx="12" cy="12" r="3"/>
  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
</>, size)

export const IconCheck = ({ size }) => wrap(<>
  <polyline points="20 6 9 17 4 12"/>
</>, size)

export const IconChat = ({ size }) => wrap(<>
  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
</>, size)

export const IconClock = ({ size }) => wrap(<>
  <circle cx="12" cy="12" r="9"/>
  <polyline points="12 7 12 12 15.5 14"/>
</>, size)

export const IconImport = ({ size }) => wrap(<>
  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
  <polyline points="7 10 12 15 17 10"/>
  <line x1="12" y1="15" x2="12" y2="3"/>
</>, size)
