import { useState } from 'react'
import { staff as initialStaff, shiftData, daysConfig, skillLabels, YEAR_MONTH, staffConstraints as initialConstraints } from '../../data/mockData'

// ── helpers ──────────────────────────────────────────────────────────────────
function parseShiftTimes(code) {
  if (!code || code === 'X') return null
  if (code === 'F') return { start: 9, end: 18 }
  const m = code.match(/^O-(\d+(?:\.\d+)?)$/)
  if (m) return { start: 9, end: parseFloat(m[1]) }
  const m2 = code.match(/^(\d+(?:\.\d+)?)[.-](\d+(?:\.\d+)?|L)$/)
  if (m2) return { start: parseFloat(m2[1]), end: m2[2] === 'L' ? 22 : parseFloat(m2[2]) }
  return null
}

function getBarProps(code) {
  if (!code || code === 'X') return null
  if (code === 'F') return { type: 'full', left: 2, width: 96 }
  const t = parseShiftTimes(code)
  if (!t) return null
  const left  = Math.max(2, ((t.start - 7) / 16) * 100)
  const width = Math.max(6, ((t.end - t.start) / 16) * 100)
  return { type: t.end >= 22 ? 'closer' : 'normal', left, width }
}

// Retention priority badge inline styles
function retentionStyle(p) {
  if (p <= 2) return { background: '#fee2e2', color: '#991b1b' }
  if (p <= 4) return { background: '#fef3c7', color: '#92400e' }
  if (p <= 6) return { background: '#fefce8', color: '#713f12' }
  return { background: 'var(--pita-bg-subtle)', color: 'var(--pita-muted)' }
}

// ── Tailwind-based retention class kept only for the modal slider badge ──────
const retentionCls = (p) => {
  if (p <= 2) return 'bg-red-100 text-red-700 border border-red-300'
  if (p <= 4) return 'bg-orange-100 text-orange-700 border border-orange-300'
  if (p <= 6) return 'bg-yellow-50 text-yellow-700 border border-yellow-300'
  return 'bg-gray-100 text-gray-500 border border-gray-200'
}

const BLANK_MEMBER     = { id: null, name: '', type: 'P', role: 'スタッフ', skills: [], hourlyOrders: 7, wage: 1050, transitPerDay: 0 }
const BLANK_CONSTRAINT = { incompatible: [], targetEarnings: 0, retentionPriority: 5 }

const MODAL_TABS = ['基本情報', 'マネージャー設定']

