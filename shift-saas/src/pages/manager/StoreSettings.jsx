import { useState, useEffect } from 'react'
import { storeConfig as initialConfig, YEAR_MONTH, skillLabels as initialSkillLabels, DEFAULT_STORE_ADDRESS } from '../../data/mockData'
import { useOrg } from '../../context/OrgContext'
import { loadSettings, saveSettings } from '../../api/orgSettings'

// Hardcoded color lookup (avoids Tailwind purge issues with dynamic strings)
const TASK_COLORS = {
  orange: { card: 'bg-orange-100 border-orange-300 text-orange-900', badge: 'bg-orange-200 text-orange-800', btn: 'bg-orange-100 border-2 border-orange-400 text-orange-800' },
  purple: { card: 'bg-purple-100 border-purple-300 text-purple-900', badge: 'bg-purple-200 text-purple-800', btn: 'bg-purple-100 border-2 border-purple-400 text-purple-800' },
  blue:   { card: 'bg-blue-100 border-blue-300 text-blue-900',       badge: 'bg-blue-200 text-blue-800',   btn: 'bg-blue-100 border-2 border-blue-400 text-blue-800' },
  green:  { card: 'bg-green-100 border-green-300 text-green-900',    badge: 'bg-green-200 text-green-800', btn: 'bg-green-100 border-2 border-green-400 text-green-800' },
  red:    { card: 'bg-red-100 border-red-300 text-red-900',          badge: 'bg-red-200 text-red-800',     btn: 'bg-red-100 border-2 border-red-400 text-red-800' },
}
const COLOR_OPTIONS = [
  { key: 'orange', label: 'オレンジ' },
  { key: 'purple', label: 'パープル' },
  { key: 'blue',   label: 'ブルー' },
  { key: 'green',  label: 'グリーン' },
  { key: 'red',    label: 'レッド' },
]
const HOURS = Array.from({ length: 15 }, (_, i) => i + 8)
const MINS  = ['00', '15', '30', '45']

export { TASK_COLORS }

