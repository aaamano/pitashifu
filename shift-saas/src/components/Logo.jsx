// PitaShift logo: 4 indigo puzzle-blocks + sparkles
export function LogoIcon({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="ピタシフ">
      {/* Sparkles */}
      <path d="M52 8 L53.5 11 L56.5 12.5 L53.5 14 L52 17 L50.5 14 L47.5 12.5 L50.5 11 Z" fill="#38BDF8" opacity="0.85"/>
      <path d="M58 18 L58.7 19.4 L60.1 20.1 L58.7 20.8 L58 22.2 L57.3 20.8 L55.9 20.1 L57.3 19.4 Z" fill="#38BDF8" opacity="0.7"/>

      {/* Top-left puzzle block */}
      <path d="M8 12 H22 V19 a3.5 3.5 0 0 1 7 0 V26 H22 H8 Z" fill="#4F46E5"/>
      {/* Top-right puzzle block */}
      <path d="M35 12 H49 a3 3 0 0 1 3 3 V29 H44.5 a3.5 3.5 0 0 0 0 -7 H35 Z" fill="#6366F1"/>
      {/* Bottom-left puzzle block */}
      <path d="M8 32 H15 a3.5 3.5 0 0 1 0 7 V52 a3 3 0 0 1 -3 3 H8 Z" fill="#6366F1"/>
      {/* Bottom-right puzzle block */}
      <path d="M22 32 H29 V39 a3.5 3.5 0 0 0 7 0 V32 H49 a3 3 0 0 1 3 3 V52 a3 3 0 0 1 -3 3 H22 a3 3 0 0 1 -3 -3 V35 a3 3 0 0 1 3 -3 Z" fill="#4F46E5"/>
    </svg>
  )
}

export function LogoMark({ size = 32, color = '#0F172A', tagline = false }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap: size * 0.3 }}>
      <LogoIcon size={size} />
      <div style={{ display:'flex', flexDirection:'column', lineHeight:1.1 }}>
        <span style={{ fontFamily:'"Noto Sans JP", sans-serif', fontSize: size * 0.85, fontWeight: 800, color, letterSpacing:'-0.01em' }}>
          ピタシフ
        </span>
        {tagline && (
          <span style={{ fontFamily:'"Noto Sans JP", sans-serif', fontSize: size * 0.32, fontWeight: 500, color: '#64748B', marginTop: 2, letterSpacing:'0.04em' }}>
            シフト管理を ピタッと
          </span>
        )}
      </div>
    </div>
  )
}
