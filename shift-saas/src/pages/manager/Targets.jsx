import { useState, useRef, useEffect, useMemo } from 'react'
import { storeConfig, calcRequiredStaff, ORDER_DISTRIBUTION, SALES_PATTERNS } from '../../data/mockData'
import { readWorkbookFromFile, extractSalesPatterns, matchPatternKey } from '../../utils/excelImport.js'
import { useOrg } from '../../context/OrgContext'
import { loadTargets, saveTargets } from '../../api/targets'
import { loadSettings, saveSettings } from '../../api/orgSettings'

const DEFAULT_LABOR_BAND = { min: 22, max: 32 } // %
const LABOR_BAND_HARD_MAX = 50 // %  ゲージ最大値

// 曜日インデックスを 0=日…6=土 で揃える
const DOW_INDEX = { '日':0, '月':1, '火':2, '水':3, '木':4, '金':5, '土':6 }
const DOW_JP = ['日','月','火','水','木','金','土']

// 指定された年月の日別スケルトンを動的生成（値ゼロ）
function makeSkeletonForMonth(year, month) {
  const lastDay = new Date(year, month, 0).getDate()
  return Array.from({ length: lastDay }, (_, i) => {
    const day = i + 1
    const dowIdx = new Date(year, month - 1, day).getDay()
    return {
      day,
      dow: DOW_JP[dowIdx],
      isWeekend: dowIdx === 0 || dowIdx === 6,
      sales: 0, customers: 0, avgSpend: 0, orders: 0, laborCost: 0,
    }
  })
}

const PATTERN_HOURS = Array.from({ length: 14 }, (_, i) => i + 9) // 9-22

const calcDayPeakStaff = (orders, productivity) => {
  const hours = Object.keys(ORDER_DISTRIBUTION).map(Number)
  return Math.max(...hours.map(h => calcRequiredStaff(orders, h, productivity, 0)))
}

const calcDayAvgStaff = (orders, productivity) => {
  const hours = Object.keys(ORDER_DISTRIBUTION).map(Number)
  const vals = hours.map(h => calcRequiredStaff(orders, h, productivity, 0))
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10
}

const FIELDS = [
  { key: 'sales',     label: '売上目標(千円)', unit: '千円' },
  { key: 'customers', label: '客数目標(名)',    unit: '名'  },
  { key: 'avgSpend',  label: '客単価(円)',      unit: '円'  },
  { key: 'orders',    label: '注文数(件)',      unit: '件'  },
  { key: 'laborCost', label: '人件費目標(千円)', unit: '千円' },
]

const ACTUAL_RATIO = [0.98, 0.93, 1.04, 1.06, 0.97, 1.01, 1.05, 0.99, 1.03, 0.95, 1.00, 1.07, 0.98, 1.02, 0.96]

// 棒(目標) + 折れ線(実績) の複合グラフ
function SVGBarLineChart({ targets }) {
  const planVals   = targets.map(d => d.sales)
  const actualVals = targets.map((d, i) => Math.round(d.sales * ACTUAL_RATIO[i]))

  const allVals = [...planVals, ...actualVals, 0]
  const yMax = Math.max(...allVals) * 1.12 || 1
  const yMin = 0

  const W = 700, H = 200
  const L = 62, R = 16, T = 12, B = 40
  const PW = W - L - R
  const PH = H - T - B

  const n = targets.length
  const slotW = PW / n
  const xc = i => L + slotW * (i + 0.5)
  const yp = v => T + PH - ((v - yMin) / (yMax - yMin || 1)) * PH
  const barW = Math.max(6, slotW * 0.55)

  const actPts = actualVals.map((v, i) => `${xc(i).toFixed(1)},${yp(v).toFixed(1)}`).join(' ')

  const gridVals = Array.from({ length: 5 }, (_, i) => yMin + (yMax - yMin) * i / 4)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', height:'100%' }}>
      {gridVals.map((v, i) => (
        <g key={i}>
          <line x1={L} y1={yp(v).toFixed(1)} x2={W - R} y2={yp(v).toFixed(1)} stroke="#f1f5f9" strokeWidth="1" />
          <text x={L - 5} y={yp(v) + 3.5} textAnchor="end" fontSize="9" fill="#94a3b8" fontFamily="system-ui, sans-serif">
            {Math.round(v).toLocaleString('ja-JP')}
          </text>
        </g>
      ))}
      {planVals.map((v, i) => (
        <rect key={i}
          x={(xc(i) - barW / 2).toFixed(1)} y={yp(v).toFixed(1)}
          width={barW.toFixed(1)} height={(T + PH - yp(v)).toFixed(1)}
          fill="#c7d2fe" rx="3"
        />
      ))}
      <polyline points={actPts} fill="none" stroke="#10b981" strokeWidth="2" strokeLinejoin="round" />
      {actualVals.map((v, i) => (
        <circle key={i} cx={xc(i).toFixed(1)} cy={yp(v).toFixed(1)} r="3" fill="white" stroke="#10b981" strokeWidth="2" />
      ))}
      {targets.map((d, i) => (
        <text key={d.day} x={xc(i).toFixed(1)} y={T + PH + 15} textAnchor="middle" fontSize="9" fill={d.isWeekend ? '#f87171' : '#94a3b8'} fontFamily="system-ui, sans-serif">
          {d.day}日
        </text>
      ))}
    </svg>
  )
}

