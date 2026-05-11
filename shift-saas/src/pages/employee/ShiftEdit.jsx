import { useState } from 'react'
import { Link } from 'react-router-dom'
import { daysConfig, YEAR_MONTH, staff } from '../../data/mockData'

const ME = staff[0]

const HOURS = Array.from({ length: 15 }, (_, i) => i + 8) // 8 to 22
const MINS = ['00', '15', '30', '45']

const defaultPref = { status: 'off', startH: 9, startM: '00', endH: 18, endM: '00' }

const statusLabel = (s) =>
  s === 'prefer' ? '★ 第一希望' : s === 'available' ? '出勤可' : '休み希望'

const statusStyle = (s) =>
  s === 'prefer'
    ? { background: 'var(--pita-accent-soft)', color: 'var(--pita-accent-text)' }
    : s === 'available'
    ? { background: 'oklch(0.93 0.05 150)', color: 'oklch(0.35 0.07 150)' }
    : { background: 'var(--pita-bg-subtle)', color: 'var(--pita-muted)' }

export default function ShiftEdit() {
  const [prefs, setPrefs] = useState(() =>
    Object.fromEntries(daysConfig.map(d => [d.day, { ...defaultPref }]))
  )
  const [saved, setSaved] = useState(false)

  const setTime = (day, field, val) =>
    setPrefs(prev => ({ ...prev, [day]: { ...prev[day], [field]: val } }))

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const availCount = Object.values(prefs).filter(p => p.status === 'available' || p.status === 'prefer').length
  const preferCount = Object.values(prefs).filter(p => p.status === 'prefer').length

  return (
    <div className="pita-phone-stage">
      {/* Left: phone */}
      <div>
        <div className="pita-phone">
          <div className="pita-phone-inner">
            <div className="pita-notch" />
            <div className="pita-status-bar">
              <span>9:41</span>
              <span>●●● 5G 100%</span>
            </div>

            {/* Header */}
            <div className="pita-phone-header">
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'var(--pita-accent)', color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700, flexShrink: 0,
              }}>
                {ME.name[0]}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--pita-text)', lineHeight: 1.2 }}>
                  希望提出
                </div>
                <div style={{ fontSize: 10, color: 'var(--pita-muted)', marginTop: 1 }}>
                  4月 前半
                </div>
              </div>
              <button className="pita-btn accent" style={{ fontSize: 10, height: 24 }}>
                + 新規
              </button>
            </div>

            {/* Deadline banner */}
            <div style={{
              padding: '8px 14px',
              background: 'var(--pita-accent-soft)',
              color: 'var(--pita-accent-text)',
              fontSize: 11,
              borderBottom: '1px solid var(--pita-border)',
              flexShrink: 0,
            }}>
              提出期限: <strong>3/25</strong> まで　|
              出勤可 <strong>{availCount}日</strong>　★ <strong>{preferCount}日</strong>
            </div>

            {/* Day list - scrollable */}
            <div className="pita-phone-body">
              {daysConfig.map(d => {
                const p = prefs[d.day]
                return (
                  <div
                    key={d.day}
                    style={{
                      padding: '10px 14px',
                      borderBottom: '1px solid var(--pita-border)',
                      background: 'var(--pita-panel)',
                    }}
                  >
                    {/* Top row: date + status badge */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: p.status !== 'off' ? 6 : 0,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                        <span style={{
                          fontSize: 13, fontWeight: 700,
                          color: d.isWeekend ? 'oklch(0.50 0.12 20)' : 'var(--pita-text)',
                          fontFamily: 'var(--font-mono)',
                        }}>
                          4/{d.day}
                        </span>
                        <span style={{
                          fontSize: 10,
                          color: d.dow === '日' ? 'oklch(0.50 0.12 20)'
                            : d.dow === '土' ? 'oklch(0.40 0.10 250)'
                            : 'var(--pita-muted)',
                        }}>
                          ({d.dow})
                        </span>
                      </div>
                      <span style={{
                        fontSize: 9, padding: '2px 7px', borderRadius: 10,
                        fontWeight: 600,
                        ...statusStyle(p.status),
                      }}>
                        {statusLabel(p.status)}
                      </span>
                    </div>

                    {/* Time selects (only when available or prefer) */}
                    {p.status !== 'off' && (
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 11, marginBottom: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 9, color: 'var(--pita-muted)', flexShrink: 0 }}>時間</span>
                        <select
                          value={p.startH}
                          onChange={e => setTime(d.day, 'startH', Number(e.target.value))}
                          style={{
                            border: '1px solid var(--pita-border)', borderRadius: 4,
                            padding: '1px 3px', fontSize: 10, background: 'var(--pita-bg)',
                            color: 'var(--pita-text)', fontFamily: 'var(--font-mono)',
                            cursor: 'pointer', outline: 'none',
                          }}
                        >
                          {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                        <span style={{ color: 'var(--pita-muted)', fontSize: 10 }}>:</span>
                        <select
                          value={p.startM}
                          onChange={e => setTime(d.day, 'startM', e.target.value)}
                          style={{
                            border: '1px solid var(--pita-border)', borderRadius: 4,
                            padding: '1px 3px', fontSize: 10, background: 'var(--pita-bg)',
                            color: 'var(--pita-text)', fontFamily: 'var(--font-mono)',
                            cursor: 'pointer', outline: 'none',
                          }}
                        >
                          {MINS.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <span style={{ color: 'var(--pita-muted)', fontSize: 10, padding: '0 1px' }}>〜</span>
                        <select
                          value={p.endH}
                          onChange={e => setTime(d.day, 'endH', Number(e.target.value))}
                          style={{
                            border: '1px solid var(--pita-border)', borderRadius: 4,
                            padding: '1px 3px', fontSize: 10, background: 'var(--pita-bg)',
                            color: 'var(--pita-text)', fontFamily: 'var(--font-mono)',
                            cursor: 'pointer', outline: 'none',
                          }}
                        >
                          {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                        <span style={{ color: 'var(--pita-muted)', fontSize: 10 }}>:</span>
                        <select
                          value={p.endM}
                          onChange={e => setTime(d.day, 'endM', e.target.value)}
                          style={{
                            border: '1px solid var(--pita-border)', borderRadius: 4,
                            padding: '1px 3px', fontSize: 10, background: 'var(--pita-bg)',
                            color: 'var(--pita-text)', fontFamily: 'var(--font-mono)',
                            cursor: 'pointer', outline: 'none',
                          }}
                        >
                          {MINS.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <span style={{ color: 'var(--pita-faint)', fontSize: 9, marginLeft: 2 }}>
                          ({Math.max(0, p.endH - p.startH)}h)
                        </span>
                      </div>
                    )}

                    {/* 3-way status toggle */}
                    <div style={{ display: 'flex', gap: 4 }}>
                      {['off', 'available', 'prefer'].map(s => (
                        <button
                          key={s}
                          onClick={() => setPrefs(prev => ({ ...prev, [d.day]: { ...prev[d.day], status: s } }))}
                          style={{
                            fontSize: 9, padding: '2px 6px', borderRadius: 10,
                            cursor: 'pointer', fontFamily: 'inherit',
                            border: p.status === s ? 'none' : '1px solid var(--pita-border)',
                            background: p.status === s
                              ? (s === 'prefer' ? 'var(--pita-accent)' : s === 'available' ? 'oklch(0.62 0.09 150)' : 'var(--pita-text)')
                              : 'var(--pita-bg)',
                            color: p.status === s ? 'white' : 'var(--pita-muted)',
                          }}
                        >
                          {s === 'prefer' ? '★希望' : s === 'available' ? '出勤可' : '休み'}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}

              {/* Save button inside scroll area at bottom */}
              <div style={{ padding: '12px 14px', background: 'var(--pita-bg)' }}>
                <button
                  onClick={handleSave}
                  style={{
                    width: '100%',
                    padding: '10px 0',
                    borderRadius: 10,
                    border: 'none',
                    background: saved ? 'var(--pita-ok)' : 'var(--pita-text)',
                    color: 'white',
                    fontFamily: 'inherit',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {saved ? '✓ 送信済み' : '希望シフトを送信する'}
                </button>
                <div style={{ fontSize: 9, textAlign: 'center', color: 'var(--pita-faint)', marginTop: 5 }}>
                  マネージャーに通知されます
                </div>
              </div>
            </div>

            {/* Tab bar */}
            <div className="pita-phone-tabbar">
              <Link to="/pitashif/employee" className="pita-tab-item">
                <span className="pita-tab-ico">📅</span>
                シフト
              </Link>
              <Link to="/pitashif/employee/edit" className="pita-tab-item active">
                <span className="pita-tab-ico">✏️</span>
                希望
              </Link>
              <span className="pita-tab-item">
                <span className="pita-tab-ico">👤</span>
                アカウント
              </span>
            </div>
          </div>
        </div>
        <div style={{
          textAlign: 'center', marginTop: 12,
          fontFamily: 'var(--font-mono)', fontSize: 11,
          color: 'var(--pita-faint)',
        }}>
          URL: /employee/edit
        </div>
      </div>

      {/* Right: side notes */}
      <div>
        <div className="pita-side-note">
          <div style={{
            fontFamily: 'var(--font-mono)', fontWeight: 600,
            marginBottom: 10, color: 'var(--pita-text)',
          }}>
            操作ガイド
          </div>
          <ul style={{ paddingLeft: 16, margin: '0 0 12px' }}>
            <li style={{ marginBottom: 6 }}>
              <strong style={{ color: 'var(--pita-text)' }}>休み希望</strong>
              <br />「休み」ボタンを選択すると、その日はシフト不可として登録されます。
            </li>
            <li style={{ marginBottom: 6 }}>
              <strong style={{ color: 'var(--pita-text)' }}>出勤可</strong>
              <br />「出勤可」を選択し、希望時間帯を入力してください。
            </li>
            <li style={{ marginBottom: 6 }}>
              <strong style={{ color: 'var(--pita-text)' }}>★ 第一希望</strong>
              <br />特に入りたい日は「★希望」を選択。マネージャーが優先的に考慮します。
            </li>
            <li style={{ marginBottom: 6 }}>
              <strong style={{ color: 'var(--pita-text)' }}>送信</strong>
              <br />提出期限（3/25）までに「希望シフトを送信する」を押してください。
            </li>
          </ul>
          <hr style={{ border: 'none', borderTop: '1px solid var(--pita-border)', margin: '10px 0' }} />
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--pita-text)', marginBottom: 6, fontFamily: 'var(--font-mono)' }}>
              ステータス凡例
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {[
                { label: '休み希望', background: 'var(--pita-bg-subtle)', color: 'var(--pita-muted)' },
                { label: '出勤可', background: 'oklch(0.93 0.05 150)', color: 'oklch(0.35 0.07 150)' },
                { label: '★ 第一希望', background: 'var(--pita-accent-soft)', color: 'var(--pita-accent-text)' },
              ].map(({ label, background, color }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{
                    display: 'inline-block', width: 48, height: 16, borderRadius: 8,
                    background, flexShrink: 0,
                  }} />
                  <span style={{ fontSize: 11, color: 'var(--pita-muted)' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
          <hr style={{ border: 'none', borderTop: '1px solid var(--pita-border)', margin: '10px 0' }} />
          <Link to="/" style={{
            fontFamily: 'var(--font-mono)', fontSize: 11,
            color: 'var(--pita-muted)', textDecoration: 'none',
          }}>
            ← TOPへ
          </Link>
        </div>
      </div>
    </div>
  )
}