export default function Members() {
  const [members,         setMembers]         = useState(initialStaff)
  const [constraints,     setConstraints]     = useState(initialConstraints)
  const [showModal,       setShowModal]       = useState(false)
  const [activeTab,       setActiveTab]       = useState(0)
  const [form,            setForm]            = useState(BLANK_MEMBER)
  const [constraintForm,  setConstraintForm]  = useState(BLANK_CONSTRAINT)
  const [search,          setSearch]          = useState('')
  const [filterSkill,     setFilterSkill]     = useState('')
  const [addIncompat,     setAddIncompat]     = useState(null)
  const [addSeverity,     setAddSeverity]     = useState(3)

  const filtered = members.filter(m =>
    m.name.includes(search) && (filterSkill ? m.skills.includes(filterSkill) : true)
  )

  const openEdit = (m) => {
    setForm(m)
    setConstraintForm(constraints[m.id] || BLANK_CONSTRAINT)
    setActiveTab(0)
    setShowModal(true)
  }
  const openNew = () => {
    setForm(BLANK_MEMBER)
    setConstraintForm(BLANK_CONSTRAINT)
    setActiveTab(0)
    setShowModal(true)
  }

  const handleSave = () => {
    if (!form.name.trim()) return
    const id = form.id || (members.length + 100)
    const saved = { ...form, id }
    if (form.id) setMembers(prev => prev.map(m => m.id === form.id ? saved : m))
    else         setMembers(prev => [...prev, saved])
    setConstraints(prev => ({ ...prev, [id]: constraintForm }))
    setShowModal(false)
  }

  const toggleSkill = (skill) => {
    setForm(prev => ({
      ...prev,
      skills: prev.skills.includes(skill) ? prev.skills.filter(s => s !== skill) : [...prev.skills, skill],
    }))
  }

  const removeIncompat = (staffId) =>
    setConstraintForm(prev => ({ ...prev, incompatible: prev.incompatible.filter(i => i.staffId !== staffId) }))

  const addIncompatPair = () => {
    if (!addIncompat || constraintForm.incompatible.some(i => i.staffId === addIncompat)) return
    setConstraintForm(prev => ({ ...prev, incompatible: [...prev.incompatible, { staffId: addIncompat, severity: addSeverity }] }))
    setAddIncompat(null); setAddSeverity(3)
  }

  const compatOptions = members.filter(m => m.id !== form.id && !constraintForm.incompatible.some(i => i.staffId === m.id))

  return (
    <div className="mgr-page">

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>{YEAR_MONTH} 前半</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.01em' }}>メンバー管理</div>
        </div>
        <button onClick={openNew} className="mgr-btn-primary">
          + スタッフを追加
        </button>
      </div>

      {/* Search + filter controls */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="名前で検索..."
          className="mgr-input"
          style={{ width: 200 }}
        />
        <select
          value={filterSkill}
          onChange={e => setFilterSkill(e.target.value)}
          className="mgr-input"
          style={{ width: 'auto' }}
        >
          <option value="">全スキル</option>
          {Object.entries(skillLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <div style={{ marginLeft: 'auto', fontSize: 12, color: '#64748b' }}>
          {filtered.length}名 / {members.length}名
        </div>
      </div>

      {/* Retention priority legend */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 12, fontSize: 10, color: 'var(--pita-muted)', flexWrap: 'wrap', alignItems: 'center' }}>
        <span>残留優先度:</span>
        {[
          { label: '1〜2 最優先', style: retentionStyle(1) },
          { label: '3〜4 高',     style: retentionStyle(3) },
          { label: '5〜6 中',     style: retentionStyle(5) },
          { label: '7〜10 低',    style: retentionStyle(7) },
        ].map((item, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', display: 'inline-block', ...item.style }} />
            {item.label}
          </span>
        ))}
        <span style={{ marginLeft: 8, color: 'var(--pita-faint)' }}>※ AI配置の優先順位に影響します</span>
      </div>

      {/* Staff table */}
      <div className="mgr-card" style={{ marginBottom: 24 }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="pita-mgr-grid">
            <thead>
              <tr>
                <th className="name-col">スタッフ名</th>
                <th className="meta-col">種別</th>
                <th style={{ textAlign: 'left', background: '#e2e8f0', fontSize: 12.5, color: '#1e293b', fontWeight: 700, padding: '8px 12px' }}>スキル</th>
                <th className="meta-col">時給</th>
                <th className="meta-col">交通費/日</th>
                <th className="meta-col">優先</th>
                {daysConfig.map(d => (
                  <th
                    key={d.day}
                    className={d.dow === '土' ? 'pita-dow-sat' : d.dow === '日' ? 'pita-dow-sun' : ''}
                    style={{ minWidth: 52 }}
                  >
                    {d.day}<br />{d.dow}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(m => {
                const row = shiftData[m.id] || []
                const c   = constraints[m.id] || BLANK_CONSTRAINT
                const pStyle = retentionStyle(c.retentionPriority)
                return (
                  <tr key={m.id}>
                    {/* Name col */}
                    <td className="name-col">
                      <span
                        onClick={() => openEdit(m)}
                        style={{ cursor: 'pointer', color: 'var(--pita-text)', fontWeight: 500 }}
                      >
                        {m.name}
                      </span>
                      {m.role !== 'スタッフ' && (
                        <span style={{
                          marginLeft: 6,
                          fontSize: 9,
                          padding: '1px 4px',
                          borderRadius: 3,
                          background: 'var(--pita-accent-soft)',
                          color: 'var(--pita-accent-text)',
                        }}>
                          {m.role}
                        </span>
                      )}
                    </td>

                    {/* Type */}
                    <td className="meta-col">
                      <span style={{
                        fontSize: 10,
                        padding: '1px 5px',
                        borderRadius: 3,
                        fontWeight: 600,
                        background: m.type === 'F' ? '#d1fae5' : 'var(--pita-bg-subtle)',
                        color:      m.type === 'F' ? '#065f46' : 'var(--pita-muted)',
                      }}>
                        {m.type}
                      </span>
                    </td>

                    {/* Skills */}
                    <td style={{ background: 'var(--pita-panel)', padding: '3px 5px', textAlign: 'left', whiteSpace: 'nowrap' }}>
                      {m.skills.map(sk => (
                        <span key={sk} className={sk === 'barista' ? 'pita-skill-barista' : sk === 'cashier' ? 'pita-skill-cashier' : 'pita-skill-floor'} style={{ marginRight: 3 }}>
                          {skillLabels[sk] || sk}
                        </span>
                      ))}
                    </td>

                    {/* Wage */}
                    <td className="meta-col">
                      ¥{m.wage.toLocaleString()}
                    </td>

                    {/* Transit per day */}
                    <td className="meta-col">
                      ¥{(m.transitPerDay ?? 0).toLocaleString()}
                    </td>

                    {/* Retention priority */}
                    <td className="meta-col">
                      <span style={{
                        display: 'inline-block',
                        fontSize: 9,
                        padding: '1px 5px',
                        borderRadius: 3,
                        fontWeight: 700,
                        ...pStyle,
                      }}>
                        P{c.retentionPriority}
                      </span>
                    </td>

                    {/* Day columns */}
                    {daysConfig.map((d, di) => {
                      const code = row[di] || 'X'
                      const bar  = getBarProps(code)
                      if (!bar) {
                        return <td key={d.day} className="pita-cell-off-bar">×</td>
                      }
                      return (
                        <td key={d.day} className="pita-cell-bar">
                          <div
                            className={'pita-bar ' + bar.type}
                            style={{ left: bar.left + '%', width: bar.width + '%' }}
                          />
                          <span className="pita-code">{code}</span>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modal ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl my-4">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="font-bold text-lg text-gray-900">{form.id ? 'メンバー編集' : '新規メンバー追加'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 px-6">
              {MODAL_TABS.map((tab, i) => (
                <button key={tab} onClick={() => setActiveTab(i)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors mr-2 ${
                    activeTab === i ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}>
                  {i === 1 ? (
                    <span className="flex items-center gap-1.5">
                      {tab}
                      <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full">非公開</span>
                    </span>
                  ) : tab}
                </button>
              ))}
            </div>

            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">

              {/* ── Tab 0: 基本情報 ── */}
              {activeTab === 0 && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">名前 *</label>
                    <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" placeholder="例：田中 太郎" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">雇用形態</label>
                      <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400">
                        <option value="F">正社員 (F)</option>
                        <option value="P">パート/アルバイト (P)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">役職</label>
                      <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400">
                        {['マネージャー','サブマネージャー','バリスタ','スタッフ'].map(r => <option key={r}>{r}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-2">スキル</label>
                    <div className="flex gap-3 flex-wrap">
                      {Object.entries(skillLabels).map(([k, v]) => (
                        <label key={k} className={`flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer transition-colors ${form.skills.includes(k) ? 'bg-blue-50 border-blue-400' : 'border-gray-200 hover:border-blue-200'}`}>
                          <input type="checkbox" checked={form.skills.includes(k)} onChange={() => toggleSkill(k)} className="accent-blue-600" />
                          <span className="text-sm">{v}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">時間生産性（件/時間）</label>
                      <input type="number" value={form.hourlyOrders} onChange={e => setForm(p => ({ ...p, hourlyOrders: Number(e.target.value) }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">時給（円）</label>
                      <input type="number" value={form.wage} onChange={e => setForm(p => ({ ...p, wage: Number(e.target.value) }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">交通費（円/日）</label>
                      <input type="number" value={form.transitPerDay ?? 0} onChange={e => setForm(p => ({ ...p, transitPerDay: Number(e.target.value) }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
                    </div>
                  </div>
                </>
              )}

              {/* ── Tab 1: マネージャー設定 ── */}
              {activeTab === 1 && (
                <>
                  <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 flex items-start gap-3">
                    <span className="text-orange-500 text-lg mt-0.5">🔒</span>
                    <div className="text-xs text-orange-700">
                      <div className="font-semibold mb-0.5">マネージャー専用情報</div>
                      この設定は従業員には表示されません。AI自動配置の計算に使用されます。
                    </div>
                  </div>

                  {/* Retention priority */}
                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <label className="block text-sm font-semibold text-gray-800">残留優先度</label>
                        <div className="text-xs text-gray-500 mt-0.5">1=最優先 / 10=低優先。AI配置での優先順位に影響</div>
                      </div>
                      <span className={`text-lg font-bold px-3 py-1 rounded-full ${retentionCls(constraintForm.retentionPriority)}`}>
                        P{constraintForm.retentionPriority}
                      </span>
                    </div>
                    <input type="range" min={1} max={10} value={constraintForm.retentionPriority}
                      onChange={e => setConstraintForm(p => ({ ...p, retentionPriority: Number(e.target.value) }))}
                      className="w-full accent-blue-600" />
                    <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                      <span>1 最優先（退職リスク）</span>
                      <span>10 低優先</span>
                    </div>
                  </div>

                  {/* Target earnings */}
                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <label className="block text-sm font-semibold text-gray-800 mb-1">目標月収（円）</label>
                    <div className="text-xs text-gray-500 mb-3">AI配置でこの金額に近づくよう稼働時間を調整します</div>
                    <input type="number" value={constraintForm.targetEarnings}
                      onChange={e => setConstraintForm(p => ({ ...p, targetEarnings: Number(e.target.value) }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" placeholder="例: 80000" />
                    {constraintForm.targetEarnings > 0 && (
                      <div className="mt-2 text-xs text-blue-600 font-medium">
                        月収目標: ¥{constraintForm.targetEarnings.toLocaleString()}
                      </div>
                    )}
                  </div>

                  {/* Incompatible pairs */}
                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <label className="block text-sm font-semibold text-gray-800 mb-1">相性の悪いスタッフ</label>
                    <div className="text-xs text-gray-500 mb-3">
                      設定したスタッフとは同時間帯に配置しないよう AI が考慮します。Lv が高いほど重大。
                    </div>

                    {constraintForm.incompatible.length > 0 ? (
                      <div className="flex flex-wrap gap-2 mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                        {constraintForm.incompatible.map(({ staffId, severity }) => {
                          const s = members.find(m => m.id === staffId)
                          return s ? (
                            <div key={staffId} className="flex items-center gap-1.5 bg-white border border-red-300 text-red-700 text-xs rounded-full px-2.5 py-1.5 shadow-sm">
                              <span className="font-medium">{s.name}</span>
                              <span className={`rounded-full px-1.5 py-0.5 font-bold text-[10px] ${
                                severity >= 4 ? 'bg-red-600 text-white' : severity >= 2 ? 'bg-red-300 text-red-900' : 'bg-red-100 text-red-700'
                              }`}>Lv{severity}</span>
                              <button onClick={() => removeIncompat(staffId)} className="hover:text-red-900 font-bold ml-0.5">×</button>
                            </div>
                          ) : null
                        })}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-400 bg-gray-50 rounded-lg p-3 mb-3 text-center">設定なし</div>
                    )}

                    <div className="flex gap-2">
                      <select value={addIncompat || ''} onChange={e => setAddIncompat(Number(e.target.value) || null)}
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-red-400">
                        <option value="">スタッフを選択...</option>
                        {compatOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                      <select value={addSeverity} onChange={e => setAddSeverity(Number(e.target.value))}
                        className="w-24 border border-gray-300 rounded-lg px-2 py-2 text-sm outline-none focus:border-red-400">
                        {[1,2,3,4,5].map(v => <option key={v} value={v}>Lv{v} {v >= 4 ? '⚠' : ''}</option>)}
                      </select>
                      <button onClick={addIncompatPair} disabled={!addIncompat}
                        className="px-3 py-2 bg-red-100 text-red-700 text-sm font-medium rounded-lg hover:bg-red-200 disabled:opacity-40">
                        追加
                      </button>
                    </div>
                    <div className="text-[10px] text-gray-400 mt-2">Lv1=軽微 / Lv5=重大な対立</div>
                  </div>
                </>
              )}
            </div>

            <div className="px-6 py-4 border-t flex gap-3 justify-between">
              <div className="text-xs text-gray-400 self-center">* 必須項目</div>
              <div className="flex gap-3">
                <button onClick={() => setShowModal(false)} className="mgr-btn-secondary">キャンセル</button>
                <button onClick={handleSave} className="mgr-btn-primary">保存する</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
