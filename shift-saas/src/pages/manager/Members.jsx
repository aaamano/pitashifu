import { useState, useRef, useEffect } from 'react'
import { staff as initialStaff, shiftData, daysConfig, skillLabels, YEAR_MONTH, staffConstraints as initialConstraints } from '../../data/mockData'
import { useOrg } from '../../context/OrgContext'
import * as employeesApi from '../../api/employees'
import * as incompatApi from '../../api/incompatibilities'
import * as invitationsApi from '../../api/invitations'
import { readWorkbookFromFile, extractStaffList } from '../../utils/excelImport.js'

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

const PREFECTURES = [
  '北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県',
  '茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県',
  '新潟県','富山県','石川県','福井県','山梨県','長野県','岐阜県','静岡県','愛知県','三重県',
  '滋賀県','京都府','大阪府','兵庫県','奈良県','和歌山県',
  '鳥取県','島根県','岡山県','広島県','山口県',
  '徳島県','香川県','愛媛県','高知県',
  '福岡県','佐賀県','長崎県','熊本県','大分県','宮崎県','鹿児島県','沖縄県',
]

const DOW_KEYS = [
  { k:'mon', l:'月' },
  { k:'tue', l:'火' },
  { k:'wed', l:'水' },
  { k:'thu', l:'木' },
  { k:'fri', l:'金' },
  { k:'sat', l:'土' },
  { k:'sun', l:'日' },
]

const HOUR_TIMES = (() => {
  const arr = []
  for (let h = 9; h <= 23; h++) {
    arr.push(`${h}:00`)
    if (h < 23) arr.push(`${h}:30`)
  }
  return arr
})()

const blankFixedShift = () => DOW_KEYS.reduce((o, { k }) => {
  o[k] = { enabled: false, start: '13:00', end: '18:00' }
  return o
}, {})

const BLANK_MEMBER = {
  id: null, name: '', type: 'P', role: 'スタッフ', skills: [], hourlyOrders: 7, wage: 1050, transitPerDay: 0,
  // 氏名・表示
  lastName: '', firstName: '', lastNameKana: '', firstNameKana: '', displayName: '', shiftMemo: '',
  group: '',
  // 固定シフト
  fixedShift: blankFixedShift(),
  // 連携・属性
  linked: false,
  gender: '',
  // 連絡先・住所
  phone: '', email: '', postalCode: '', prefecture: '', city: '', streetAddress: '', buildingName: '',
  // 管理
  staffCode: '', memo: '',
}
const BLANK_CONSTRAINT = { incompatible: [], targetEarnings: 0, retentionPriority: 5 }

const MODAL_TABS = ['基本情報', '連絡先・住所', '固定シフト', 'マネージャー設定']

