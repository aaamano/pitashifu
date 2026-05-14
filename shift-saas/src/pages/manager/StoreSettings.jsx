import { useState, useEffect } from 'react'
import { storeConfig as initialConfig } from '../../data/mockData'
import { useOrg } from '../../context/OrgContext'
import { loadSettings, saveSettings } from '../../api/orgSettings'
import { supabase } from '../../lib/supabase'

// AI 自動配置の重み・モード設定
export const AI_CONFIG_DEFAULTS = {
  mode: 'balanced',
  weights: {
    retentionPriority: 10, // (11-priority) * W のベース係数
    incompatibility:   15, // 同スロットに相性NGがいた場合の severity あたり減点
    targetEarnings:     8, // 目標月収が設定済みなら加点
    lateToEarly:       12, // 前日深夜→翌早番のペナルティ
    wage:               0, // 時給が高いほど減点（時給1000円基準、50円差で W ポイント）
  },
}
export const AI_CONFIG_PRESETS = {
  balanced:    { retentionPriority: 10, incompatibility: 15, targetEarnings:  8, lateToEarly: 12, wage:  0 },
  cost_min:    { retentionPriority:  5, incompatibility: 10, targetEarnings:  0, lateToEarly:  8, wage: 12 },
  satisfaction:{ retentionPriority: 15, incompatibility: 20, targetEarnings: 15, lateToEarly: 15, wage:  0 },
}
const AI_MODE_LABELS = {
  balanced:     'バランス（推奨）',
  cost_min:     '人件費最小化',
  satisfaction: 'スタッフ満足度重視',
}
const AI_WEIGHT_LABELS = {
  retentionPriority: '定着優先度の重み',
  incompatibility:   '相性NGの減点強さ',
  targetEarnings:    '目標月収ありの加点',
  lateToEarly:       '深夜→早番のペナルティ',
  wage:              '時給単価の重み',
}
const AI_WEIGHT_HINTS = {
  retentionPriority: '高い人ほど優先的に配置（高=長期定着スタッフ重視）',
  incompatibility:   '相性NGが同時に入ると減点。高=徹底回避 / 低=多少同時OK',
  targetEarnings:    '目標月収を設定したスタッフを優先（高=シフト数を埋めやすく）',
  lateToEarly:       '前日深夜 → 翌早番の配置を避ける度合い',
  wage:              '時給の低いスタッフを優先（高=人件費を抑える / 0=時給を無視）',
}

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
  const { orgId, stores } = useOrg()
  const storeId = stores[0]?.id
  const noStore = !storeId  // 店舗未作成 (会社 org のみ)

  // 初回店舗作成フォーム
  const [newStoreName, setNewStoreName] = useState('')
  const [creatingStore, setCreatingStore] = useState(false)
  const [createErr, setCreateErr] = useState('')

  const createFirstStore = async () => {
    if (!orgId) { setCreateErr('orgId 未取得'); return }
    if (!newStoreName.trim()) { setCreateErr('店舗名を入力してください'); return }
    setCreatingStore(true); setCreateErr('')
    try {
      // 1. 自分の auth.users → employees.id を取得
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('未ログイン')
      const { data: meRow } = await supabase
        .from('employees').select('id').eq('auth_user_id', user.id).maybeSingle()

      // 2. 店舗 id を会社 id + 連番から生成（衝突避け）
      const baseSuffix = `${orgId}-store`
      let suffix = 1
      let storeIdCandidate = `${baseSuffix}-${suffix}`
      // 既存衝突チェック
      while (true) {
        const { data } = await supabase
          .from('organizations').select('id').eq('id', storeIdCandidate).maybeSingle()
        if (!data) break
        suffix++
        storeIdCandidate = `${baseSuffix}-${suffix}`
      }
      // 3. 店舗 org を作成
      const { error: insErr } = await supabase.from('organizations').insert({
        id:        storeIdCandidate,
        name:      newStoreName.trim(),
        type:      'store',
        parent_id: orgId,
        plan:      'free',
        settings:  {
          openHour: 9, closeHour: 23,
          slotInterval: 15, avgProductivity: 8,
        },
      })
      if (insErr) throw insErr
      // 4. 自分にこの店舗のアクセス権を付与
      if (meRow?.id) {
        await supabase.from('employee_store_access').insert({
          employee_id: meRow.id,
          store_id:    storeIdCandidate,
        })
      }
      // 5. 再読込で OrgContext を更新
      window.location.reload()
    } catch (e) {
      console.error('[StoreSettings.createFirstStore]', e)
      setCreateErr(e.message || '店舗の作成に失敗しました')
    } finally {
      setCreatingStore(false)
    }
  }

  // 初期 specialTasks は空（mockData の「搬入」「掃除」の flash 防止）
  const [config,    setConfig]    = useState({ ...initialConfig, specialTasks: [] })
  const [address,   setAddress]   = useState('')
  const [saved,     setSaved]     = useState(false)
  const [errMsg,    setErrMsg]    = useState('')
  const [saving,    setSaving]    = useState(false)
  const [editTask,  setEditTask]  = useState(null)
  const [taskForm,  setTaskForm]  = useState(null)
  const [skills,    setSkills]    = useState([])
  const [newSkill,  setNewSkill]  = useState({ key: '', label: '' })
  const [editSkill, setEditSkill] = useState(null)
  const [sukimaEnabled, setSukimaEnabled] = useState(true) // 会社レベル: スキマバイト機能のon/off
  const [aiConfig,      setAiConfig]      = useState(AI_CONFIG_DEFAULTS)
  // 人件比率の目標帯（min〜max を「範囲内」とみなす）
  const [laborBand,     setLaborBand]     = useState({ min: 22, max: 32 })

  useEffect(() => {
    if (!storeId || !orgId) return
    let cancelled = false
    Promise.all([
      loadSettings(storeId),
      loadSettings(orgId),
    ])
      .then(([storeS, companyS]) => {
        if (cancelled) return
        if (storeS) {
          setConfig(prev => ({
            ...prev,
            openHour:        storeS.openHour        ?? prev.openHour,
            closeHour:       storeS.closeHour       ?? prev.closeHour,
            slotInterval:    storeS.slotInterval    ?? prev.slotInterval,
            avgProductivity: storeS.avgProductivity ?? prev.avgProductivity,
            breakRules:      storeS.breakRules      ?? prev.breakRules,
            specialTasks:    storeS.specialTasks    ?? prev.specialTasks,
          }))
          if (storeS.address) setAddress(storeS.address)
          if (storeS.skillLabels) setSkills(Object.entries(storeS.skillLabels).map(([key, label]) => ({ key, label })))
          if (storeS.aiConfig) {
            setAiConfig({
              mode:    storeS.aiConfig.mode ?? AI_CONFIG_DEFAULTS.mode,
              weights: { ...AI_CONFIG_DEFAULTS.weights, ...(storeS.aiConfig.weights ?? {}) },
            })
          }
        }
        if (typeof companyS?.sukimaEnabled === 'boolean') setSukimaEnabled(companyS.sukimaEnabled)
        // 店舗レベルの laborRatioBand を読み込み（無ければ会社、それも無ければデフォルト）
        const band = storeS?.laborRatioBand ?? companyS?.laborRatioBand
        if (band && Number.isFinite(Number(band.min)) && Number.isFinite(Number(band.max))) {
          setLaborBand({ min: Number(band.min), max: Number(band.max) })
        }
      })
      .catch(e => { if (!cancelled) setErrMsg(e.message || '読み込みに失敗しました') })
    return () => { cancelled = true }
  }, [storeId, orgId])

  const applyAiPreset = (mode) => {
    const preset = AI_CONFIG_PRESETS[mode] ?? AI_CONFIG_DEFAULTS.weights
    setAiConfig({ mode, weights: { ...preset } })
  }
  const updateAiWeight = (key, val) => {
    setAiConfig(prev => ({ ...prev, weights: { ...prev.weights, [key]: Number(val) } }))
  }

  const addSkill = () => {
    if (!newSkill.key.trim() || !newSkill.label.trim()) return
    if (skills.some(s => s.key === newSkill.key.trim())) return
    setSkills(prev => [...prev, { key: newSkill.key.trim().toLowerCase().replace(/\s+/g,'_'), label: newSkill.label.trim() }])
    setNewSkill({ key: '', label: '' })
  }
  const removeSkill = (idx) => setSkills(prev => prev.filter((_, i) => i !== idx))
  const updateSkill = (idx, field, val) => setSkills(prev => prev.map((s, i) => i === idx ? { ...s, [field]: val } : s))

  const handleSave = async () => {
    if (!storeId || !orgId) { setErrMsg('店舗ID/会社IDが取得できません'); return }
    setSaving(true); setErrMsg('')
    const skillLabels = skills.reduce((acc, s) => { acc[s.key] = s.label; return acc }, {})
    const storeSettings = {
      openHour: config.openHour, closeHour: config.closeHour,
      slotInterval: config.slotInterval, avgProductivity: config.avgProductivity,
      breakRules: config.breakRules, specialTasks: config.specialTasks,
      skillLabels, address,
      aiConfig,
      laborRatioBand: { min: Number(laborBand.min), max: Number(laborBand.max) },
    }
    try {
      // 既存設定とマージして他のキー（salesPatterns 等）を保護
      const storeExisting = (await loadSettings(storeId)) || {}
      await saveSettings(storeId, { ...storeExisting, ...storeSettings })
      const companyExisting = (await loadSettings(orgId)) || {}
      await saveSettings(orgId, { ...companyExisting, sukimaEnabled })
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

      {/* 初回店舗作成（店舗が未作成の場合のみ） */}
      {noStore && (
        <div className="mgr-card" style={{
          padding:24, marginBottom:20, border:'2px solid #C7D2FE',
          background:'linear-gradient(135deg, #EEF0FE 0%, #E0F2FE 100%)',
        }}>
          <h2 style={{ fontSize:15, fontWeight:700, color:'#3730A3', margin:'0 0 6px' }}>
            🏪 はじめての店舗を作成しましょう
          </h2>
          <p style={{ fontSize:12, color:'#475569', margin:'0 0 14px', lineHeight:1.6 }}>
            まだ店舗が登録されていません。シフト計画・目標設定・スタッフ管理を始めるには、最初の店舗を作成してください。
          </p>
          <div style={{ display:'flex', gap:8, alignItems:'flex-end', flexWrap:'wrap' }}>
            <div style={{ flex:1, minWidth:240 }}>
              <label className="mgr-label">店舗名</label>
              <input
                type="text"
                value={newStoreName}
                onChange={e => setNewStoreName(e.target.value)}
                placeholder="例: 新宿三丁目店"
                className="mgr-input"
                disabled={creatingStore}
              />
            </div>
            <button
              onClick={createFirstStore}
              disabled={creatingStore || !newStoreName.trim()}
              className="mgr-btn-primary"
            >
              {creatingStore ? '作成中…' : '店舗を作成'}
            </button>
          </div>
          {createErr && (
            <div style={{ marginTop:10, padding:'8px 12px', background:'#FEE2E2', color:'#991B1B', border:'1px solid #FECACA', borderRadius:8, fontSize:12 }}>
              {createErr}
            </div>
          )}
          <div style={{ marginTop:12, fontSize:11, color:'#64748b' }}>
            ※ 作成後は、下の「基本設定」で営業時間・人員配置・特別業務などを調整できます。複数店舗は将来の機能で追加可能になります。
          </div>
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

      {/* ── 人件比率の目標帯（店舗単位） ── */}
      <div className="mgr-card" style={{ padding:24, marginBottom:20 }}>
        <div style={{ marginBottom:14 }}>
          <h2 style={{ fontSize:14, fontWeight:600, color:'#0f172a', margin:0 }}>人件比率の目標帯</h2>
          <p style={{ fontSize:11, color:'#64748b', marginTop:4, marginBottom:0 }}>
            目標計画ページの人件比率ゲージで「範囲内 (緑帯)」と判定する % の上下限を設定します。下限未満は「抑えすぎ」、上限+5% までは「警戒」、それ以上は「超過」と表示。
          </p>
        </div>
        <div style={{ display:'flex', gap:14, alignItems:'flex-end', flexWrap:'wrap' }}>
          <div>
            <label className="mgr-label">下限 (%)</label>
            <input type="number" min={0} max={50} step={0.5}
              value={laborBand.min}
              onChange={e => setLaborBand(b => ({ ...b, min: e.target.value }))}
              className="mgr-input" style={{ width:110 }} />
          </div>
          <div style={{ paddingBottom:10, color:'#94a3b8' }}>〜</div>
          <div>
            <label className="mgr-label">上限 (%)</label>
            <input type="number" min={0} max={50} step={0.5}
              value={laborBand.max}
              onChange={e => setLaborBand(b => ({ ...b, max: e.target.value }))}
              className="mgr-input" style={{ width:110 }} />
          </div>
          <div style={{ paddingBottom:10, fontSize:11, color:'#64748b' }}>
            プリセット:
            {[
              { l:'飲食 (22〜32%)', v:{ min:22, max:32 } },
              { l:'小売 (12〜18%)', v:{ min:12, max:18 } },
              { l:'サービス業 (28〜38%)', v:{ min:28, max:38 } },
            ].map(p => (
              <button key={p.l} type="button" onClick={() => setLaborBand(p.v)}
                style={{ marginLeft:6, padding:'2px 8px', borderRadius:10, fontSize:10,
                         background:'#F1F5F9', color:'#475569', border:'1px solid #E2E8F0',
                         cursor:'pointer', fontFamily:'inherit' }}>
                {p.l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── 機能の有効化 (会社レベル) ── */}
      <div className="mgr-card" style={{ padding:24, marginBottom:20 }}>
        <div style={{ marginBottom:14 }}>
          <h2 style={{ fontSize:14, fontWeight:600, color:'#0f172a', margin:0 }}>機能の有効化（会社単位）</h2>
          <p style={{ fontSize:11, color:'#64748b', marginTop:4, marginBottom:0 }}>会社配下の全店舗・全従業員に適用されます</p>
        </div>
        <label style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 16px', background:'#f8fafc', borderRadius:8, border:'1px solid #e2e8f0', cursor:'pointer' }}>
          <button
            type="button"
            role="switch"
            aria-checked={sukimaEnabled}
            onClick={() => setSukimaEnabled(v => !v)}
            style={{
              flexShrink:0, width:44, height:24, borderRadius:12, border:'none',
              background: sukimaEnabled ? '#4f46e5' : '#cbd5e1', position:'relative',
              cursor:'pointer', transition:'background .15s', padding:0,
            }}
          >
            <span style={{
              position:'absolute', top:2, left: sukimaEnabled ? 22 : 2, width:20, height:20,
              borderRadius:'50%', background:'white', transition:'left .15s',
              boxShadow:'0 1px 3px rgba(0,0,0,0.2)',
            }} />
          </button>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13, fontWeight:600, color:'#0f172a' }}>⚡ スキマバイト機能</div>
            <div style={{ fontSize:11, color:'#64748b', marginTop:2 }}>
              {sukimaEnabled
                ? '従業員アプリに「スキマ」タブが表示されます'
                : '従業員アプリの「スキマ」タブを非表示にします'}
            </div>
          </div>
        </label>
      </div>

      {/* ── AI 自動配置設定 ── */}
      <div className="mgr-card" style={{ padding:24, marginBottom:20 }}>
        <div style={{ marginBottom:16 }}>
          <h2 style={{ fontSize:14, fontWeight:600, color:'#0f172a', margin:0 }}>AI自動配置の最適化設定</h2>
          <p style={{ fontSize:11, color:'#64748b', marginTop:3, marginBottom:0 }}>
            シフト確定作業の「AI配置」で使われるスコアリング要素と重みを設定します。
          </p>
        </div>

        {/* モード選択 */}
        <div style={{ marginBottom:18 }}>
          <label className="mgr-label">最適化モード</label>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {Object.entries(AI_MODE_LABELS).map(([key, label]) => (
              <button key={key}
                type="button"
                onClick={() => applyAiPreset(key)}
                style={{
                  padding:'8px 16px', borderRadius:8, fontSize:12, fontWeight:600,
                  border: aiConfig.mode === key ? '1px solid #4f46e5' : '1px solid #dde5f0',
                  background: aiConfig.mode === key ? '#eef0fe' : 'white',
                  color: aiConfig.mode === key ? '#3730a3' : '#475569',
                  cursor:'pointer', fontFamily:'inherit',
                }}
              >{label}</button>
            ))}
          </div>
          <div style={{ fontSize:11, color:'#94a3b8', marginTop:6 }}>
            プリセットを選ぶと下のスライダーが切り替わります。さらに細かく調整可能です。
          </div>
        </div>

        {/* スコア要素の重み */}
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {Object.entries(AI_WEIGHT_LABELS).map(([key, label]) => (
            <div key={key}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
                <label style={{ fontSize:12, fontWeight:600, color:'#0f172a' }}>{label}</label>
                <span style={{ fontSize:13, fontWeight:700, color:'#3730a3', fontFamily:'system-ui' }}>
                  {aiConfig.weights[key] ?? 0}
                </span>
              </div>
              <input type="range" min={0} max={30} step={1}
                value={aiConfig.weights[key] ?? 0}
                onChange={(e) => updateAiWeight(key, e.target.value)}
                style={{ width:'100%' }}
              />
              <div style={{ fontSize:10, color:'#94a3b8', marginTop:2 }}>{AI_WEIGHT_HINTS[key]}</div>
            </div>
          ))}
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