export default function StoreSettings() {
  const { stores } = useOrg()
  const storeId = stores[0]?.id

  const [config,    setConfig]    = useState(initialConfig)
  const [address,   setAddress]   = useState(DEFAULT_STORE_ADDRESS)
  const [saved,     setSaved]     = useState(false)
  const [errMsg,    setErrMsg]    = useState('')
  const [saving,    setSaving]    = useState(false)
  const [editTask,  setEditTask]  = useState(null)
  const [taskForm,  setTaskForm]  = useState(null)
  const [skills,    setSkills]    = useState(Object.entries(initialSkillLabels).map(([key, label]) => ({ key, label })))
  const [newSkill,  setNewSkill]  = useState({ key: '', label: '' })
  const [editSkill, setEditSkill] = useState(null)

  useEffect(() => {
    if (!storeId) return
    let cancelled = false
    loadSettings(storeId)
      .then(s => {
        if (cancelled || !s) return
        setConfig(prev => ({
          ...prev,
          openHour:        s.openHour        ?? prev.openHour,
          closeHour:       s.closeHour       ?? prev.closeHour,
          slotInterval:    s.slotInterval    ?? prev.slotInterval,
          avgProductivity: s.avgProductivity ?? prev.avgProductivity,
          breakRules:      s.breakRules      ?? prev.breakRules,
          specialTasks:    s.specialTasks    ?? prev.specialTasks,
        }))
        if (s.address) setAddress(s.address)
        if (s.skillLabels) setSkills(Object.entries(s.skillLabels).map(([key, label]) => ({ key, label })))
      })
      .catch(e => { if (!cancelled) setErrMsg(e.message || '読み込みに失敗しました') })
    return () => { cancelled = true }
  }, [storeId])

  const addSkill = () => {
    if (!newSkill.key.trim() || !newSkill.label.trim()) return
    if (skills.some(s => s.key === newSkill.key.trim())) return
    setSkills(prev => [...prev, { key: newSkill.key.trim().toLowerCase().replace(/\s+/g,'_'), label: newSkill.label.trim() }])
    setNewSkill({ key: '', label: '' })
  }
  const removeSkill = (idx) => setSkills(prev => prev.filter((_, i) => i !== idx))
  const updateSkill = (idx, field, val) => setSkills(prev => prev.map((s, i) => i === idx ? { ...s, [field]: val } : s))

  const handleSave = async () => {
    if (!storeId) { setErrMsg('店舗IDが取得できません'); return }
    setSaving(true); setErrMsg('')
    const skillLabels = skills.reduce((acc, s) => { acc[s.key] = s.label; return acc }, {})
    const settings = {
      openHour: config.openHour, closeHour: config.closeHour,
      slotInterval: config.slotInterval, avgProductivity: config.avgProductivity,
      breakRules: config.breakRules, specialTasks: config.specialTasks,
      skillLabels, address,
    }
    try {
      await saveSettings(storeId, settings)
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      setErrMsg(e.message || '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const openEdit = (task) => {
    const [sh, sm] = task.startTime.split(':').map(Number)
    const [eh, em] = task.endTime.split(':').map(Number)
    setTaskForm({ ...task, startH: sh, startM: String(sm).padStart(2,'0'), endH: eh, endM: String(em).padStart(2,'0') })
    setEditTask(task.id)
  }
  const openNew = () => {
    setTaskForm({ id: Date.now(), name: '', startH: 9, startM: '00', endH: 9, endM: '45', requiredStaff: 2, colorKey: 'orange', enabled: true })
    setEditTask('new')
  }
  const saveTask = () => {
    if (!taskForm?.name?.trim()) return
    const updated = { ...taskForm, startTime: `${taskForm.startH}:${taskForm.startM}`, endTime: `${taskForm.endH}:${taskForm.endM}` }
    setConfig(prev => ({
      ...prev,
      specialTasks: editTask === 'new'
        ? [...prev.specialTasks, updated]
        : prev.specialTasks.map(t => t.id === editTask ? updated : t),
    }))
    setEditTask(null); setTaskForm(null)
  }
  const removeTask = (id) => setConfig(prev => ({ ...prev, specialTasks: prev.specialTasks.filter(t => t.id !== id) }))
  const toggleTask = (id) => setConfig(prev => ({
    ...prev,
    specialTasks: prev.specialTasks.map(t => t.id === id ? { ...t, enabled: !t.enabled } : t),
  }))

  return (
    <div className="mgr-page" style={{ maxWidth: 860 }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <div style={{ fontSize:11, color:'#94a3b8', marginBottom:4 }}>{YEAR_MONTH}</div>
          <h1 style={{ fontSize:22, fontWeight:700, color:'#0f172a', letterSpacing:'-0.01em', margin:0 }}>店舗設定</h1>
          <p style={{ fontSize:12, color:'#64748b', marginTop:4, marginBottom:0 }}>各店舗ごとに個別設定できます</p>
        </div>
        <button onClick={handleSave} disabled={saving || !storeId} className="mgr-btn-primary">
          {saving ? '保存中…' : saved ? '✓ 保存しました' : '設定を保存'}
        </button>
      </div>

      {errMsg && (
        <div style={{ marginBottom:14, padding:'10px 14px', background:'#FEE2E2', color:'#991B1B', border:'1px solid #FECACA', borderRadius:8, fontSize:13 }}>
          {errMsg}
        </div>
      )}

      {/* Basic settings */}
      <div className="mgr-card" style={{ padding:24, marginBottom:20 }}>
        <h2 style={{ fontSize:14, fontWeight:600, color:'#0f172a', marginBottom:16, marginTop:0 }}>基本設定</h2>

        {/* Address */}
        <div style={{ marginBottom:20 }}>
          <label className="mgr-label">店舗住所</label>
          <div style={{ display:'flex', gap:8 }}>
            <input
              type="text"
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="〒000-0000 都道府県市区町村..."
              className="mgr-input"
            />
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(address)}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'0 14px', borderRadius:8, border:'1px solid #E2E8F0', background:'white', color:'#475569', fontSize:12, fontWeight:600, textDecoration:'none', whiteSpace:'nowrap', flexShrink:0 }}
            >
              🗺 地図を確認
            </a>
          </div>
          <div style={{ fontSize:11, color:'#94A3B8', marginTop:4 }}>スキマバイトのマップ表示に使用されます</div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
          <div>
            <label className="mgr-label">営業開始時間</label>
            <select value={config.openHour} onChange={e => setConfig(p => ({ ...p, openHour: Number(e.target.value) }))}
              className="mgr-input">
              {HOURS.map(h => <option key={h} value={h}>{h}:00</option>)}
            </select>
          </div>
          <div>
            <label className="mgr-label">営業終了時間</label>
            <select value={config.closeHour} onChange={e => setConfig(p => ({ ...p, closeHour: Number(e.target.value) }))}
              className="mgr-input">
              {HOURS.map(h => <option key={h} value={h}>{h}:00</option>)}
            </select>
          </div>
          <div>
            <label className="mgr-label">シフト時間単位（デフォルト）</label>
            <div style={{ display:'flex', gap:8 }}>
              {[15, 30, 60].map(v => (
                <button key={v} onClick={() => setConfig(p => ({ ...p, slotInterval: v }))}
                  style={{
                    flex:1, padding:'8px 0', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer',
                    border: config.slotInterval === v ? 'none' : '1px solid #dde5f0',
                    background: config.slotInterval === v ? '#4f46e5' : 'white',
                    color: config.slotInterval === v ? 'white' : '#64748b',
                    fontFamily:'inherit', transition:'all 0.15s',
                  }}>
                  {v}分
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mgr-label">平均時間生産性（件/人/時）</label>
            <input type="number" value={config.avgProductivity}
              onChange={e => setConfig(p => ({ ...p, avgProductivity: Number(e.target.value) }))}
              className="mgr-input" min={1} max={30} />
            <div style={{ fontSize:11, color:'#94a3b8', marginTop:4 }}>必要人員数の算出に使用</div>
          </div>
        </div>
      </div>

      {/* Break time rules */}
      <div className="mgr-card" style={{ padding:24, marginBottom:20 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
          <div>
            <h2 style={{ fontSize:14, fontWeight:600, color:'#0f172a', margin:0 }}>休憩時間設定</h2>
            <p style={{ fontSize:11, color:'#64748b', marginTop:3, marginBottom:0 }}>勤務時間に応じた休憩時間を設定します</p>
          </div>
          <button
            onClick={() => setConfig(p => ({ ...p, breakRules: [{ minWorkHours: 6, breakMinutes: 45 }, ...(p.breakRules || [])] }))}
            className="mgr-btn-primary" style={{ padding:'6px 14px', fontSize:12 }}>
            + ルール追加
          </button>
        </div>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead>
            <tr style={{ borderBottom:'2px solid #e2e8f0' }}>
              <th style={{ textAlign:'left', padding:'8px 12px', fontWeight:600, color:'#475569', fontSize:12 }}>勤務時間（以上）</th>
              <th style={{ textAlign:'left', padding:'8px 12px', fontWeight:600, color:'#475569', fontSize:12 }}>休憩時間</th>
              <th style={{ width:60 }}></th>
            </tr>
          </thead>
          <tbody>
            {(config.breakRules || []).map((rule, idx) => (
              <tr key={idx} style={{ borderBottom:'1px solid #f1f5f9' }}>
                <td style={{ padding:'8px 12px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <input
                      type="number" min={1} max={24} step={0.5}
                      value={rule.minWorkHours}
                      onChange={e => setConfig(p => ({
                        ...p,
                        breakRules: p.breakRules.map((r, i) => i === idx ? { ...r, minWorkHours: Number(e.target.value) } : r)
                          .sort((a, b) => b.minWorkHours - a.minWorkHours),
                      }))}
                      className="mgr-input" style={{ width:80, fontSize:13 }} />
                    <span style={{ color:'#64748b', fontSize:12 }}>時間以上</span>
                  </div>
                </td>
                <td style={{ padding:'8px 12px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <select
                      value={rule.breakMinutes}
                      onChange={e => setConfig(p => ({
                        ...p,
                        breakRules: p.breakRules.map((r, i) => i === idx ? { ...r, breakMinutes: Number(e.target.value) } : r),
                      }))}
                      className="mgr-input" style={{ width:100, fontSize:13 }}>
                      {[15, 30, 45, 60, 75, 90].map(m => <option key={m} value={m}>{m}分</option>)}
                    </select>
                  </div>
                </td>
                <td style={{ padding:'8px 12px', textAlign:'center' }}>
                  <button
                    onClick={() => setConfig(p => ({ ...p, breakRules: p.breakRules.filter((_, i) => i !== idx) }))}
                    style={{ color:'#ef4444', background:'none', border:'none', cursor:'pointer', fontSize:16, fontWeight:700 }}>×</button>
                </td>
              </tr>
            ))}
            {(!config.breakRules || config.breakRules.length === 0) && (
              <tr>
                <td colSpan={3} style={{ padding:'20px 12px', textAlign:'center', color:'#94a3b8', fontSize:12 }}>
                  ルールが設定されていません
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <p style={{ fontSize:11, color:'#94a3b8', marginTop:10, marginBottom:0 }}>
          ※ 複数ルールがある場合、勤務時間に合致する最初のルール（時間が長いもの優先）が適用されます
        </p>
      </div>

      {/* Special tasks */}
      <div className="mgr-card" style={{ padding:24 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
          <div>
            <h2 style={{ fontSize:14, fontWeight:600, color:'#0f172a', margin:0 }}>特別業務時間帯</h2>
            <p style={{ fontSize:11, color:'#64748b', marginTop:3, marginBottom:0 }}>この時間帯は必要人員数に自動加算されます</p>
          </div>
          <button onClick={openNew} className="mgr-btn-primary" style={{ padding:'6px 14px', fontSize:12 }}>
            + 追加
          </button>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {config.specialTasks.map(task => {
            const colors = TASK_COLORS[task.colorKey] || TASK_COLORS.orange
            return (
              <div key={task.id} className={`flex items-center gap-4 p-4 rounded-xl border ${colors.card}`}
                style={{ opacity: task.enabled ? 1 : 0.5 }}>
                {/* Toggle switch */}
                <button
                  onClick={() => toggleTask(task.id)}
                  role="switch"
                  aria-checked={task.enabled}
                  className={`flex-shrink-0 inline-flex items-center w-11 h-6 rounded-full p-0.5 transition-colors duration-200 focus:outline-none`}
                  style={{ background: task.enabled ? '#4f46e5' : '#cbd5e1' }}
                >
                  <span className={`inline-block w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${task.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:600, fontSize:13 }}>{task.name}</div>
                  <div style={{ fontSize:11, opacity:0.7, marginTop:2 }}>{task.startTime} 〜 {task.endTime}　追加人員: +{task.requiredStaff}名</div>
                </div>
                <div style={{ display:'flex', gap:10, fontSize:12 }}>
                  <button onClick={() => openEdit(task)} style={{ fontWeight:500, textDecoration:'underline', opacity:0.7, background:'none', border:'none', cursor:'pointer', fontFamily:'inherit' }}>編集</button>
                  <button onClick={() => removeTask(task.id)} style={{ fontWeight:500, color:'#ef4444', textDecoration:'underline', opacity:0.7, background:'none', border:'none', cursor:'pointer', fontFamily:'inherit' }}>削除</button>
                </div>
              </div>
            )
          })}
          {config.specialTasks.length === 0 && (
            <div style={{ textAlign:'center', padding:'28px 24px', color:'#94a3b8', fontSize:13, border:'2px dashed #dde5f0', borderRadius:12 }}>
              特別業務が未設定です。「+ 追加」から登録してください。
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {/* ── Skill management ── */}
      <div className="mgr-card" style={{ padding:24, marginBottom:20 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
          <h2 style={{ fontSize:14, fontWeight:600, color:'#0f172a', margin:0 }}>スキル設定</h2>
          <span style={{ fontSize:11, color:'#94a3b8' }}>メンバーに設定できるスキルを管理します</span>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
          {skills.map((s, idx) => (
            <div key={s.key} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', background:'#f8fafc', borderRadius:8, border:'1px solid #e2e8f0' }}>
              {editSkill === idx ? (
                <>
                  <input value={s.key} onChange={e => updateSkill(idx,'key',e.target.value)} placeholder="キー(英数字)" className="mgr-input" style={{ width:140, padding:'5px 8px', fontSize:12 }} />
                  <input value={s.label} onChange={e => updateSkill(idx,'label',e.target.value)} placeholder="表示名" className="mgr-input" style={{ width:140, padding:'5px 8px', fontSize:12 }} />
                  <button onClick={() => setEditSkill(null)} className="mgr-btn-primary" style={{ padding:'5px 12px', fontSize:12 }}>確定</button>
                </>
              ) : (
                <>
                  <span style={{ fontSize:11, color:'#94a3b8', fontFamily:'monospace', minWidth:80 }}>{s.key}</span>
                  <span style={{ fontSize:13, fontWeight:600, color:'#0f172a', flex:1 }}>{s.label}</span>
                  <button onClick={() => setEditSkill(idx)} className="mgr-btn-secondary" style={{ padding:'4px 10px', fontSize:11 }}>編集</button>
                  <button onClick={() => removeSkill(idx)} style={{ padding:'4px 10px', borderRadius:6, border:'1px solid #fca5a5', background:'#fff1f2', color:'#dc2626', fontSize:11, cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>削除</button>
                </>
              )}
            </div>
          ))}
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'flex-end' }}>
          <div style={{ flex:1 }}><label className="mgr-label">スキルキー (英数字)</label>
            <input value={newSkill.key} onChange={e => setNewSkill(p=>({...p,key:e.target.value}))} placeholder="例: kitchen" className="mgr-input" style={{ fontSize:12 }} />
          </div>
          <div style={{ flex:1 }}><label className="mgr-label">表示名</label>
            <input value={newSkill.label} onChange={e => setNewSkill(p=>({...p,label:e.target.value}))} placeholder="例: キッチン" className="mgr-input" style={{ fontSize:12 }} onKeyDown={e => e.key==='Enter' && addSkill()} />
          </div>
          <button onClick={addSkill} className="mgr-btn-primary" style={{ padding:'8px 18px', whiteSpace:'nowrap' }}>＋ 追加</button>
        </div>
      </div>

      {editTask && taskForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h3 className="font-bold text-gray-900">{editTask === 'new' ? '特別業務を追加' : '特別業務を編集'}</h3>
              <button onClick={() => setEditTask(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">業務名 *</label>
                <input value={taskForm.name} onChange={e => setTaskForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
                  placeholder="例：搬入、掃除" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">開始時刻</label>
                  <div className="flex gap-1 items-center">
                    <select value={taskForm.startH} onChange={e => setTaskForm(p => ({ ...p, startH: Number(e.target.value) }))}
                      className="flex-1 border border-gray-300 rounded-lg px-2 py-2 text-sm outline-none focus:border-blue-400">
                      {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                    <span className="text-gray-400 text-sm">:</span>
                    <select value={taskForm.startM} onChange={e => setTaskForm(p => ({ ...p, startM: e.target.value }))}
                      className="w-16 border border-gray-300 rounded-lg px-2 py-2 text-sm outline-none focus:border-blue-400">
                      {MINS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">終了時刻</label>
                  <div className="flex gap-1 items-center">
                    <select value={taskForm.endH} onChange={e => setTaskForm(p => ({ ...p, endH: Number(e.target.value) }))}
                      className="flex-1 border border-gray-300 rounded-lg px-2 py-2 text-sm outline-none focus:border-blue-400">
                      {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                    <span className="text-gray-400 text-sm">:</span>
                    <select value={taskForm.endM} onChange={e => setTaskForm(p => ({ ...p, endM: e.target.value }))}
                      className="w-16 border border-gray-300 rounded-lg px-2 py-2 text-sm outline-none focus:border-blue-400">
                      {MINS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">追加必要人員数</label>
                <input type="number" min={1} max={10} value={taskForm.requiredStaff}
                  onChange={e => setTaskForm(p => ({ ...p, requiredStaff: Number(e.target.value) }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">表示カラー</label>
                <div className="flex gap-2 flex-wrap">
                  {COLOR_OPTIONS.map(opt => {
                    const c = TASK_COLORS[opt.key]
                    return (
                      <button key={opt.key} onClick={() => setTaskForm(p => ({ ...p, colorKey: opt.key }))}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${c.btn} ${taskForm.colorKey === opt.key ? 'ring-2 ring-blue-500 ring-offset-1' : ''}`}>
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t flex gap-3 justify-end">
              <button onClick={() => setEditTask(null)} className="mgr-btn-secondary">キャンセル</button>
              <button onClick={saveTask} className="mgr-btn-primary">保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