// 人件比率ゲージ（半円メーター + 信号機）
function LaborRatioGauge({ ratio, band }) {
  // ratio: % (0..50くらい)
  // band: { min, max }  緑帯
  const v = Number.isFinite(ratio) ? ratio : 0
  const clamped = Math.max(0, Math.min(LABOR_BAND_HARD_MAX, v))
  const pct = clamped / LABOR_BAND_HARD_MAX

  const status =
    v < band.min ? 'low'
    : v <= band.max ? 'ok'
    : v <= band.max + 5 ? 'warn'
    : 'over'

  const colorByStatus = {
    low:  '#3b82f6', // 青  — 投下不足
    ok:   '#10b981', // 緑  — 範囲内
    warn: '#f59e0b', // 黄  — 警戒
    over: '#ef4444', // 赤  — 超過
  }
  const labelByStatus = {
    low:  '人件費を抑えすぎ',
    ok:   '範囲内',
    warn: '上限に近い',
    over: '超過',
  }

  // ─── 半円メーター ───
  const W = 220, H = 130
  const cx = W / 2, cy = H - 18, r = 86
  const startAngle = Math.PI            // 180°
  const endAngle   = 0                  // 0°
  const a = startAngle + (endAngle - startAngle) * pct
  const px = cx + r * Math.cos(a)
  const py = cy + r * Math.sin(a)

  // 緑帯セクター
  const sectorPath = (from, to) => {
    const a1 = startAngle + (endAngle - startAngle) * (from / LABOR_BAND_HARD_MAX)
    const a2 = startAngle + (endAngle - startAngle) * (to   / LABOR_BAND_HARD_MAX)
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1)
    const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2)
    return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`
  }

  return (
    <div style={{
      background:'white', borderRadius:12, padding:'16px 18px',
      border:'1px solid #e2e8f0', boxShadow:'0 1px 3px rgba(15,23,42,0.04)',
      display:'flex', flexDirection:'column', gap:6,
    }}>
      <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between' }}>
        <div style={{ fontSize:11, color:'#64748b' }}>人件比率（前半平均）</div>
        <div style={{
          fontSize:11, fontWeight:700, color: colorByStatus[status],
          background: colorByStatus[status] + '1a', padding:'2px 8px', borderRadius:8,
        }}>{labelByStatus[status]}</div>
      </div>
      <div style={{ display:'flex', alignItems:'flex-end', gap:12 }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width:180, height:108 }}>
          {/* 背景アーク */}
          <path d={sectorPath(0, LABOR_BAND_HARD_MAX)} stroke="#e2e8f0" strokeWidth="12" fill="none" strokeLinecap="round" />
          {/* 緑帯 */}
          <path d={sectorPath(band.min, band.max)} stroke="#86efac" strokeWidth="12" fill="none" strokeLinecap="butt" />
          {/* 値アーク */}
          <path d={sectorPath(0, clamped)} stroke={colorByStatus[status]} strokeWidth="12" fill="none" strokeLinecap="round" />
          {/* 針 */}
          <line x1={cx} y1={cy} x2={px.toFixed(1)} y2={py.toFixed(1)} stroke="#0f172a" strokeWidth="2" strokeLinecap="round" />
          <circle cx={cx} cy={cy} r="5" fill="#0f172a" />
          {/* 目盛ラベル */}
          <text x={cx + r * Math.cos(startAngle) - 4} y={cy + 14} fontSize="9" fill="#94a3b8" textAnchor="middle" fontFamily="system-ui, sans-serif">0%</text>
          <text x={cx + r * Math.cos(endAngle) + 4} y={cy + 14} fontSize="9" fill="#94a3b8" textAnchor="middle" fontFamily="system-ui, sans-serif">{LABOR_BAND_HARD_MAX}%</text>
        </svg>
        <div style={{ flex:1, textAlign:'right' }}>
          <div style={{ fontSize:32, fontWeight:800, color: colorByStatus[status], lineHeight:1 }}>
            {v.toFixed(1)}<span style={{ fontSize:14, fontWeight:600, marginLeft:2 }}>%</span>
          </div>
          <div style={{ fontSize:10, color:'#94a3b8', marginTop:6 }}>
            緑帯: {band.min}〜{band.max}%
          </div>
        </div>
      </div>
    </div>
  )
}

function SVGLineChart({ targets, meta }) {
  const planVals   = targets.map(d => meta.getValue(d))
  const actualVals = targets.map((d, i) => Math.round(meta.getValue(d) * ACTUAL_RATIO[i]))

  const allVals = [...planVals, ...actualVals]
  const dataMin = Math.min(...allVals)
  const dataMax = Math.max(...allVals)
  const yMin = dataMin * 0.88
  const yMax = dataMax * 1.08

  const W = 700, H = 188
  const L = 62, R = 16, T = 12, B = 40
  const PW = W - L - R
  const PH = H - T - B

  const xp = i => L + (i / (targets.length - 1)) * PW
  const yp = v => T + PH - ((v - yMin) / (yMax - yMin || 1)) * PH

  const planPts = planVals.map((v, i) => `${xp(i).toFixed(1)},${yp(v).toFixed(1)}`).join(' ')
  const actPts  = actualVals.map((v, i) => `${xp(i).toFixed(1)},${yp(v).toFixed(1)}`).join(' ')

  const gridVals = Array.from({ length: 5 }, (_, i) => yMin + (yMax - yMin) * i / 4)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', height:'100%' }}>
      {gridVals.map((v, i) => (
        <g key={i}>
          <line x1={L} y1={yp(v).toFixed(1)} x2={W - R} y2={yp(v).toFixed(1)} stroke="#f1f5f9" strokeWidth="1" />
          <text x={L - 5} y={yp(v) + 3.5} textAnchor="end" fontSize="9" fill="#94a3b8" fontFamily="system-ui, sans-serif">
            {Math.round(v).toLocaleString('ja-JP')}
          </text>
        </g>
      ))}
      <polyline points={planPts}  fill="none" stroke="#a5b4fc" strokeWidth="1.5" strokeDasharray="6 3" strokeLinejoin="round" />
      <polyline points={actPts}   fill="none" stroke="#10b981" strokeWidth="2"   strokeLinejoin="round" />
      {planVals.map((v, i) => (
        <circle key={i} cx={xp(i).toFixed(1)} cy={yp(v).toFixed(1)} r="2.8" fill="white" stroke="#a5b4fc" strokeWidth="1.5" />
      ))}
      {actualVals.map((v, i) => (
        <circle key={i} cx={xp(i).toFixed(1)} cy={yp(v).toFixed(1)} r="3"   fill="white" stroke="#10b981" strokeWidth="2" />
      ))}
      {targets.map((d, i) => (
        <text key={d.day} x={xp(i).toFixed(1)} y={T + PH + 15} textAnchor="middle" fontSize="9" fill={d.isWeekend ? '#f87171' : '#94a3b8'} fontFamily="system-ui, sans-serif">
          {d.day}日
        </text>
      ))}
    </svg>
  )
}

const HOURS_LIST = Object.keys(ORDER_DISTRIBUTION).map(Number).sort((a, b) => a - b)

function initHourly(d) {
  const result = {}
  HOURS_LIST.forEach(h => {
    const ratio = ORDER_DISTRIBUTION[h] || 0
    result[h] = {
      sales:     Math.round(d.sales     * ratio),
      laborCost: Math.round((d.laborCost || 0) * ratio),
    }
  })
  return result
}

export default function Targets() {
  const { stores } = useOrg()
  const storeId = stores[0]?.id

  // 月選択（今日の年月を初期値）
  const today = new Date()
  const [year,  setYear]  = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const yearMonthLabel = `${year}年${month}月`
  const prevMonthNav = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12) } else { setMonth(m => m - 1) }
  }
  const nextMonthNav = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1) } else { setMonth(m => m + 1) }
  }

  const [allTargets, setAllTargets] = useState(() => makeSkeletonForMonth(today.getFullYear(), today.getMonth() + 1))
  const [saving, setSaving] = useState(false)
  const [errMsg, setErrMsg] = useState('')

  const [prevMonthTargets, setPrevMonthTargets] = useState([])
  const [laborBand, setLaborBand] = useState(DEFAULT_LABOR_BAND)

  useEffect(() => {
    if (!storeId) return
    let cancelled = false
    const prevYear  = month === 1 ? year - 1 : year
    const prevMonth = month === 1 ? 12 : month - 1
    // 月切替時はスケルトンを再生成してデータ重ね合わせ
    const skeleton = makeSkeletonForMonth(year, month)
    setAllTargets(skeleton)
    Promise.all([
      loadTargets({ storeId, year, month }),
      loadTargets({ storeId, year: prevYear, month: prevMonth }),
      loadSettings(storeId),
    ])
      .then(([dbRows, prevRows, settings]) => {
        if (cancelled) return
        if (dbRows.length) {
          const byDay = Object.fromEntries(dbRows.map(r => [r.day, r]))
          setAllTargets(skeleton.map(d => byDay[d.day] ? { ...d, ...byDay[d.day] } : d))
        }
        setPrevMonthTargets(prevRows ?? [])
        if (settings?.salesPatterns) setPatterns(settings.salesPatterns)
        if (settings?.laborRatioBand) {
          setLaborBand({
            min: Number(settings.laborRatioBand.min ?? DEFAULT_LABOR_BAND.min),
            max: Number(settings.laborRatioBand.max ?? DEFAULT_LABOR_BAND.max),
          })
        }
      })
      .catch(e => { if (!cancelled) setErrMsg(e.message || '読み込みに失敗しました') })
    return () => { cancelled = true }
  }, [storeId, year, month])
  const [half, setHalf] = useState('first')   // 'first' | 'second'
  const targets = allTargets.filter(d => half === 'first' ? d.day <= 15 : d.day >= 16)
  const setTargets = (updater) => setAllTargets(prev => typeof updater === 'function' ? updater(prev) : updater)
  const [editingCell, setEditingCell] = useState(null)
  const [saved, setSaved] = useState(false)
  const [csvMsg, setCsvMsg] = useState('')
  const [activeChart, setActiveChart] = useState('sales')
  const [hourlyExpand, setHourlyExpand] = useState(null)   // day number | null
  const [hourlyTargets, setHourlyTargets] = useState({})   // { [day]: { [hour]: { sales, laborCost } } }
  const [patterns, setPatterns] = useState(SALES_PATTERNS) // editable 5 patterns
  const [activePattern, setActivePattern] = useState('weekday1')
  const [showCsvModal, setShowCsvModal] = useState(false)
  const [pendingCsvFile, setPendingCsvFile] = useState(null)
  const fileInputRef = useRef(null)
  const [showPatternCsvModal, setShowPatternCsvModal] = useState(false)
  const [pendingPatternCsvFile, setPendingPatternCsvFile] = useState(null)
  const [patternCsvMsg, setPatternCsvMsg] = useState('')
  const patternFileInputRef = useRef(null)

  const TARGET_HEADER_COLS = ['日','曜日','売上目標(千円)','客数目標(名)','客単価(円)','注文数(件)','人件費目標(千円)','人件比率(%)','人時生産性(円)']

  const downloadCsvFormat = () => {
    const header = TARGET_HEADER_COLS.join(',')
    // 現在の入力済み値を含めてエクスポート（無入力の月は 0 が並ぶ）
    const rows = allTargets.map(d => {
      const ratio = d.sales > 0 ? ((d.laborCost || 0) / d.sales * 100).toFixed(1) : ''
      const prod  = (d.laborCost || 0) > 0 ? Math.round(d.sales * AVG_WAGE / d.laborCost) : ''
      return [d.day, d.dow, d.sales, d.customers, d.avgSpend, d.orders, d.laborCost || 0, ratio, prod].join(',')
    })
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'targets_format.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const executeCsvUpload = () => {
    if (!pendingCsvFile) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const lines = ev.target.result.trim().split('\n')
        const parsed = lines.filter(l => /^\d+/.test(l.split(',')[0].trim())).map(line => {
          const p = line.split(',').map(s => s.trim())
          const day       = parseInt(p[0])
          const dow       = p[1] || ''
          const sales     = parseFloat(p[2]) || 0
          const customers = parseInt(p[3]) || Math.round(sales * 1000 / 3000)
          const avgSpend  = parseInt(p[4]) || (customers > 0 ? Math.round(sales * 1000 / customers) : 3000)
          const orders    = parseInt(p[5]) || Math.round(customers * 1.5)
          const laborCost = parseFloat(p[6]) || 0
          // 人件比率(p[7])と人時生産性(p[8])は計算項目なので無視
          return { day, dow, sales, customers, avgSpend, orders, laborCost }
        }).filter(d => d.day >= 1 && d.day <= 31)
        if (!parsed.length) { setCsvMsg('CSVの形式が正しくありません。'); setShowCsvModal(false); return }
        setTargets(prev => prev.map(d => { const f = parsed.find(p => p.day === d.day); return f ? { ...d, ...f } : d }))
        setCsvMsg(`✓ ${parsed.length}日分のデータを読み込みました`)
        setTimeout(() => setCsvMsg(''), 3000)
      } catch { setCsvMsg('CSVの読み込みに失敗しました。') }
    }
    reader.readAsText(pendingCsvFile, 'UTF-8')
    setShowCsvModal(false)
    setPendingCsvFile(null)
  }

  // ── 時間帯別売上パターン CSV ──
  const PATTERN_HEADER_COLS = ['パターン','項目', ...PATTERN_HOURS.map(h => `${h}:00`), '合計']
  const downloadPatternCsvFormat = () => {
    const header = PATTERN_HEADER_COLS.join(',')
    const rows = []
    Object.entries(SALES_PATTERNS).forEach(([key, p]) => {
      const total = Object.values(p.hourlySales).reduce((a, b) => a + b, 0)
      const salesRow = [p.label, '売上(円)', ...PATTERN_HOURS.map(h => p.hourlySales[h] ?? 0), total]
      const ratioRow = [p.label, '構成比(%)', ...PATTERN_HOURS.map(h => total > 0 ? ((p.hourlySales[h] ?? 0) / total * 100).toFixed(1) : '0.0'), '100.0']
      rows.push(salesRow.join(','), ratioRow.join(','))
    })
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'sales_patterns_format.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  // .xlsx → ﾃﾞｰﾀ入力シートから時間帯別売上パターンを抽出してマージ
  const executePatternExcelUpload = async () => {
    if (!pendingPatternCsvFile) return
    try {
      const wb = await readWorkbookFromFile(pendingPatternCsvFile)
      const excelPatterns = extractSalesPatterns(wb)
      if (!excelPatterns.length) { setPatternCsvMsg('Excel からパターンを読み取れませんでした。'); setShowPatternCsvModal(false); return }
      const next = JSON.parse(JSON.stringify(patterns))
      const matched = []
      const keys = Object.keys(SALES_PATTERNS)
      excelPatterns.forEach((p, i) => {
        const matchedKey = matchPatternKey(p.label, SALES_PATTERNS) || keys[i] || null
        if (!matchedKey || !next[matchedKey]) return
        // 既存の hourlySales を上書き (時間帯ごとに)
        next[matchedKey].hourlySales = { ...next[matchedKey].hourlySales, ...p.hourlySales }
        matched.push(`${matchedKey}(${p.label})`)
      })
      if (matched.length === 0) { setPatternCsvMsg('一致するパターンがありませんでした。'); setShowPatternCsvModal(false); return }
      setPatterns(next)
      setPatternCsvMsg(`✓ Excel取込: ${matched.length}パターン (${matched.join(', ')})`)
      setTimeout(() => setPatternCsvMsg(''), 4000)
    } catch {
      setPatternCsvMsg('Excel の読み込みに失敗しました。')
    }
    setShowPatternCsvModal(false)
    setPendingPatternCsvFile(null)
  }

  const executePatternUpload = () => {
    if (!pendingPatternCsvFile) return
    const ext = (pendingPatternCsvFile.name.split('.').pop() || '').toLowerCase()
    if (ext === 'xlsx' || ext === 'xls') return executePatternExcelUpload()
    return executePatternCsvUpload()
  }

  const executePatternCsvUpload = () => {
    if (!pendingPatternCsvFile) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const lines = ev.target.result.trim().split('\n').slice(1) // skip header
        const labelToKey = Object.fromEntries(Object.entries(SALES_PATTERNS).map(([k, p]) => [p.label, k]))
        const next = JSON.parse(JSON.stringify(patterns))
        let count = 0
        lines.forEach(line => {
          const cols = line.split(',').map(s => s.trim())
          if (cols.length < 3) return
          const [label, kind, ...rest] = cols
          const key = labelToKey[label]
          if (!key) return
          // 売上(円) 行のみ反映（構成比は計算項目なので無視）
          if (!/売上/.test(kind)) return
          PATTERN_HOURS.forEach((h, i) => {
            const v = parseFloat(rest[i]) || 0
            next[key].hourlySales[h] = v
          })
          count++
        })
        if (count === 0) { setPatternCsvMsg('CSVの形式が正しくありません。'); setShowPatternCsvModal(false); return }
        setPatterns(next)
        setPatternCsvMsg(`✓ ${count}パターン分のデータを読み込みました`)
        setTimeout(() => setPatternCsvMsg(''), 3000)
      } catch { setPatternCsvMsg('CSVの読み込みに失敗しました。') }
    }
    reader.readAsText(pendingPatternCsvFile, 'UTF-8')
    setShowPatternCsvModal(false)
    setPendingPatternCsvFile(null)
  }

  const updatePatternHour = (key, hour, value) => {
    setPatterns(prev => ({
      ...prev,
      [key]: { ...prev[key], hourlySales: { ...prev[key].hourlySales, [hour]: Number(value) || 0 } },
    }))
  }
  const patternTotal = (key) => Object.values(patterns[key]?.hourlySales || {}).reduce((a, b) => a + b, 0)

  const openHourly = (day) => {
    if (!hourlyTargets[day]) {
      const d = targets.find(t => t.day === day)
      setHourlyTargets(prev => ({ ...prev, [day]: initHourly(d) }))
    }
    setHourlyExpand(day)
  }
  const updateHourly = (day, hour, field, value) => {
    setHourlyTargets(prev => ({
      ...prev,
      [day]: { ...prev[day], [hour]: { ...prev[day][hour], [field]: Number(value) } },
    }))
  }

  const update = (day, field, value) => {
    setAllTargets(prev => prev.map(d =>
      d.day !== day ? d : { ...d, [field]: Number(value) }
    ))
  }

  const handleSave = async () => {
    if (!storeId) { setErrMsg('店舗IDが取得できません'); return }
    setSaving(true); setErrMsg('')
    try {
      // 1. 日別目標を保存
      await saveTargets({ storeId, year, month, targets: allTargets })
      // 2. 時間帯別売上パターンを settings JSONB にマージ保存
      const existing = (await loadSettings(storeId)) || {}
      await saveSettings(storeId, { ...existing, salesPatterns: patterns })
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      setErrMsg(e.message || '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }


  const totalSales     = targets.reduce((s, d) => s + d.sales, 0)
  const totalCust      = targets.reduce((s, d) => s + d.customers, 0)
  const totalOrders    = targets.reduce((s, d) => s + d.orders, 0)
  const totalLaborCost = targets.reduce((s, d) => s + (d.laborCost || 0), 0)
  const avgSpend       = totalCust > 0 ? Math.round((totalSales * 1000) / totalCust) : 0
  const { avgProductivity } = storeConfig
  const AVG_WAGE = 1050 // 円/h proxy for labor-hour calculation
  const laborRatio = (d) => d.sales > 0 ? ((d.laborCost || 0) / d.sales * 100).toFixed(1) : '—'
  const laborProd  = (d) => (d.laborCost || 0) > 0 ? Math.round(d.sales * AVG_WAGE / (d.laborCost || 1)) : '—'

  // 前半 / 後半全体の人件比率（ゲージ用）
  const avgLaborRatio = totalSales > 0 ? (totalLaborCost / totalSales * 100) : 0

  // 前月の同曜日平均（プレースホルダ用、最低限の準備）— 現状未配線だが将来利用
  // eslint-disable-next-line no-unused-vars
  const _prevMonthAvgByDow = useMemo(() => {
    const sums = {}, counts = {}
    for (const r of prevMonthTargets) {
      const dowIdx = (() => {
        const d = new Date(year, month - 2, r.day) // 前月
        return d.getDay()
      })()
      sums[dowIdx]   = (sums[dowIdx]   || 0) + (r.sales || 0)
      counts[dowIdx] = (counts[dowIdx] || 0) + 1
    }
    const out = {}
    for (const k of Object.keys(sums)) out[k] = Math.round(sums[k] / counts[k])
    return out
  }, [prevMonthTargets])

  const chartMeta = {
    sales:     { label: '売上(千円)', color: '#818cf8', getValue: d => d.sales },
    customers: { label: '客数(名)',   color: '#10b981', getValue: d => d.customers },
    avgSpend:  { label: '客単価(円)', color: '#f59e0b', getValue: d => d.avgSpend },
  }

  const halfLabel = half === 'first' ? '前半' : '後半'
  const halfDays  = Math.max(1, targets.length)
  const kpiCards = [
    { label: `${halfLabel} 売上目標合計`, value: `¥${totalSales.toLocaleString()}千`,  sub: `1日平均 ¥${Math.round(totalSales/halfDays).toLocaleString()}千`, bg:'bg-blue-50',   border:'border-blue-100',   val:'text-blue-800',   sub2:'text-blue-400' },
    { label: `${halfLabel} 客数目標`,     value: `${totalCust.toLocaleString()}名`,    sub: `1日平均 ${Math.round(totalCust/halfDays)}名`,                   bg:'bg-emerald-50', border:'border-emerald-100', val:'text-emerald-800', sub2:'text-emerald-400' },
    { label: '平均客単価',                value: `¥${avgSpend.toLocaleString()}`,      sub: `目標 ¥3,000`,                                                   bg:'bg-amber-50',   border:'border-amber-100',   val:'text-amber-800',  sub2:'text-amber-400' },
    { label: '注文数目標',                value: `${totalOrders.toLocaleString()}件`,  sub: `1日平均 ${Math.round(totalOrders/halfDays)}件`,                 bg:'bg-violet-50',  border:'border-violet-100',  val:'text-violet-800', sub2:'text-violet-400' },
  ]

  // 後半の最終日（28〜31日のいずれか）— ラベル用
  const lastDayOfMonth = allTargets.length || new Date(year, month, 0).getDate()

  return (
    <div className="mgr-page">
      {/* Header — タイトル + ダッシュボード上部と同じデザインの月選択 */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, gap:12, flexWrap:'wrap' }}>
        <div>
          <div style={{ fontSize:14, color:'var(--pita-muted)', fontWeight:500 }}>目標計画</div>
          <p style={{ fontSize:12, color:'#64748b', marginTop:4, marginBottom:0 }}>日別売上・客数・客単価の目標を設定します</p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8, flex:1, justifyContent:'center' }}>
          <button onClick={prevMonthNav} aria-label="前月"
            style={{ width:36, height:36, borderRadius:8, border:'1px solid var(--pita-border)', background:'white', fontSize:18, fontWeight:700, color:'#3730a3', cursor:'pointer', fontFamily:'inherit' }}>‹</button>
          <div style={{ minWidth:180, textAlign:'center', fontSize:20, fontWeight:700, color:'var(--pita-text)', letterSpacing:'-0.01em' }}>
            {yearMonthLabel}
          </div>
          <button onClick={nextMonthNav} aria-label="翌月"
            style={{ width:36, height:36, borderRadius:8, border:'1px solid var(--pita-border)', background:'white', fontSize:18, fontWeight:700, color:'#3730a3', cursor:'pointer', fontFamily:'inherit' }}>›</button>
        </div>
        <div>
          <div style={{ display:'flex', gap:6 }}>
            {[
              { k:'first',  l:`前半 (1〜15日)` },
              { k:'second', l:`後半 (16〜${lastDayOfMonth}日)` },
            ].map(o => (
              <button key={o.k} onClick={() => setHalf(o.k)} style={{
                padding:'5px 14px', borderRadius:18, fontSize:12, fontWeight: half === o.k ? 700 : 500,
                background: half === o.k ? '#4f46e5' : '#f0f5f9',
                color:      half === o.k ? 'white'   : '#475569',
                border:'none', cursor:'pointer', fontFamily:'inherit',
              }}>{o.l}</button>
            ))}
          </div>
        </div>
        {errMsg && (
          <div style={{ width:'100%', marginTop:6, padding:'10px 14px', background:'#FEE2E2', color:'#991B1B', border:'1px solid #FECACA', borderRadius:8, fontSize:13 }}>
            {errMsg}
          </div>
        )}
      </div>

      {/* KPI Cards — 売上 hero + その他 secondary + 人件比率ゲージ */}
      <div style={{
        display:'grid',
        gridTemplateColumns:'1.4fr 1fr 1fr 1fr 1.2fr',
        gap:12, marginBottom:20,
      }}>
        {kpiCards.map((k, i) => {
          const isHero = i === 0
          const palette = ['#eef2ff','#d1fae5','#fef3c7','#ede9fe']
          const borders = ['#c7d2fe','#a7f3d0','#fde68a','#ddd6fe']
          const texts   = ['#3730a3','#065f46','#92400e','#5b21b6']
          return (
            <div key={i} style={{
              background: palette[i],
              border: `1px solid ${borders[i]}`,
              borderRadius:12, padding: isHero ? '20px 22px' : '14px 16px',
              boxShadow:'0 1px 3px rgba(15,23,42,0.04)',
            }}>
              <div style={{ fontSize:11, color:'#64748b', marginBottom: isHero ? 8 : 4 }}>{k.label}</div>
              <div style={{ fontSize: isHero ? 30 : 19, fontWeight:800, lineHeight:1.15, color:texts[i], marginBottom:4 }}>{k.value}</div>
              <div style={{ fontSize:11, color:'#94a3b8' }}>{k.sub}</div>
            </div>
          )
        })}
        <LaborRatioGauge ratio={avgLaborRatio} band={laborBand} />
      </div>

      {/* Chart */}
      <div className="mgr-card" style={{ padding:'20px 20px 14px', marginBottom:20 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
          <h2 style={{ fontSize:14, fontWeight:600, color:'#0f172a', margin:0 }}>
            目標グラフ <span style={{ fontSize:12, fontWeight:400, color:'#94a3b8', marginLeft:4 }}>— 計画 vs 参考実績</span>
          </h2>
          <div style={{ display:'flex', gap:4 }}>
            {Object.entries(chartMeta).map(([key, m]) => (
              <button key={key} onClick={() => setActiveChart(key)}
                style={{
                  padding:'5px 12px', borderRadius:20, fontSize:12, fontWeight: activeChart === key ? 600 : 400,
                  background: activeChart === key ? '#0f172a' : '#f0f5f9',
                  color: activeChart === key ? 'white' : '#64748b',
                  border:'none', cursor:'pointer', fontFamily:'inherit', transition:'all 0.15s',
                }}>
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ height: activeChart === 'sales' ? 200 : 188 }}>
          {activeChart === 'sales'
            ? <SVGBarLineChart targets={targets} />
            : <SVGLineChart targets={targets} meta={chartMeta[activeChart]} />
          }
        </div>
        <div style={{ display:'flex', gap:20, fontSize:11, color:'#64748b', marginTop:4, paddingLeft:62 }}>
          {activeChart === 'sales' ? (
            <>
              <span style={{ display:'flex', alignItems:'center', gap:6 }}>
                <svg width="18" height="10" style={{ display:'block' }}><rect x="2" y="1" width="14" height="8" fill="#c7d2fe" rx="2" /></svg>
                計画（目標）
              </span>
              <span style={{ display:'flex', alignItems:'center', gap:6 }}>
                <svg width="20" height="10" style={{ display:'block' }}><line x1="0" y1="5" x2="20" y2="5" stroke="#10b981" strokeWidth="2" /><circle cx="10" cy="5" r="3" fill="white" stroke="#10b981" strokeWidth="2" /></svg>
                実績（参考）
              </span>
            </>
          ) : (
            <>
              <span style={{ display:'flex', alignItems:'center', gap:6 }}>
                <svg width="20" height="10" style={{ display:'block' }}><line x1="0" y1="5" x2="20" y2="5" stroke="#a5b4fc" strokeWidth="1.5" strokeDasharray="6 3" /></svg>
                計画
              </span>
              <span style={{ display:'flex', alignItems:'center', gap:6 }}>
                <svg width="20" height="10" style={{ display:'block' }}><line x1="0" y1="5" x2="20" y2="5" stroke="#10b981" strokeWidth="2" /><circle cx="10" cy="5" r="3" fill="white" stroke="#10b981" strokeWidth="2" /></svg>
                実績（参考）
              </span>
            </>
          )}
        </div>
      </div>

      {/* アクションバー: CSV / 保存（編集テーブルの直上） */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12, gap:8, flexWrap:'wrap' }}>
        <div style={{ fontSize:11.5, color:'#94a3b8', background:'white', border:'1px solid #dde5f0', borderRadius:8, padding:'8px 16px', overflowX:'auto', whiteSpace:'nowrap', flex:1, minWidth:0 }}>
          CSVフォーマット: <code style={{ background:'#f0f5f9', padding:'1px 5px', borderRadius:4, fontFamily:'monospace' }}>{TARGET_HEADER_COLS.join(',')}</code>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
          {csvMsg && <span style={{ fontSize:12, color: csvMsg.startsWith('✓') ? '#10b981' : '#ef4444' }}>{csvMsg}</span>}
          <button onClick={() => setShowCsvModal(true)} className="mgr-btn-secondary">
            CSV アップロード
          </button>
          <input ref={fileInputRef} type="file" accept=".csv" className="hidden"
            onChange={e => { setPendingCsvFile(e.target.files?.[0] || null); e.target.value = '' }} />
          <button onClick={handleSave} disabled={saving || !storeId} className="mgr-btn-primary">
            {saving ? '保存中…' : saved ? '✓ 保存しました' : '保存する'}
          </button>
        </div>
      </div>

      {/* Editable table */}
      <div className="mgr-card" style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, fontFamily:'inherit' }}>
          <thead>
            <tr style={{ background:'#e2e8f0', borderBottom:'1px solid #cbd5e1' }}>
              <th style={{ textAlign:'left', padding:'10px 16px', fontWeight:700, color:'#1e293b', minWidth:140, fontSize:12.5 }}>項目</th>
              {targets.map(d => (
                <th key={d.day} style={{
                  textAlign:'center', padding:'10px 8px', fontWeight:700, minWidth:66, fontSize:12.5,
                  color: (d.dow === '土' || d.dow === '日') ? '#be123c' : '#1e293b',
                  background: (d.dow === '土' || d.dow === '日') ? '#d1d5db' : '#e2e8f0',
                }}>
                  <div>{d.day}日</div>
                  <div style={{ fontSize:10, fontWeight:400 }}>{d.dow}</div>
                  <button onClick={() => openHourly(d.day)} style={{ fontSize:9, color:'#6366f1', background:'none', border:'none', cursor:'pointer', marginTop:2, padding:0, fontWeight:600 }}>📊詳細</button>
                </th>
              ))}
              <th style={{ textAlign:'center', padding:'10px 12px', fontWeight:700, color:'white', background:'#94a3b8', minWidth:80, fontSize:12.5 }}>合計/平均</th>
            </tr>
          </thead>
          <tbody>
            {FIELDS.map(({ key, label, unit, color }) => (
              <tr key={key} style={{ borderBottom:'1px solid #f0f5f9' }}>
                <td style={{ padding:'9px 16px', fontWeight:500, color:'#334155', fontSize:13 }}>{label}</td>
                {targets.map(d => (
                  <td key={d.day} style={{
                    textAlign:'center', padding:'6px 4px',
                    background: 'white',
                  }}>
                    {editingCell?.day === d.day && editingCell?.field === key ? (
                      <input type="number" defaultValue={d[key]} autoFocus
                        style={{ width:'100%', textAlign:'center', border:'2px solid #4f46e5', borderRadius:4, padding:'4px', fontSize:12, outline:'none', fontFamily:'inherit', background:'#f5f3ff', color:'#3730a3' }}
                        onBlur={e => { update(d.day, key, e.target.value); setEditingCell(null) }}
                        onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }} />
                    ) : (
                      <button onClick={() => setEditingCell({ day: d.day, field: key })}
                        style={{
                          width:'100%', fontSize:12, fontWeight:600, border:'none', borderRadius:4,
                          padding:'4px', cursor:'pointer', background:'transparent', color:'#0f172a',
                          fontFamily:'inherit', transition:'background 0.1s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background='#e0e7ff'}
                        onMouseLeave={e => e.currentTarget.style.background='transparent'}
                      >
                        {key === 'avgSpend' ? `¥${d[key].toLocaleString()}` : d[key].toLocaleString()}
                        <span style={{ fontSize:10, fontWeight:400, color:'#94a3b8', marginLeft:2 }}>{unit}</span>
                      </button>
                    )}
                  </td>
                ))}
                <td style={{ textAlign:'center', padding:'8px 12px', background:'#e8edf4', fontWeight:700, color:'#1e293b', fontSize:13 }}>
                  {key === 'avgSpend'   ? `¥${avgSpend.toLocaleString()}`
                    : key === 'sales'   ? `${totalSales.toLocaleString()}千`
                    : key === 'customers' ? `${totalCust.toLocaleString()}`
                    : key === 'laborCost' ? `${totalLaborCost.toLocaleString()}千`
                    : targets.reduce((s, d) => s + d[key], 0).toLocaleString()}
                </td>
              </tr>
            ))}

            {/* 人件比率 row */}
            <tr style={{ borderBottom:'1px solid #e2e8f0', background:'#f8fafc' }}>
              <td style={{ padding:'9px 16px', fontWeight:600, color:'#475569', fontSize:12 }}>
                <div>人件比率</div>
                <div style={{ fontWeight:400, color:'#94a3b8', fontSize:10 }}>人件費 ÷ 売上</div>
              </td>
              {targets.map(d => (
                <td key={d.day} style={{ textAlign:'center', padding:'6px 4px', background: d.isWeekend ? '#f1f5f9' : '#f8fafc' }}>
                  <div style={{ fontSize:12, fontWeight:600, color: (d.laborCost||0)/d.sales > 0.35 ? '#dc2626' : '#334155' }}>
                    {laborRatio(d)}%
                  </div>
                </td>
              ))}
              <td style={{ textAlign:'center', padding:'8px 12px', background:'#e8edf4', fontWeight:700, color:'#1e293b', fontSize:12 }}>
                {totalSales > 0 ? (totalLaborCost / totalSales * 100).toFixed(1) : '—'}%
              </td>
            </tr>

            {/* 人時生産性 row */}
            <tr style={{ borderBottom:'1px solid #cbd5e1', background:'#f8fafc' }}>
              <td style={{ padding:'9px 16px', fontWeight:600, color:'#475569', fontSize:12 }}>
                <div>人時生産性</div>
                <div style={{ fontWeight:400, color:'#94a3b8', fontSize:10 }}>売上 ÷ 総労働h</div>
              </td>
              {targets.map(d => (
                <td key={d.day} style={{ textAlign:'center', padding:'6px 4px', background: d.isWeekend ? '#f1f5f9' : '#f8fafc' }}>
                  <div style={{ fontSize:12, fontWeight:600, color:'#334155' }}>
                    {(d.laborCost||0) > 0 ? `¥${laborProd(d).toLocaleString()}` : '—'}
                  </div>
                </td>
              ))}
              <td style={{ textAlign:'center', padding:'8px 12px', background:'#e8edf4', fontWeight:700, color:'#1e293b', fontSize:12 }}>
                {totalLaborCost > 0 ? `¥${Math.round(totalSales * AVG_WAGE / totalLaborCost).toLocaleString()}` : '—'}
              </td>
            </tr>

            {/* Required staff row */}
            <tr style={{ borderBottom:'1px solid #cbd5e1', background:'#f1f5f9' }}>
              <td style={{ padding:'9px 16px', fontWeight:700, color:'#1e293b', fontSize:13 }}>
                <div>必要人員数（推定）</div>
                <div style={{ fontWeight:400, color:'#64748b', fontSize:10, marginTop:2 }}>ピーク最大 / 平均</div>
              </td>
              {targets.map(d => {
                const peak = calcDayPeakStaff(d.orders, avgProductivity)
                const avg = calcDayAvgStaff(d.orders, avgProductivity)
                return (
                  <td key={d.day} style={{ textAlign:'center', padding:'6px 4px', background: d.isWeekend ? '#e2e8f0' : '#f1f5f9' }}>
                    <div style={{ fontSize:13, fontWeight:700, color:'#1e293b' }}>{peak}<span style={{ fontSize:10, fontWeight:400, marginLeft:1 }}>名</span></div>
                    <div style={{ fontSize:10, color:'#64748b' }}>avg {avg}</div>
                  </td>
                )
              })}
              <td style={{ textAlign:'center', padding:'8px 12px', background:'#e2e8f0', fontWeight:700, color:'#1e293b', fontSize:13 }}>
                {Math.round(targets.reduce((s, d) => s + calcDayPeakStaff(d.orders, avgProductivity), 0) / targets.length)}
                <span style={{ fontSize:10, fontWeight:400, marginLeft:2 }}>名/日avg</span>
              </td>
            </tr>
          </tbody>
        </table>
        <div style={{ padding:'8px 16px', fontSize:11, color:'#94a3b8' }}>
          ※ セルをクリックして直接編集できます。必要人員は注文数÷時間生産性({avgProductivity}件/h)で推定。列ヘッダの📊詳細で時間帯別入力が可能です。
        </div>
      </div>

      {/* ── 時間帯別売上パターン ── */}
      <div className="mgr-card" style={{ padding:'20px 20px 14px', marginTop:24 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, gap:12, flexWrap:'wrap' }}>
          <div>
            <h2 style={{ fontSize:14, fontWeight:600, color:'#0f172a', margin:0 }}>時間帯別売上パターン</h2>
            <p style={{ fontSize:11, color:'#94a3b8', marginTop:4, marginBottom:0 }}>5パターンの時間帯別売上を設定。シフト決定で各日にどのパターンを使うかを選択できます。</p>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            {patternCsvMsg && <span style={{ fontSize:12, color: patternCsvMsg.startsWith('✓') ? '#10b981' : '#ef4444' }}>{patternCsvMsg}</span>}
            <button onClick={() => setShowPatternCsvModal(true)} className="mgr-btn-secondary">
              CSV / Excel アップロード
            </button>
            <input ref={patternFileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
              onChange={e => { setPendingPatternCsvFile(e.target.files?.[0] || null); e.target.value = '' }} />
          </div>
        </div>
        <div style={{ display:'flex', gap:6, marginBottom:14, flexWrap:'wrap' }}>
          {Object.entries(patterns).map(([key, p]) => (
            <button key={key} onClick={() => setActivePattern(key)}
              style={{
                padding:'7px 16px', borderRadius:20, fontSize:12, fontWeight: activePattern === key ? 700 : 500,
                background: activePattern === key ? '#4f46e5' : '#f0f5f9',
                color: activePattern === key ? 'white' : '#475569',
                border:'none', cursor:'pointer', fontFamily:'inherit', transition:'all 0.15s',
              }}>
              {p.label}
              <span style={{ marginLeft:6, fontSize:10, opacity:0.85 }}>¥{patternTotal(key).toLocaleString()}</span>
            </button>
          ))}
        </div>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, fontFamily:'inherit' }}>
            <thead>
              <tr style={{ background:'#e2e8f0', borderBottom:'1px solid #cbd5e1' }}>
                <th style={{ textAlign:'left', padding:'8px 12px', fontWeight:700, color:'#1e293b', minWidth:110, fontSize:12 }}>項目</th>
                {PATTERN_HOURS.map(h => (
                  <th key={h} style={{ textAlign:'center', padding:'8px 4px', fontWeight:700, color:'#1e293b', minWidth:60, fontSize:11.5 }}>{h}:00</th>
                ))}
                <th style={{ textAlign:'center', padding:'8px 12px', fontWeight:700, color:'white', background:'#94a3b8', minWidth:80, fontSize:12 }}>合計</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom:'1px solid #f0f5f9' }}>
                <td style={{ padding:'9px 12px', fontWeight:600, color:'#334155', fontSize:12.5 }}>売上 (円)</td>
                {PATTERN_HOURS.map(h => {
                  const v = patterns[activePattern]?.hourlySales[h] ?? 0
                  return (
                    <td key={h} style={{ textAlign:'center', padding:'4px 2px', background:'white' }}>
                      <input type="number" value={v}
                        onChange={e => updatePatternHour(activePattern, h, e.target.value)}
                        style={{ width:54, textAlign:'center', border:'1px solid #dde5f0', borderRadius:4, padding:'4px 4px', fontSize:11, outline:'none', fontFamily:'inherit' }}
                        onFocus={e => e.target.style.borderColor='#4f46e5'}
                        onBlur={e => e.target.style.borderColor='#dde5f0'} />
                    </td>
                  )
                })}
                <td style={{ textAlign:'center', padding:'8px 12px', background:'#e8edf4', fontWeight:700, color:'#1e293b', fontSize:13 }}>
                  ¥{patternTotal(activePattern).toLocaleString()}
                </td>
              </tr>
              <tr style={{ borderBottom:'1px solid #f0f5f9', background:'#f8fafc' }}>
                <td style={{ padding:'9px 12px', fontWeight:600, color:'#475569', fontSize:12 }}>構成比 (%)</td>
                {PATTERN_HOURS.map(h => {
                  const tot = patternTotal(activePattern) || 1
                  const v = patterns[activePattern]?.hourlySales[h] ?? 0
                  return (
                    <td key={h} style={{ textAlign:'center', padding:'6px 4px', background:'#f8fafc', fontSize:11, color:'#64748b' }}>
                      {(v / tot * 100).toFixed(1)}%
                    </td>
                  )
                })}
                <td style={{ textAlign:'center', padding:'8px 12px', background:'#e8edf4', fontWeight:700, color:'#1e293b', fontSize:12 }}>100.0%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Hourly breakdown modal ── */}
      {hourlyExpand !== null && (() => {
        const d = targets.find(t => t.day === hourlyExpand)
        const hData = hourlyTargets[hourlyExpand] || {}
        const totSales = HOURS_LIST.reduce((s, h) => s + (hData[h]?.sales || 0), 0)
        const totLabor = HOURS_LIST.reduce((s, h) => s + (hData[h]?.laborCost || 0), 0)
        return (
          <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.45)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
            <div style={{ background:'white', borderRadius:16, width:'100%', maxWidth:560, maxHeight:'85vh', display:'flex', flexDirection:'column', boxShadow:'0 20px 60px rgba(15,23,42,0.18)' }}>
              <div style={{ display:'flex', alignItems:'center', padding:'16px 20px', borderBottom:'1px solid #e2e8f0' }}>
                <div>
                  <div style={{ fontSize:16, fontWeight:700, color:'#0f172a' }}>{d.day}日({d.dow}) 時間帯別目標</div>
                  <div style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>各時間帯の売上・人件費を入力できます</div>
                </div>
                <button onClick={() => setHourlyExpand(null)} style={{ marginLeft:'auto', background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#94a3b8', lineHeight:1 }}>✕</button>
              </div>
              <div style={{ overflowY:'auto', padding:'12px 20px' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                  <thead>
                    <tr style={{ background:'#e2e8f0' }}>
                      {['時間帯','売上目標(千円)','人件費目標(千円)','人件比率','人時生産性'].map(h => (
                        <th key={h} style={{ padding:'8px 10px', fontWeight:700, color:'#1e293b', textAlign:'center', whiteSpace:'nowrap', borderBottom:'1px solid #cbd5e1' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {HOURS_LIST.map(h => {
                      const row = hData[h] || { sales: 0, laborCost: 0 }
                      const ratio = row.sales > 0 ? (row.laborCost / row.sales * 100).toFixed(1) : '—'
                      const prod  = row.laborCost > 0 ? `¥${Math.round(row.sales * AVG_WAGE / row.laborCost).toLocaleString()}` : '—'
                      return (
                        <tr key={h} style={{ borderBottom:'1px solid #f1f5f9' }}>
                          <td style={{ padding:'7px 10px', fontWeight:600, color:'#334155', textAlign:'center' }}>{h}:00</td>
                          {(['sales','laborCost'] ).map(field => (
                            <td key={field} style={{ padding:'5px 8px', textAlign:'center' }}>
                              <input type="number" value={row[field]}
                                onChange={e => updateHourly(hourlyExpand, h, field, e.target.value)}
                                style={{ width:80, textAlign:'center', border:'1px solid #dde5f0', borderRadius:6, padding:'4px 6px', fontSize:12, outline:'none', fontFamily:'inherit' }}
                                onFocus={e => e.target.style.borderColor='#4f46e5'}
                                onBlur={e => e.target.style.borderColor='#dde5f0'}
                              />
                            </td>
                          ))}
                          <td style={{ padding:'7px 10px', textAlign:'center', fontWeight:600, color: parseFloat(ratio) > 35 ? '#dc2626' : '#334155' }}>{ratio}{ratio !== '—' ? '%' : ''}</td>
                          <td style={{ padding:'7px 10px', textAlign:'center', fontWeight:600, color:'#334155' }}>{prod}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background:'#e8edf4', borderTop:'2px solid #cbd5e1' }}>
                      <td style={{ padding:'8px 10px', fontWeight:700, color:'#1e293b' }}>合計</td>
                      <td style={{ padding:'8px 10px', fontWeight:700, color:'#1e293b', textAlign:'center' }}>{totSales}</td>
                      <td style={{ padding:'8px 10px', fontWeight:700, color:'#1e293b', textAlign:'center' }}>{totLabor}</td>
                      <td style={{ padding:'8px 10px', fontWeight:700, color:'#1e293b', textAlign:'center' }}>{totSales > 0 ? (totLabor / totSales * 100).toFixed(1) : '—'}{totSales > 0 ? '%' : ''}</td>
                      <td style={{ padding:'8px 10px', fontWeight:700, color:'#1e293b', textAlign:'center' }}>{totLabor > 0 ? `¥${Math.round(totSales * AVG_WAGE / totLabor).toLocaleString()}` : '—'}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div style={{ padding:'12px 20px', borderTop:'1px solid #e2e8f0', display:'flex', justifyContent:'flex-end', gap:8 }}>
                <button onClick={() => setHourlyExpand(null)} style={{ padding:'8px 20px', borderRadius:8, border:'1px solid #dde5f0', background:'white', color:'#475569', fontSize:13, fontWeight:600, cursor:'pointer' }}>閉じる</button>
                <button onClick={() => setHourlyExpand(null)} style={{ padding:'8px 20px', borderRadius:8, border:'none', background:'#4f46e5', color:'white', fontSize:13, fontWeight:600, cursor:'pointer' }}>保存</button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── CSV Upload Modal ── */}
      {showCsvModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.45)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'white', borderRadius:16, width:'100%', maxWidth:460, boxShadow:'0 20px 60px rgba(15,23,42,0.18)' }}>
            <div style={{ padding:'20px 24px', borderBottom:'1px solid #e2e8f0', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div>
                <div style={{ fontSize:17, fontWeight:700, color:'#0f172a' }}>CSV アップロード</div>
                <div style={{ fontSize:12, color:'#64748b', marginTop:3 }}>目標データをCSVファイルから読み込みます</div>
              </div>
              <button onClick={() => setShowCsvModal(false)} style={{ fontSize:20, lineHeight:1, background:'none', border:'none', cursor:'pointer', color:'#94a3b8' }}>×</button>
            </div>
            <div style={{ padding:'20px 24px', display:'flex', flexDirection:'column', gap:18 }}>
              {/* Format download */}
              <div style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:12, padding:'14px 16px' }}>
                <div style={{ fontSize:13, fontWeight:600, color:'#334155', marginBottom:4 }}>① フォーマットをダウンロード</div>
                <div style={{ fontSize:11, color:'#64748b', marginBottom:10, lineHeight:1.6, wordBreak:'break-all' }}>
                  CSVの形式: <code style={{ background:'#e8edf4', padding:'1px 5px', borderRadius:4 }}>{TARGET_HEADER_COLS.join(',')}</code>
                  <div style={{ marginTop:4, fontSize:10.5, color:'#94a3b8' }}>※ 人件比率・人時生産性は計算項目のため自動的に再計算されます</div>
                </div>
                <button onClick={downloadCsvFormat} style={{
                  display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:8,
                  border:'1px solid #4f46e5', background:'white', color:'#4f46e5',
                  fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
                }}>
                  ↓ フォーマットをダウンロード
                </button>
              </div>
              {/* File picker */}
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:'#334155', marginBottom:8 }}>② CSVファイルを選択</div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <button onClick={() => fileInputRef.current?.click()} style={{
                    padding:'8px 16px', borderRadius:8, border:'1px solid #dde5f0',
                    background:'#f8fafc', color:'#475569', fontSize:13, fontWeight:600,
                    cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap',
                  }}>
                    ファイルを選択
                  </button>
                  <span style={{ fontSize:12, color: pendingCsvFile ? '#0f172a' : '#94a3b8', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {pendingCsvFile ? pendingCsvFile.name : 'ファイルが選択されていません'}
                  </span>
                </div>
              </div>
            </div>
            <div style={{ padding:'14px 24px', borderTop:'1px solid #e2e8f0', display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button onClick={() => { setShowCsvModal(false); setPendingCsvFile(null) }} style={{
                padding:'9px 18px', borderRadius:8, border:'1px solid #dde5f0', background:'white',
                color:'#475569', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
              }}>キャンセル</button>
              <button onClick={executeCsvUpload} disabled={!pendingCsvFile} style={{
                padding:'9px 18px', borderRadius:8, border:'none',
                background: pendingCsvFile ? '#4f46e5' : '#c7d2fe',
                color:'white', fontSize:13, fontWeight:600,
                cursor: pendingCsvFile ? 'pointer' : 'not-allowed', fontFamily:'inherit',
              }}>アップロードを実行</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Pattern CSV Upload Modal ── */}
      {showPatternCsvModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.45)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'white', borderRadius:16, width:'100%', maxWidth:520, boxShadow:'0 20px 60px rgba(15,23,42,0.18)' }}>
            <div style={{ padding:'20px 24px', borderBottom:'1px solid #e2e8f0', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div>
                <div style={{ fontSize:17, fontWeight:700, color:'#0f172a' }}>時間帯別売上パターン CSV / Excel アップロード</div>
                <div style={{ fontSize:12, color:'#64748b', marginTop:3 }}>CSV、またはピタシフ Excel (ﾃﾞｰﾀ入力シート) から時間帯別売上を読み込みます</div>
              </div>
              <button onClick={() => setShowPatternCsvModal(false)} style={{ fontSize:20, lineHeight:1, background:'none', border:'none', cursor:'pointer', color:'#94a3b8' }}>×</button>
            </div>
            <div style={{ padding:'20px 24px', display:'flex', flexDirection:'column', gap:18 }}>
              {/* Format download */}
              <div style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:12, padding:'14px 16px' }}>
                <div style={{ fontSize:13, fontWeight:600, color:'#334155', marginBottom:4 }}>① フォーマットをダウンロード</div>
                <div style={{ fontSize:11, color:'#64748b', marginBottom:10, lineHeight:1.6, wordBreak:'break-all' }}>
                  CSVの形式: <code style={{ background:'#e8edf4', padding:'1px 5px', borderRadius:4 }}>パターン,項目,9:00,10:00,…,22:00,合計</code>
                  <div style={{ marginTop:4, fontSize:10.5, color:'#94a3b8' }}>
                    1カラム目はパターン名（平日①/平日②/金曜/土曜/日祝）。<br />
                    各パターンに「売上(円)」「構成比(%)」の2行が並びます。<br />
                    ※ 構成比は計算項目のため自動的に再計算されます
                  </div>
                  <div style={{ marginTop:6, fontSize:10.5, color:'#4f46e5' }}>
                    <strong>Excel (.xlsx) もそのままアップロード可</strong>: 「ﾃﾞｰﾀ入力」シートの時間帯別売上 (K/N/Q/T/W 列) から最大5パターンを取り込みます。
                  </div>
                </div>
                <button onClick={downloadPatternCsvFormat} style={{
                  display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:8,
                  border:'1px solid #4f46e5', background:'white', color:'#4f46e5',
                  fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
                }}>
                  ↓ フォーマットをダウンロード
                </button>
              </div>
              {/* File picker */}
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:'#334155', marginBottom:8 }}>② CSV / Excel ファイルを選択</div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <button onClick={() => patternFileInputRef.current?.click()} style={{
                    padding:'8px 16px', borderRadius:8, border:'1px solid #dde5f0',
                    background:'#f8fafc', color:'#475569', fontSize:13, fontWeight:600,
                    cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap',
                  }}>
                    ファイルを選択
                  </button>
                  <span style={{ fontSize:12, color: pendingPatternCsvFile ? '#0f172a' : '#94a3b8', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {pendingPatternCsvFile ? pendingPatternCsvFile.name : 'ファイルが選択されていません'}
                  </span>
                </div>
              </div>
            </div>
            <div style={{ padding:'14px 24px', borderTop:'1px solid #e2e8f0', display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button onClick={() => { setShowPatternCsvModal(false); setPendingPatternCsvFile(null) }} style={{
                padding:'9px 18px', borderRadius:8, border:'1px solid #dde5f0', background:'white',
                color:'#475569', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
              }}>キャンセル</button>
              <button onClick={executePatternUpload} disabled={!pendingPatternCsvFile} style={{
                padding:'9px 18px', borderRadius:8, border:'none',
                background: pendingPatternCsvFile ? '#4f46e5' : '#c7d2fe',
                color:'white', fontSize:13, fontWeight:600,
                cursor: pendingPatternCsvFile ? 'pointer' : 'not-allowed', fontFamily:'inherit',
              }}>アップロードを実行</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
