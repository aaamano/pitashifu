// ピタシフ brand icon — calendar body + puzzle-piece tab on right + sparkles
// Matches the official icon size guide (calendar grid + puzzle connector + sparkles)

export function LogoIcon({ size = 32 }) {
  // viewBox: 56w × 64h (body 46w + 10 for puzzle tab, rings above at y=0)
  return (
    <svg
      width={size}
      height={Math.round(size * 64 / 56)}
      viewBox="0 0 56 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="ピタシフ"
    >
      {/* Calendar binding rings (top) */}
      <rect x="12" y="0" width="5" height="10" rx="2.5" fill="#818CF8"/>
      <rect x="30" y="0" width="5" height="10" rx="2.5" fill="#818CF8"/>

      {/* Main calendar body */}
      <rect x="2" y="6" width="46" height="56" rx="10" fill="#4F46E5"/>

      {/* Puzzle tab — protruding circle on right side */}
      <circle cx="48" cy="37" r="8" fill="#4F46E5"/>

      {/* Dark header band */}
      <path d="M2 16 Q2 6 12 6 H38 Q48 6 48 16 V26 H2 Z" fill="#3730A3"/>

      {/* Calendar grid — horizontal lines */}
      <line x1="8"  y1="36" x2="42" y2="36" stroke="rgba(255,255,255,0.38)" strokeWidth="1.4"/>
      <line x1="8"  y1="47" x2="42" y2="47" stroke="rgba(255,255,255,0.38)" strokeWidth="1.4"/>

      {/* Calendar grid — vertical lines */}
      <line x1="21" y1="27" x2="21" y2="60" stroke="rgba(255,255,255,0.38)" strokeWidth="1.4"/>
      <line x1="34" y1="27" x2="34" y2="60" stroke="rgba(255,255,255,0.38)" strokeWidth="1.4"/>

      {/* Highlighted calendar cell (today indicator) */}
      <rect x="22" y="28" width="11" height="8" rx="2" fill="rgba(255,255,255,0.18)"/>

      {/* Sparkle — large, in header */}
      <path d="M15 15 L16.3 18.7 L20 20 L16.3 21.3 L15 25 L13.7 21.3 L10 20 L13.7 18.7 Z"
        fill="white" opacity="0.72"/>
      {/* Sparkle — small */}
      <path d="M25 10 L25.7 11.8 L27.5 12.5 L25.7 13.2 L25 15 L24.3 13.2 L22.5 12.5 L24.3 11.8 Z"
        fill="white" opacity="0.50"/>
    </svg>
  )
}

export function LogoMark({ size = 32, color = '#0F172A', tagline = false }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: size * 0.28 }}>
      <LogoIcon size={size} />
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
        <span style={{
          fontFamily: '"Noto Sans JP", sans-serif',
          fontSize: size * 0.82,
          fontWeight: 800,
          color,
          letterSpacing: '-0.01em',
        }}>
          ピタシフ
        </span>
        {tagline && (
          <span style={{
            fontFamily: '"Noto Sans JP", sans-serif',
            fontSize: size * 0.30,
            fontWeight: 500,
            color: '#64748B',
            marginTop: 2,
            letterSpacing: '0.04em',
          }}>
            シフト管理を ピタッと
          </span>
        )}
      </div>
    </div>
  )
}