export default function Members() {
  const { orgId, stores } = useOrg()
  // mockData フラッシュ防止: 初期stateは空、ロード完了まで読み込み中表示
  const [members,         setMembers]         = useState([])
  const [constraints,     setConstraints]     = useState({})
  const [loading,         setLoading]         = useState(true)
  const [errMsg,          setErrMsg]          = useState('')

  // 招待モーダル state
  const [showInviteModal,  setShowInviteModal]  = useState(false)
  const [invitations,      setInvitations]      = useState([])
  const [inviteForm,       setInviteForm]       = useState({
    role: 'staff', email: '', nameHint: '', storeIds: [], expiresInDays: 14,
  })
  const [inviteMsg,        setInviteMsg]        = useState('')
  const [creatingInvite,   setCreatingInvite]   = useState(false)
  const [createdInvite,    setCreatedInvite]    = useState(null) // 作成直後の URL を表示
  const [copyOk,           setCopyOk]           = useState(false)

  useEffect(() => {
    if (!orgId) return
    let cancelled = false
    setLoading(true)
    Promise.all([
      employeesApi.listEmployees(orgId),
      incompatApi.listIncompatibilities(orgId),
    ])
      .then(([emps, incompats]) => {
        if (cancelled) return
        setMembers(emps ?? [])
        // incompatibilities → constraints マップ
        const cmap = {}
        for (const it of incompats ?? []) {
          if (!cmap[it.employeeId]) cmap[it.employeeId] = { incompatible: [], targetEarnings: 0, retentionPriority: 5 }
          cmap[it.employeeId].incompatible.push({ staffId: it.incompatibleWith, severity: it.severity })
        }
        // employees の retention/target を反映
        for (const e of emps ?? []) {
          if (!cmap[e.id]) cmap[e.id] = { incompatible: [], targetEarnings: e.targetEarnings ?? 0, retentionPriority: e.retentionPriority ?? 5 }
          else {
            cmap[e.id].targetEarnings    = e.targetEarnings    ?? 0
            cmap[e.id].retentionPriority = e.retentionPriority ?? 5
          }
        }
        setConstraints(cmap)
      })
      .catch(e => { if (!cancelled) setErrMsg(e.message || '読み込みに失敗しました') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [orgId])
  const [showModal,       setShowModal]       = useState(false)
  const [activeTab,       setActiveTab]       = useState(0)
  const [form,            setForm]            = useState(BLANK_MEMBER)
  const [constraintForm,  setConstraintForm]  = useState(BLANK_CONSTRAINT)
  const [search,          setSearch]          = useState('')
  const [filterSkill,     setFilterSkill]     = useState('')
  const [addIncompat,     setAddIncompat]     = useState(null)
  const [addSeverity,     setAddSeverity]     = useState(3)

  const [showCsvModal,   setShowCsvModal]   = useState(false)
  const [pendingCsvFile, setPendingCsvFile] = useState(null)
  const [csvMsg,         setCsvMsg]         = useState('')
  const fileInputRef = useRef(null)
  // Airレジ等の他フォーマット
  const [pendingAltCsvFile, setPendingAltCsvFile] = useState(null)
  const [altCsvFormat,      setAltCsvFormat]      = useState('airreji')
  const altFileInputRef = useRef(null)

  const MEMBER_CSV_HEADER = ['スタッフ名','雇用形態','役職','スキル(;区切り)','時給(円)','交通費/日(円)','残留優先度']

  // 簡易CSVパーサ（クォート対応）
  const parseCsvLine = (line) => {
    const out = []
    let cur = '', inQ = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '"') { if (inQ && line[i+1] === '"') { cur += '"'; i++ } else { inQ = !inQ } }
      else if (c === ',' && !inQ) { out.push(cur); cur = '' }
      else cur += c
    }
    out.push(cur)
    return out.map(s => s.trim())
  }

  const downloadMemberCsv = () => {
    const labelToKey = Object.fromEntries(Object.entries(skillLabels).map(([k, v]) => [v, k]))
    const skillKey = Object.fromEntries(Object.entries(skillLabels))
    const headerExtra = daysConfig.map(d => `${d.day}日(${d.dow})`)
    const header = [...MEMBER_CSV_HEADER, ...headerExtra].join(',')
    const rows = members.map(m => {
      const c = constraints[m.id] || BLANK_CONSTRAINT
      const skillStr = m.skills.map(sk => skillLabels[sk] || sk).join(';')
      const shiftCols = daysConfig.map((_, i) => shiftData[m.id]?.[i] || 'X')
      return [m.name, m.type, m.role, skillStr, m.wage, m.transitPerDay ?? 0, c.retentionPriority, ...shiftCols].join(',')
    })
    const csv = [header, ...rows].join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'members_format.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  // .xlsx → ﾃﾞｰﾀ入力シートから NO. を id として突合してメンバーを更新する
  // (CSV はスタッフ名で突合する一方、Excel の名前列は「K.M」のような短縮形のため
  //  NO. = id でマッチさせるほうが安全)
  const executeMemberExcelUpload = async () => {
    if (!pendingCsvFile) return
    try {
      const wb = await readWorkbookFromFile(pendingCsvFile)
      const { staff: excelStaff } = extractStaffList(wb)
      if (!excelStaff.length) { setCsvMsg('Excel からスタッフを読み取れませんでした。'); setShowCsvModal(false); return }
      const items = excelStaff.map(({ name, wage, transit }) => ({
        name,
        type: 'P', role: 'スタッフ', skills: [], hourlyOrders: 7,
        wage: wage ?? 1050,
        transitPerDay: transit ?? 0,
      }))
      // DBに反映
      if (orgId) {
        try {
          const { inserted, updated } = await employeesApi.bulkUpsertByName({ orgId, items })
          const fresh = await employeesApi.listEmployees(orgId)
          setMembers(fresh)
          setCsvMsg(`✓ Excel取込: 更新${updated}名 / 新規${inserted}名`)
        } catch (e) {
          setErrMsg(e.message || 'DB保存に失敗しました')
          setCsvMsg('')
        }
      } else {
        setErrMsg('orgIdが取得できないためDBに反映できません')
      }
      setTimeout(() => setCsvMsg(''), 4000)
    } catch (e) {
      console.error('[ExcelUpload]', e)
      setCsvMsg('Excel の読み込みに失敗しました。')
    }
    setShowCsvModal(false)
    setPendingCsvFile(null)
  }

  // CSV / Excel をファイル拡張子で振り分けて実行
  const executeMemberUpload = () => {
    if (!pendingCsvFile) return
    const ext = (pendingCsvFile.name.split('.').pop() || '').toLowerCase()
    if (ext === 'xlsx' || ext === 'xls') return executeMemberExcelUpload()
    return executeMemberCsvUpload()
  }

  const executeMemberCsvUpload = () => {
    if (!pendingCsvFile) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const labelToKey = Object.fromEntries(Object.entries(skillLabels).map(([k, v]) => [v, k]))
        const lines = ev.target.result.replace(/^﻿/, '').trim().split('\n').slice(1)
        const items = []
        lines.forEach(line => {
          const p = line.split(',').map(s => s.trim())
          if (p.length < 5) return
          const [name, type, role, skillsRaw, wageStr, transitStr, priorityStr] = p
          if (!name) return
          const skills = skillsRaw ? skillsRaw.split(';').map(s => labelToKey[s.trim()]).filter(Boolean) : []
          items.push({
            name,
            type: type || 'P',
            role: role || 'staff',
            skills,
            wage:               parseInt(wageStr)     || 1050,
            transitPerDay:      parseInt(transitStr)  || 0,
            retentionPriority:  Math.min(10, Math.max(1, parseInt(priorityStr) || 5)),
            hourlyOrders:       7,
          })
        })
        if (!items.length) { setCsvMsg('CSVから有効なスタッフを読み取れませんでした。'); setShowCsvModal(false); return }
        if (!orgId) { setErrMsg('orgIdが取得できません'); setShowCsvModal(false); return }
        const { inserted, updated } = await employeesApi.bulkUpsertByName({ orgId, items })
        const fresh = await employeesApi.listEmployees(orgId)
        setMembers(fresh)
        setCsvMsg(`✓ 更新${updated}名 / 新規${inserted}名`)
        setTimeout(() => setCsvMsg(''), 3000)
      } catch (e) {
        console.error('[CSVUpload]', e)
        setCsvMsg('CSVの読み込みに失敗しました。')
        setErrMsg(e.message || 'CSV取込に失敗しました')
      }
    }
    reader.readAsText(pendingCsvFile, 'UTF-8')
    setShowCsvModal(false)
    setPendingCsvFile(null)
  }

  // Airレジ「スタッフ管理」CSV → 内部形式に変換してインポート
  const executeAirrejiMemberUpload = () => {
    if (!pendingAltCsvFile) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const text = ev.target.result.replace(/^﻿/, '').trim()
        const lines = text.split(/\r?\n/).filter(l => l.trim())
        if (lines.length < 2) { setCsvMsg('CSVが空です。'); setShowCsvModal(false); return }
        const dataLines = lines.slice(1)
        const next = [...members]
        let added = 0, updated = 0, skipped = 0
        dataLines.forEach(line => {
          const cols = parseCsvLine(line)
          if (cols.length < 25) return
          // No=0, 姓=1, 名=2, 姓ｶﾅ=3, 名ｶﾅ=4, ﾆｯｸ=5, 性別=6, 〒=7, 都道府=8, 市以降=9,
          // 電話=10, mail=11, ｸﾞﾙｰﾌﾟ=12, 月-日=13-19, 連携=20, ｽﾃｰﾀｽ=21, 登録=22, 退職=23,
          // 時給=24, 交通=25, ｺｰﾄﾞ=26, ﾒﾓ=27, ｼﾌﾄ表補足=28
          const lastName  = cols[1]
          const firstName = cols[2]
          if (!lastName && !firstName) return
          if (cols[23] && cols[23].trim()) { skipped++; return } // 退職日時あり
          const fullName = `${lastName} ${firstName}`.replace(/\s+/g, ' ').trim()
          // 固定シフト: "9:00-18:00" 形式
          const fixedShift = blankFixedShift()
          DOW_KEYS.forEach((d, i) => {
            const range = (cols[13 + i] || '').replace(/[\s　]/g, '')
            const m = range.match(/^(\d{1,2}:\d{2})[〜~\-－—]+(\d{1,2}:\d{2})$/)
            if (m) fixedShift[d.k] = { enabled: true, start: m[1], end: m[2] }
          })
          const obj = {
            ...BLANK_MEMBER,
            lastName, firstName, name: fullName,
            lastNameKana:  cols[3] || '',
            firstNameKana: cols[4] || '',
            displayName:   cols[5] || '',
            gender:        cols[6] || '',
            postalCode:    (cols[7] || '').replace(/-/g, ''),
            prefecture:    cols[8] || '',
            city:          cols[9] || '',
            phone:         (cols[10] || '').replace(/-/g, ''),
            email:         cols[11] || '',
            group:         cols[12] || '',
            fixedShift,
            linked:        cols[20] === '済',
            wage:          parseInt(cols[24]) || 1050,
            transitPerDay: parseInt(cols[25]) || 0,
            staffCode:     cols[26] || '',
            memo:          cols[27] || '',
            shiftMemo:     cols[28] || '',
            type: 'P', role: 'スタッフ', skills: [], hourlyOrders: 7,
          }
          const idx = next.findIndex(m => m.name === fullName)
          if (idx >= 0) {
            next[idx] = { ...next[idx], ...obj, id: next[idx].id }
            updated++
          } else {
            obj.id = (next.reduce((mx, m) => Math.max(mx, m.id || 0), 0) || 100) + 1
            next.push(obj)
            added++
          }
        })
        if (added + updated === 0) {
          setCsvMsg(skipped > 0 ? `すべて退職済 (${skipped}件) のためスキップしました` : 'Airレジ形式から有効な行が見つかりませんでした')
          setShowCsvModal(false); return
        }
        setMembers(next)
        // DBへも反映（新規/更新分）
        if (orgId) {
          try {
            const items = next.filter(m => !m.id || typeof m.id !== 'string').map(m => ({ ...m }))
            // 全件 upsert（過剰なら最適化）
            const { inserted, updated: dbUpdated } = await employeesApi.bulkUpsertByName({ orgId, items: next })
            const fresh = await employeesApi.listEmployees(orgId)
            setMembers(fresh)
            const msg = `✓ Airレジ取込: 更新${dbUpdated}名 / 新規${inserted}名` + (skipped ? ` / 退職スキップ${skipped}件` : '')
            setCsvMsg(msg)
          } catch (e) {
            console.error('[AirrejiUpload]', e)
            setErrMsg(e.message || 'DB保存に失敗しました')
            setCsvMsg('')
          }
        } else {
          const msg = `✓ Airレジ取込: 新規${added}名 / 更新${updated}名` + (skipped ? ` / 退職スキップ${skipped}件` : '')
          setCsvMsg(msg)
        }
        setTimeout(() => setCsvMsg(''), 4000)
      } catch (err) {
        console.error('[AirrejiUpload]', err)
        setCsvMsg('Airレジ CSV の読み込みに失敗しました')
      }
    }
    reader.readAsText(pendingAltCsvFile, 'UTF-8')
    setShowCsvModal(false)
    setPendingAltCsvFile(null)
  }

  const filtered = members.filter(m =>
    m.name.includes(search) && (filterSkill ? m.skills.includes(filterSkill) : true)
  )

  const openEdit = (m) => {
    const parts = (m.name || '').split(/\s+/).filter(Boolean)
    setForm({
      ...BLANK_MEMBER,
      ...m,
      lastName:  m.lastName  ?? parts[0] ?? '',
      firstName: m.firstName ?? parts[1] ?? '',
      fixedShift: m.fixedShift || blankFixedShift(),
    })
    setConstraintForm(constraints[m.id] || BLANK_CONSTRAINT)
    setActiveTab(0)
    setShowModal(true)
  }
  const openNew = () => {
    setForm({ ...BLANK_MEMBER, fixedShift: blankFixedShift() })
    setConstraintForm(BLANK_CONSTRAINT)
    setActiveTab(0)
    setShowModal(true)
  }

  // ── 招待モーダル ──
  const openInviteModal = async () => {
    setShowInviteModal(true)
    setCreatedInvite(null); setInviteMsg(''); setCopyOk(false)
    setInviteForm({
      role: 'staff', email: '', nameHint: '',
      storeIds: stores?.map(s => s.id) ?? [],
      expiresInDays: 14,
    })
    if (orgId) {
      try {
        const list = await invitationsApi.listInvitations(orgId)
        setInvitations(list)
      } catch (e) { console.error('[Members.listInvitations]', e) }
    }
  }
  const createInvite = async () => {
    if (!orgId) { setInviteMsg('orgId未取得'); return }
    setCreatingInvite(true); setInviteMsg('')
    try {
      const created = await invitationsApi.createInvitation({
        orgId,
        role:          inviteForm.role,
        storeIds:      inviteForm.storeIds,
        email:         inviteForm.email.trim() || null,
        nameHint:      inviteForm.nameHint.trim() || null,
        expiresInDays: Number(inviteForm.expiresInDays) || 14,
      })
      setCreatedInvite(created)
      setInvitations(prev => [created, ...prev])
    } catch (e) {
      setInviteMsg(e.message || '作成に失敗しました')
    } finally {
      setCreatingInvite(false)
    }
  }
  const copyInviteUrl = async (url) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopyOk(true); setTimeout(() => setCopyOk(false), 1800)
    } catch { setInviteMsg('クリップボードへのコピーに失敗') }
  }
  const revokeInvite = async (id) => {
    try {
      await invitationsApi.revokeInvitation(id)
      setInvitations(prev => prev.map(i => i.id === id ? { ...i, revoked_at: new Date().toISOString() } : i))
    } catch (e) { setInviteMsg(e.message || '取消に失敗') }
  }

  const handleSave = async () => {
    const composedName = (form.lastName || form.firstName)
      ? `${form.lastName || ''}${form.lastName && form.firstName ? ' ' : ''}${form.firstName || ''}`.trim()
      : form.name
    if (!composedName.trim()) return
    const ui = {
      ...form,
      name: composedName,
      retentionPriority: constraintForm.retentionPriority,
      targetEarnings:    constraintForm.targetEarnings,
    }
    let saved
    try {
      if (form.id) {
        saved = await employeesApi.updateEmployee(form.id, ui)
        setMembers(prev => prev.map(m => m.id === form.id ? { ...m, ...saved } : m))
      } else {
        if (!orgId) throw new Error('orgId未取得')
        saved = await employeesApi.createEmployee({ orgId, ui })
        setMembers(prev => [...prev, saved])
      }
      // 相性NGも完全置換で保存
      try {
        await incompatApi.setIncompatibilities(
          saved.id,
          (constraintForm.incompatible || []).map(i => ({
            incompatibleWith: i.staffId,
            severity:         i.severity,
          })),
        )
      } catch (e) {
        console.error('[Members.handleSave.incompat]', e)
        setErrMsg('相性NGの保存に失敗: ' + (e.message || ''))
      }
      setConstraints(prev => ({ ...prev, [saved.id]: constraintForm }))
    } catch (e) {
      setErrMsg(e.message || '保存に失敗しました')
      return
    }
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
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap:'wrap', gap:10 }}>
        <div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>{YEAR_MONTH} 前半</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.01em' }}>スタッフ管理</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          {csvMsg && <span style={{ fontSize:12, color: csvMsg.startsWith('✓') ? '#10b981' : '#ef4444' }}>{csvMsg}</span>}
          <button onClick={() => setShowCsvModal(true)} className="mgr-btn-secondary">CSV / Excel アップロード</button>
          <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
            onChange={e => { setPendingCsvFile(e.target.files?.[0] || null); e.target.value = '' }} />
          <button onClick={openInviteModal} className="mgr-btn-secondary">招待 URL を発行</button>
          <button onClick={openNew} className="mgr-btn-primary">+ スタッフを追加</button>
        </div>
      </div>

      {errMsg && (
        <div style={{ marginBottom:14, padding:'10px 14px', background:'#FEE2E2', color:'#991B1B', border:'1px solid #FECACA', borderRadius:8, fontSize:13 }}>
          {errMsg}
        </div>
      )}

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
                <th className="meta-col">役職</th>
                <th style={{ textAlign: 'left', background: '#e2e8f0', fontSize: 12.5, color: '#1e293b', fontWeight: 700, padding: '8px 12px' }}>スキル</th>
                <th className="meta-col">時給</th>
                <th className="meta-col">交通費/日</th>
                <th className="meta-col">生産性<br/><span style={{ fontSize:9, fontWeight:400, color:'#94a3b8' }}>件/h</span></th>
                <th className="meta-col">残留<br/>優先度</th>
                <th style={{ textAlign: 'left', background: '#e2e8f0', fontSize: 12.5, color: '#1e293b', fontWeight: 700, padding: '8px 12px', minWidth:140 }}>相性NGスタッフ</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={9} style={{ padding:'48px 16px', textAlign:'center', color:'#94a3b8', fontSize:13 }}>読み込み中…</td></tr>
              )}
              {!loading && members.length === 0 && (
                <tr><td colSpan={9} style={{ padding:'48px 16px', textAlign:'center', color:'#94a3b8', fontSize:13 }}>
                  まだスタッフが登録されていません。「+ スタッフを追加」または「CSV/Excel アップロード」から登録してください。
                </td></tr>
              )}
              {!loading && filtered.map(m => {
                const c   = constraints[m.id] || BLANK_CONSTRAINT
                const pStyle = retentionStyle(c.retentionPriority)
                const incompatNames = (c.incompatible || []).map(it => {
                  const peer = members.find(x => x.id === it.staffId)
                  return peer ? peer.name : null
                }).filter(Boolean)
                return (
                  <tr key={m.id}>
                    {/* Name */}
                    <td className="name-col">
                      <span
                        onClick={() => openEdit(m)}
                        style={{ cursor: 'pointer', color: 'var(--pita-text)', fontWeight: 500 }}
                      >
                        {m.name}
                      </span>
                    </td>

                    {/* 種別 (雇用形態) */}
                    <td className="meta-col">
                      <span style={{
                        fontSize: 10,
                        padding: '1px 6px',
                        borderRadius: 3,
                        fontWeight: 600,
                        background: m.type === 'F' ? '#d1fae5' : 'var(--pita-bg-subtle)',
                        color:      m.type === 'F' ? '#065f46' : 'var(--pita-muted)',
                      }}>
                        {m.type === 'F' ? '正社員' : 'パート'}
                      </span>
                    </td>

                    {/* 役職 */}
                    <td className="meta-col">
                      <span style={{ fontSize:11, color:'#475569' }}>
                        {m.role === 'owner' ? 'オーナー'
                          : m.role === 'admin' ? '管理者'
                          : m.role === 'manager' ? 'マネージャー'
                          : 'スタッフ'}
                      </span>
                    </td>

                    {/* Skills */}
                    <td style={{ background: 'var(--pita-panel)', padding: '3px 5px', textAlign: 'left', whiteSpace: 'nowrap' }}>
                      {(m.skills ?? []).map(sk => (
                        <span key={sk} className={sk === 'barista' ? 'pita-skill-barista' : sk === 'cashier' ? 'pita-skill-cashier' : 'pita-skill-floor'} style={{ marginRight: 3 }}>
                          {skillLabels[sk] || sk}
                        </span>
                      ))}
                    </td>

                    {/* Wage */}
                    <td className="meta-col">¥{(m.wage ?? 0).toLocaleString()}</td>

                    {/* Transit per day */}
                    <td className="meta-col">¥{(m.transitPerDay ?? 0).toLocaleString()}</td>

                    {/* 時間生産性 */}
                    <td className="meta-col">
                      <span style={{ fontSize:11, color:'#0f172a', fontWeight:600 }}>{m.hourlyOrders ?? 8}</span>
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

                    {/* 相性NGスタッフ */}
                    <td style={{ background: 'var(--pita-panel)', padding:'4px 6px', textAlign:'left' }}>
                      {incompatNames.length === 0 ? (
                        <span style={{ fontSize:10, color:'#cbd5e1' }}>—</span>
                      ) : (
                        <span style={{ display:'inline-flex', flexWrap:'wrap', gap:3 }}>
                          {incompatNames.map((n, i) => (
                            <span key={i} style={{ fontSize:10, padding:'1px 6px', borderRadius:10, background:'#fee2e2', color:'#991b1b', fontWeight:600, whiteSpace:'nowrap' }}>
                              {n}
                            </span>
                          ))}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── CSV Upload Modal ── */}
      {showCsvModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.45)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'white', borderRadius:16, width:'100%', maxWidth:560, maxHeight:'90vh', display:'flex', flexDirection:'column', boxShadow:'0 20px 60px rgba(15,23,42,0.18)' }}>
            <div style={{ padding:'20px 24px', borderBottom:'1px solid #e2e8f0', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div>
                <div style={{ fontSize:17, fontWeight:700, color:'#0f172a' }}>スタッフ CSV / Excel アップロード</div>
                <div style={{ fontSize:12, color:'#64748b', marginTop:3 }}>スタッフのマスターデータをCSV / Excel で一括更新します</div>
              </div>
              <button onClick={() => setShowCsvModal(false)} style={{ fontSize:20, lineHeight:1, background:'none', border:'none', cursor:'pointer', color:'#94a3b8' }}>×</button>
            </div>
            <div style={{ padding:'20px 24px', display:'flex', flexDirection:'column', gap:20, overflowY:'auto' }}>

              {/* ── Section 1: ピタシフのフォーマット ── */}
              <div style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:12, padding:'16px 18px' }}>
                <div style={{ fontSize:14, fontWeight:700, color:'#0f172a', marginBottom:14 }}>
                  ピタシフのフォーマットを使う場合
                </div>
                {/* ① */}
                <div style={{ marginBottom:14 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:'#334155', marginBottom:4 }}>① フォーマットをダウンロード</div>
                  <div style={{ fontSize:11, color:'#64748b', marginBottom:4, lineHeight:1.6 }}>
                    CSVの形式: <code style={{ background:'#e8edf4', padding:'1px 5px', borderRadius:4 }}>スタッフ名,雇用形態,役職,スキル(;区切り),時給(円),交通費/日(円),残留優先度,1日〜30日</code>
                  </div>
                  <div style={{ fontSize:10.5, color:'#94a3b8', marginBottom:10 }}>
                    スキルはバリスタ;レジ;フロア の形式。スタッフ名で既存レコードを照合します。<br />
                    <strong style={{ color:'#4f46e5' }}>Excel (.xlsx) もそのままアップロード可</strong>: 「ﾃﾞｰﾀ入力」シートの NO. / 名前 / 時給 / 交通費 を取り込みます。
                  </div>
                  <button onClick={downloadMemberCsv} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:8, border:'1px solid #4f46e5', background:'white', color:'#4f46e5', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                    ↓ フォーマットをダウンロード
                  </button>
                </div>
                {/* ② */}
                <div style={{ marginBottom:12 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:'#334155', marginBottom:8 }}>② CSV / Excel ファイルを選択</div>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <button onClick={() => fileInputRef.current?.click()} style={{ padding:'8px 16px', borderRadius:8, border:'1px solid #dde5f0', background:'white', color:'#475569', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
                      ファイルを選択
                    </button>
                    <span style={{ fontSize:12, color: pendingCsvFile ? '#0f172a' : '#94a3b8', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {pendingCsvFile ? pendingCsvFile.name : 'ファイルが選択されていません'}
                    </span>
                  </div>
                </div>
                <button onClick={executeMemberUpload} disabled={!pendingCsvFile} style={{ padding:'9px 18px', borderRadius:8, border:'none', background: pendingCsvFile ? '#4f46e5' : '#c7d2fe', color:'white', fontSize:13, fontWeight:600, cursor: pendingCsvFile ? 'pointer' : 'not-allowed', fontFamily:'inherit' }}>アップロードを実行</button>
              </div>

              {/* ── Section 2: 別フォーマット ── */}
              <div style={{ background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:12, padding:'16px 18px' }}>
                <div style={{ fontSize:14, fontWeight:700, color:'#0f172a', marginBottom:14 }}>
                  別のフォーマットでアップロード
                </div>
                {/* ① */}
                <div style={{ marginBottom:14 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:'#334155', marginBottom:8 }}>① フォーマットを選択</div>
                  <select value={altCsvFormat} onChange={e => setAltCsvFormat(e.target.value)} style={{
                    padding:'8px 12px', borderRadius:8, border:'1px solid #fed7aa', background:'white',
                    fontSize:13, fontWeight:600, color:'#334155', cursor:'pointer', fontFamily:'inherit', minWidth:160,
                  }}>
                    <option value="airreji">Airレジ</option>
                  </select>
                  <div style={{ fontSize:10.5, color:'#9a3412', marginTop:6, lineHeight:1.5 }}>
                    {altCsvFormat === 'airreji' && 'Airレジ「スタッフ管理」CSVをそのままアップロードできます。氏名・連絡先・固定シフト等を取り込み、ピタシフ形式に変換して反映します。'}
                  </div>
                </div>
                {/* ② */}
                <div style={{ marginBottom:12 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:'#334155', marginBottom:8 }}>② CSVファイルを選択</div>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <button onClick={() => altFileInputRef.current?.click()} style={{ padding:'8px 16px', borderRadius:8, border:'1px solid #fed7aa', background:'white', color:'#9a3412', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
                      ファイルを選択
                    </button>
                    <input ref={altFileInputRef} type="file" accept=".csv" className="hidden"
                      onChange={e => { setPendingAltCsvFile(e.target.files?.[0] || null); e.target.value = '' }} />
                    <span style={{ fontSize:12, color: pendingAltCsvFile ? '#0f172a' : '#94a3b8', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {pendingAltCsvFile ? pendingAltCsvFile.name : 'ファイルが選択されていません'}
                    </span>
                  </div>
                </div>
                <button onClick={executeAirrejiMemberUpload} disabled={!pendingAltCsvFile} style={{ padding:'9px 18px', borderRadius:8, border:'none', background: pendingAltCsvFile ? '#ea580c' : '#fed7aa', color:'white', fontSize:13, fontWeight:600, cursor: pendingAltCsvFile ? 'pointer' : 'not-allowed', fontFamily:'inherit' }}>アップロードを実行</button>
              </div>
            </div>
            <div style={{ padding:'14px 24px', borderTop:'1px solid #e2e8f0', display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button onClick={() => { setShowCsvModal(false); setPendingCsvFile(null); setPendingAltCsvFile(null) }} style={{ padding:'9px 18px', borderRadius:8, border:'1px solid #dde5f0', background:'white', color:'#475569', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>閉じる</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl my-4">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="font-bold text-lg text-gray-900">{form.id ? 'スタッフ編集' : 'スタッフ追加'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 px-6 overflow-x-auto">
              {MODAL_TABS.map((tab, i) => (
                <button key={tab} onClick={() => setActiveTab(i)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors mr-2 whitespace-nowrap ${
                    activeTab === i ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}>
                  {i === 3 ? (
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
                  {/* 氏名 */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      氏名 <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded ml-1 align-middle">必須</span>
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <input value={form.lastName}  onChange={e => setForm(p => ({ ...p, lastName:  e.target.value }))} placeholder="姓 (例: 山田)"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
                      <input value={form.firstName} onChange={e => setForm(p => ({ ...p, firstName: e.target.value }))} placeholder="名 (例: 花子)"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
                    </div>
                  </div>
                  {/* フリガナ */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">フリガナ</label>
                    <div className="grid grid-cols-2 gap-3">
                      <input value={form.lastNameKana}  onChange={e => setForm(p => ({ ...p, lastNameKana:  e.target.value }))} placeholder="セイ (例: ヤマダ)"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
                      <input value={form.firstNameKana} onChange={e => setForm(p => ({ ...p, firstNameKana: e.target.value }))} placeholder="メイ (例: ハナコ)"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
                    </div>
                  </div>
                  {/* 表示名・シフト表補足 */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">表示名</label>
                      <input value={form.displayName} onChange={e => setForm(p => ({ ...p, displayName: e.target.value }))} placeholder="例: 山田1"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">シフト表補足 <span className="text-[10px] text-gray-400">最大8文字</span></label>
                      <input value={form.shiftMemo} maxLength={8} onChange={e => setForm(p => ({ ...p, shiftMemo: e.target.value }))} placeholder="例: AM早番"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
                    </div>
                  </div>

                  {/* 時給・交通費 */}
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">時給（円）</label>
                      <input type="number" value={form.wage} onChange={e => setForm(p => ({ ...p, wage: Number(e.target.value) }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">交通費 (円/日)</label>
                      <input type="number" value={form.transitPerDay ?? 0} onChange={e => setForm(p => ({ ...p, transitPerDay: Number(e.target.value) }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">時間生産性（件/h）</label>
                      <input type="number" value={form.hourlyOrders} onChange={e => setForm(p => ({ ...p, hourlyOrders: Number(e.target.value) }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
                    </div>
                  </div>

                  {/* グループ */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">グループ</label>
                    <input value={form.group} onChange={e => setForm(p => ({ ...p, group: e.target.value }))} placeholder="例: ホール / キッチン"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
                  </div>

                  {/* 雇用形態 / 役職 */}
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

                  {/* スキル */}
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

                  {/* 連携状態 */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">連携状態</label>
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-semibold ${form.linked ? 'text-emerald-600' : 'text-gray-400'}`}>
                        {form.linked ? '✓ 連携済み' : '未連携'}
                      </span>
                      <button type="button" onClick={() => setForm(p => ({ ...p, linked: !p.linked }))}
                        className="text-xs text-blue-600 hover:underline">
                        {form.linked ? '連携を解除する' : '連携する'}
                      </button>
                    </div>
                  </div>

                  {/* 性別 */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-2">性別</label>
                    <div className="flex gap-4">
                      {['男性','女性','その他'].map(g => (
                        <label key={g} className="flex items-center gap-1.5 cursor-pointer">
                          <input type="radio" name="gender" value={g} checked={form.gender === g}
                            onChange={() => setForm(p => ({ ...p, gender: g }))}
                            className="accent-blue-600" />
                          <span className="text-sm text-gray-700">{g}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* ── Tab 1: 連絡先・住所 ── */}
              {activeTab === 1 && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">電話番号 <span className="text-[10px] text-gray-400 ml-1">ハイフン不要</span></label>
                    <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value.replace(/[^\d]/g, '') }))} placeholder="08079334104"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">メールアドレス <span className="text-[10px] text-gray-400 ml-1">半角英数字または記号</span></label>
                    <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="example@gmail.com"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">郵便番号 <span className="text-[10px] text-gray-400 ml-1">ハイフン不要</span></label>
                    <input value={form.postalCode} maxLength={7} onChange={e => setForm(p => ({ ...p, postalCode: e.target.value.replace(/[^\d]/g, '') }))} placeholder="1010031"
                      className="w-40 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">都道府県</label>
                    <select value={form.prefecture} onChange={e => setForm(p => ({ ...p, prefecture: e.target.value }))}
                      className="w-48 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400">
                      <option value="">選択してください</option>
                      {PREFECTURES.map(pf => <option key={pf} value={pf}>{pf}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">市区町村郡 <span className="text-[10px] text-gray-400 ml-1">最大20文字</span></label>
                    <input value={form.city} maxLength={20} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} placeholder="千代田区"
                      className="w-72 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">町名番地 <span className="text-[10px] text-gray-400 ml-1">最大20文字</span></label>
                    <input value={form.streetAddress} maxLength={20} onChange={e => setForm(p => ({ ...p, streetAddress: e.target.value }))} placeholder="東神田2-9-12"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">ビル名等 <span className="text-[10px] text-gray-400 ml-1">最大20文字</span></label>
                    <input value={form.buildingName} maxLength={20} onChange={e => setForm(p => ({ ...p, buildingName: e.target.value }))} placeholder="例: ◯◯ビル 201号室"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">スタッフコード</label>
                    <input value={form.staffCode} onChange={e => setForm(p => ({ ...p, staffCode: e.target.value }))} placeholder="任意"
                      className="w-56 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">メモ</label>
                    <textarea value={form.memo} onChange={e => setForm(p => ({ ...p, memo: e.target.value }))} rows={3}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
                  </div>
                </>
              )}

              {/* ── Tab 2: 固定シフト ── */}
              {activeTab === 2 && (
                <>
                  <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-700">
                    固定シフトを設定すると、毎月の月初めに3ヶ月分のシフト下書きが作成されます。
                  </div>
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="grid grid-cols-[40px_1fr] bg-gray-100 border-b border-gray-200 text-[11px] text-gray-600 font-semibold">
                      <div className="px-2 py-1.5 text-center">曜日</div>
                      <div className="grid" style={{ gridTemplateColumns: `repeat(${HOUR_TIMES.length / 2}, 1fr)` }}>
                        {Array.from({ length: HOUR_TIMES.length / 2 }, (_, i) => 9 + i).map(h => (
                          <div key={h} className="px-1 py-1.5 text-center border-l border-gray-200">{h}</div>
                        ))}
                      </div>
                    </div>
                    {DOW_KEYS.map(({ k, l }) => {
                      const fs = form.fixedShift[k] || { enabled:false, start:'13:00', end:'18:00' }
                      const startMin = parseInt(fs.start.split(':')[0])*60 + parseInt(fs.start.split(':')[1])
                      const endMin   = parseInt(fs.end  .split(':')[0])*60 + parseInt(fs.end  .split(':')[1])
                      const dayStart = 9*60, dayEnd = 23*60
                      const leftPct  = Math.max(0, (startMin - dayStart) / (dayEnd - dayStart) * 100)
                      const widthPct = Math.max(0, (endMin   - startMin) / (dayEnd - dayStart) * 100)
                      return (
                        <div key={k} className="grid grid-cols-[40px_1fr] border-b border-gray-100 items-stretch">
                          <div className="px-2 py-2 text-center text-sm font-semibold text-gray-700 border-r border-gray-100">{l}</div>
                          <div className="relative h-9 bg-white">
                            <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${HOUR_TIMES.length / 2}, 1fr)` }}>
                              {Array.from({ length: HOUR_TIMES.length / 2 }).map((_, i) => (
                                <div key={i} className="border-l border-gray-100" />
                              ))}
                            </div>
                            {fs.enabled && widthPct > 0 && (
                              <div title={`${fs.start} - ${fs.end}`} style={{
                                position:'absolute', left:`${leftPct}%`, width:`${widthPct}%`,
                                top:4, bottom:4, background:'#bfdbfe', border:'1px solid #60a5fa', borderRadius:4,
                                display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:'#1e3a8a', fontWeight:600,
                              }}>
                                {fs.start} - {fs.end}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {/* per-day controls */}
                  <div className="grid gap-2">
                    {DOW_KEYS.map(({ k, l }) => {
                      const fs = form.fixedShift[k] || { enabled:false, start:'13:00', end:'18:00' }
                      const update = (patch) => setForm(p => ({ ...p, fixedShift: { ...p.fixedShift, [k]: { ...fs, ...patch } } }))
                      return (
                        <div key={k} className="flex items-center gap-3 px-3 py-2 border border-gray-200 rounded-lg">
                          <span className="w-6 text-center text-sm font-semibold text-gray-700">{l}</span>
                          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                            <input type="checkbox" checked={fs.enabled} onChange={e => update({ enabled: e.target.checked })} className="accent-blue-600" />
                            <span>出勤</span>
                          </label>
                          <select value={fs.start} disabled={!fs.enabled} onChange={e => update({ start: e.target.value })}
                            className="border border-gray-300 rounded px-2 py-1 text-xs outline-none disabled:bg-gray-50 disabled:text-gray-400">
                            {HOUR_TIMES.map(t => <option key={t}>{t}</option>)}
                          </select>
                          <span className="text-gray-400 text-xs">〜</span>
                          <select value={fs.end} disabled={!fs.enabled} onChange={e => update({ end: e.target.value })}
                            className="border border-gray-300 rounded px-2 py-1 text-xs outline-none disabled:bg-gray-50 disabled:text-gray-400">
                            {HOUR_TIMES.map(t => <option key={t}>{t}</option>)}
                          </select>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}

              {/* ── Tab 3: マネージャー設定 ── */}
              {activeTab === 3 && (
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

            <div className="px-6 py-4 border-t flex gap-3 justify-between flex-wrap">
              <div className="flex items-center gap-3">
                {form.id && (
                  <button
                    onClick={async () => {
                      if (!confirm(`${form.lastName || form.name || 'このスタッフ'} を削除しますか？\nこの操作は取り消せません。`)) return
                      try {
                        await employeesApi.deleteEmployee(form.id)
                        setMembers(prev => prev.filter(m => m.id !== form.id))
                        setShowModal(false)
                      } catch (e) {
                        console.error('[Members.delete]', e)
                        setErrMsg(e.message || '削除に失敗しました')
                        setShowModal(false)
                      }
                    }}
                    className="text-xs text-red-600 hover:underline"
                  >スタッフを削除する</button>
                )}
                <span className="text-xs text-gray-400">* 必須項目</span>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowModal(false)} className="mgr-btn-secondary">キャンセル</button>
                <button onClick={handleSave} className="mgr-btn-primary">保存する</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 招待 URL 発行モーダル ── */}
      {showInviteModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.45)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }} onClick={() => setShowInviteModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background:'white', borderRadius:14, width:'100%', maxWidth:640, maxHeight:'88vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(15,23,42,0.18)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 22px', borderBottom:'1px solid #E2E8F0' }}>
              <div>
                <div style={{ fontSize:16, fontWeight:700, color:'#0F172A' }}>招待 URL を発行</div>
                <div style={{ fontSize:12, color:'#64748B', marginTop:3 }}>URL を渡すと、相手がサインアップ後に自動的にこの組織へ参加します</div>
              </div>
              <button onClick={() => setShowInviteModal(false)} style={{ background:'none', border:'none', fontSize:20, color:'#94A3B8', cursor:'pointer' }}>✕</button>
            </div>

            <div style={{ padding:'18px 22px' }}>
              {!createdInvite ? (
                <>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
                    <div>
                      <label className="mgr-label">ロール</label>
                      <select className="mgr-input" value={inviteForm.role} onChange={e => setInviteForm(f => ({ ...f, role: e.target.value }))}>
                        <option value="staff">スタッフ</option>
                        <option value="manager">マネージャー</option>
                        <option value="admin">管理者</option>
                      </select>
                    </div>
                    <div>
                      <label className="mgr-label">有効期限</label>
                      <select className="mgr-input" value={inviteForm.expiresInDays} onChange={e => setInviteForm(f => ({ ...f, expiresInDays: e.target.value }))}>
                        <option value={1}>1日</option>
                        <option value={3}>3日</option>
                        <option value={7}>7日</option>
                        <option value={14}>14日</option>
                        <option value={30}>30日</option>
                      </select>
                    </div>
                    <div>
                      <label className="mgr-label">メールアドレス（任意）</label>
                      <input type="email" className="mgr-input" placeholder="指定すると、そのメールでサインアップしたユーザーのみ受諾可"
                        value={inviteForm.email} onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))} />
                    </div>
                    <div>
                      <label className="mgr-label">表示名（任意）</label>
                      <input type="text" className="mgr-input" placeholder="例: 田中 太郎"
                        value={inviteForm.nameHint} onChange={e => setInviteForm(f => ({ ...f, nameHint: e.target.value }))} />
                    </div>
                  </div>

                  <label className="mgr-label">アクセス権限を付与する店舗</label>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:14 }}>
                    {(stores ?? []).map(s => {
                      const on = inviteForm.storeIds.includes(s.id)
                      return (
                        <button key={s.id} type="button"
                          onClick={() => setInviteForm(f => ({
                            ...f,
                            storeIds: on ? f.storeIds.filter(x => x !== s.id) : [...f.storeIds, s.id],
                          }))}
                          style={{
                            padding:'6px 14px', borderRadius:18, fontSize:12, fontWeight: on ? 700 : 500,
                            background: on ? '#4F46E5' : '#F0F5F9',
                            color:      on ? 'white'   : '#475569',
                            border:'none', cursor:'pointer', fontFamily:'inherit',
                          }}>
                          {on ? '✓ ' : ''}{s.name}
                        </button>
                      )
                    })}
                    {(stores ?? []).length === 0 && (
                      <div style={{ fontSize:12, color:'#94A3B8' }}>店舗が登録されていません</div>
                    )}
                  </div>

                  {inviteMsg && (
                    <div style={{ padding:'10px 14px', background:'#FEE2E2', color:'#991B1B', border:'1px solid #FECACA', borderRadius:8, fontSize:13, marginBottom:14 }}>
                      {inviteMsg}
                    </div>
                  )}

                  <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
                    <button onClick={() => setShowInviteModal(false)} className="mgr-btn-secondary">キャンセル</button>
                    <button onClick={createInvite} disabled={creatingInvite} className="mgr-btn-primary">
                      {creatingInvite ? '作成中…' : '招待 URL を発行'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ padding:'12px 14px', background:'#ECFDF5', border:'1px solid #A7F3D0', borderRadius:10, marginBottom:14 }}>
                    <div style={{ fontSize:12, fontWeight:700, color:'#065F46' }}>✓ 招待を作成しました</div>
                    <div style={{ fontSize:11, color:'#065F46', marginTop:4 }}>下記の URL を相手に送ってください。期限内に限り何度でも閲覧できます。</div>
                  </div>
                  <label className="mgr-label">招待 URL</label>
                  <div style={{ display:'flex', gap:8, alignItems:'stretch' }}>
                    <input readOnly value={createdInvite.url} className="mgr-input" style={{ flex:1, fontFamily:'monospace', fontSize:12 }} onFocus={e => e.target.select()} />
                    <button onClick={() => copyInviteUrl(createdInvite.url)} className="mgr-btn-primary" style={{ whiteSpace:'nowrap' }}>
                      {copyOk ? '✓ コピー済' : 'コピー'}
                    </button>
                  </div>
                  <div style={{ marginTop:10, fontSize:11, color:'#64748B', lineHeight:1.6 }}>
                    所属: {createdInvite.org_id} ／ ロール: {createdInvite.role}<br />
                    期限: {new Date(createdInvite.expires_at).toLocaleString('ja-JP')}
                    {createdInvite.email ? `／ 限定メール: ${createdInvite.email}` : ''}
                  </div>
                  <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:18 }}>
                    <button onClick={() => setCreatedInvite(null)} className="mgr-btn-secondary">もう1件作成</button>
                    <button onClick={() => setShowInviteModal(false)} className="mgr-btn-primary">閉じる</button>
                  </div>
                </>
              )}

              {/* 履歴 */}
              {invitations.length > 0 && (
                <div style={{ marginTop:22, paddingTop:18, borderTop:'1px solid #E2E8F0' }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'#475569', marginBottom:8 }}>発行済み招待</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {invitations.map(inv => {
                      const expired = new Date(inv.expires_at) <= new Date()
                      const used    = Boolean(inv.used_at)
                      const revoked = Boolean(inv.revoked_at)
                      const status =
                        revoked ? { label:'取消済', color:'#94A3B8', bg:'#F1F5F9' } :
                        used    ? { label:'使用済', color:'#475569', bg:'#F1F5F9' } :
                        expired ? { label:'期限切', color:'#92400E', bg:'#FEF3C7' } :
                                  { label:'有効',   color:'#065F46', bg:'#ECFDF5' }
                      return (
                        <div key={inv.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', background:'#F8FAFC', border:'1px solid #E2E8F0', borderRadius:8 }}>
                          <span style={{ fontSize:10, fontWeight:700, color:status.color, background:status.bg, padding:'2px 8px', borderRadius:10 }}>{status.label}</span>
                          <span style={{ fontSize:11, color:'#0F172A', fontWeight:600, flexShrink:0 }}>{inv.role}</span>
                          <span style={{ fontSize:11, color:'#64748B', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            {inv.email || '（メール指定なし）'}
                          </span>
                          {!revoked && !used && !expired && (
                            <>
                              <button onClick={() => copyInviteUrl(inv.url)} style={{ fontSize:11, padding:'3px 10px', background:'white', border:'1px solid #DDE5F0', borderRadius:6, cursor:'pointer', color:'#475569' }}>コピー</button>
                              <button onClick={() => revokeInvite(inv.id)} style={{ fontSize:11, padding:'3px 10px', background:'white', border:'1px solid #FECACA', borderRadius:6, cursor:'pointer', color:'#B91C1C' }}>取消</button>
                            </>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
