import { useState } from 'react'
import { Link } from 'react-router-dom'
import { sukimaJobs } from '../../data/mockData'
import EmployeeTabBar from '../../components/EmployeeTabBar'

const DAYS_JP = ['日','月','火','水','木','金','土']
const TODAY = new Date('2026-04-21')
const DATES = Array.from({ length: 7 }, (_, i) => {
  const d = new Date(TODAY); d.setDate(TODAY.getDate() + i)
  return { d, dayNum: d.getDate(), dow: DAYS_JP[d.getDay()], dateStr: d.toISOString().slice(0,10), isSat: d.getDay()===6, isSun: d.getDay()===0 }
})

const FILTER_OPTS = [
  { key:'role',    icon:'💼', label:'職種',   options:['すべて','バリスタ','ホールスタッフ','キッチンスタッフ','フロアスタッフ'] },
  { key:'pay',     icon:'¥',  label:'報酬',   options:['指定なし','¥1,100以上','¥1,200以上','¥1,300以上'] },
  { key:'time',    icon:'🕐', label:'時間帯', options:['指定なし','午前（〜12:00）','午後（12:00〜17:00）','夜（17:00〜）'] },
  { key:'benefit', icon:'✦',  label:'待遇',   options:['指定なし','交通費あり','未経験OK'] },
]
const DEFAULT_FILTERS = { role:'すべて', pay:'指定なし', time:'指定なし', benefit:'指定なし' }
const MAP_POS = { 1:{x:35,y:62}, 2:{x:48,y:40}, 3:{x:44,y:52}, 4:{x:65,y:50}, 5:{x:38,y:57}, 6:{x:52,y:25}, 7:{x:42,y:58} }

function deadlineLabel(h) {
  if (h >= 24) return `あと${Math.floor(h/24)}日で締め切り`
  return `あと${Math.floor(h)}時間${Math.round((h%1)*60)>0?`${Math.round((h%1)*60)}分`:''}で締め切り`
}

const IconSliders = () => (
  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="3" y1="5" x2="17" y2="5"/>
    <circle cx="13" cy="5" r="2.5" fill="white" stroke="currentColor" strokeWidth="2"/>
    <line x1="3" y1="10" x2="17" y2="10"/>
    <circle cx="7" cy="10" r="2.5" fill="white" stroke="currentColor" strokeWidth="2"/>
    <line x1="3" y1="15" x2="17" y2="15"/>
    <circle cx="11" cy="15" r="2.5" fill="white" stroke="currentColor" strokeWidth="2"/>
  </svg>
)

export default function SukimaTop() {
  const [selDate, setSelDate]             = useState(0)
  const [showFilter, setShowFilter]       = useState(false)
  const [showMap, setShowMap]             = useState(false)
  const [showCondition, setShowCondition] = useState(false)
  const [filters, setFilters]             = useState(DEFAULT_FILTERS)
  const [filterIdx, setFilterIdx]         = useState({})
  const [notifOn, setNotifOn]             = useState(false)
  const [search, setSearch]               = useState('')
  const [cond, setCond]                   = useState({ minWage: '', maxDist: '', minHours: '', maxHours: '' })

  const dt    = DATES[selDate]
  const label = `${dt.d.getFullYear()}年${dt.d.getMonth()+1}月${dt.dayNum}日`

  const dayJobs = sukimaJobs.filter(j => j.date === dt.dateStr).filter(j => {
    if (filters.role !== 'すべて' && j.role !== filters.role) return false
    if (filters.pay !== '指定なし' && j.wage < parseInt(filters.pay.replace(/[^0-9]/g,''))) return false
    if (search && !j.store.includes(search) && !j.role.includes(search)) return false
    return true
  })

  const cycleFilter = (key) => {
    const opt = FILTER_OPTS.find(o => o.key === key)
    const idx = ((filterIdx[key] || 0) + 1) % opt.options.length
    setFilterIdx(p => ({...p, [key]: idx}))
    setFilters(p => ({...p, [key]: opt.options[idx]}))
  }

  if (showMap) return (
    <>
      <div className="pita-phone-header">
        <button onClick={() => setShowMap(false)} style={{ fontSize:12, color:'var(--pita-accent)', background:'none', border:'none', cursor:'pointer', fontWeight:600 }}>← 一覧</button>
        <div style={{ flex:1, textAlign:'center', fontSize:13, fontWeight:700, color:'var(--pita-text)' }}>{label} の募集</div>
        <div style={{ width:48 }} />
      </div>
      <div className="pita-phone-body" style={{ position:'relative' }}>
        <svg viewBox="0 0 100 80" style={{ width:'100%', display:'block', background:'#d4dde8' }}>
          {[20,40,60,80].map(v => <line key={`h${v}`} x1={0} y1={v*0.8} x2={100} y2={v*0.8} stroke="white" strokeWidth="1.2" />)}
          {[20,40,60,80].map(v => <line key={`v${v}`} x1={v} y1={0} x2={v} y2={80} stroke="white" strokeWidth="0.8" />)}
          <rect x={8}  y={6}  width={22} height={14} fill="#c8d5c8" rx="1" />
          <rect x={38} y={22} width={16} height={12} fill="#c8d5c8" rx="1" />
          <rect x={60} y={32} width={18} height={12} fill="#c8d5c8" rx="1" />
          {dayJobs.map(j => { const p = MAP_POS[j.id]||{x:50,y:50}; return (
            <g key={j.id}>
              <circle cx={p.x} cy={p.y*0.8} r="4" fill="#ef4444" stroke="white" strokeWidth="1" />
              <circle cx={p.x} cy={p.y*0.8} r="1.2" fill="white" />
              <text x={p.x+5} y={p.y*0.8+2.5} fontSize="3" fill="#1f2937" fontWeight="600">{j.store}</text>
            </g>
          )})}
        </svg>
        <div style={{ padding:'8px 10px', display:'flex', flexDirection:'column', gap:5 }}>
          {dayJobs.map(j => (
            <Link key={j.id} to={`/employee-ver2/sukima/${j.id}`} style={{ textDecoration:'none' }}>
              <div style={{ background:'white', borderRadius:10, padding:'8px 10px', display:'flex', alignItems:'center', gap:8, boxShadow:'0 2px 8px rgba(0,0,0,0.08)' }}>
                <div style={{ width:32, height:32, borderRadius:8, background:j.bgColor, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>{j.emoji}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#1f2937' }}>{j.store}：{j.role}</div>
                  <div style={{ fontSize:10, color:'#6b7280' }}>¥{j.wage.toLocaleString()} · {j.startTime}〜{j.endTime}</div>
                </div>
                <div style={{ fontSize:10, color:'#ef4444', fontWeight:600 }}>{j.filled}/{j.total}人</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
      <EmployeeTabBar base="/employee-ver2" active="sukima" sukima={true} />
    </>
  )

  if (showFilter) return (
    <>
      <div style={{ padding:'12px 14px', display:'flex', alignItems:'center', background:'var(--pita-panel)', borderBottom:'1px solid var(--pita-border)', flexShrink:0 }}>
        <button onClick={() => setShowFilter(false)} style={{ width:32, height:32, borderRadius:'50%', border:'1px solid #e5e7eb', background:'white', fontSize:16, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
        <div style={{ flex:1 }} />
        <button onClick={() => { setFilters(DEFAULT_FILTERS); setFilterIdx({}) }} style={{ fontSize:12, color:'#5B67F8', background:'none', border:'none', cursor:'pointer', fontWeight:600 }}>すべて解除</button>
      </div>
      <div style={{ flex:1, overflow:'auto', background:'var(--pita-bg)' }}>
        {FILTER_OPTS.map(opt => (
          <button key={opt.key} onClick={() => cycleFilter(opt.key)} style={{ width:'100%', display:'flex', alignItems:'center', gap:16, padding:'16px 20px', background:'white', border:'none', borderBottom:'1px solid #f3f4f6', cursor:'pointer', textAlign:'left' }}>
            <div style={{ width:28, textAlign:'center', fontSize:18, color:'#374151', flexShrink:0 }}>{opt.icon}</div>
            <div style={{ fontSize:13, color:'#374151', flex:1 }}>{opt.label}</div>
            <div style={{ fontSize:13, color: filters[opt.key] === opt.options[0] ? '#9ca3af' : '#1f2937', fontWeight: filters[opt.key] !== opt.options[0] ? 600 : 400 }}>{filters[opt.key]}</div>
            <div style={{ color:'#9ca3af', fontSize:18 }}>›</div>
          </button>
        ))}
      </div>
      <div style={{ padding:'12px 14px', background:'var(--pita-panel)', flexShrink:0 }}>
        <button onClick={() => setShowFilter(false)} style={{ width:'100%', padding:'14px 0', borderRadius:10, border:'none', background:'#5B67F8', color:'white', fontSize:14, fontWeight:700, cursor:'pointer' }}>
          絞り込み結果を表示
        </button>
      </div>
    </>
  )

  return (
    <>
      <div style={{ padding:'10px 14px', display:'flex', alignItems:'center', justifyContent:'space-between', background:'white', borderBottom:'1px solid #f3f4f6', flexShrink:0 }}>
        <button onClick={() => setShowCondition(true)} style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 16px', borderRadius:20, border:'none', background:'#5B67F8', fontSize:12, fontWeight:700, cursor:'pointer', color:'white' }}>条件登録</button>
        <button onClick={() => setShowFilter(true)} style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 12px', borderRadius:20, border:'1px solid #e5e7eb', background:'white', fontSize:12, cursor:'pointer', color:'#374151' }}>
          <IconSliders /> 絞り込み
        </button>
      </div>
      <div style={{ padding:'8px 14px', background:'#f9fafb', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, background:'white', borderRadius:22, padding:'8px 14px', border:'1px solid #e5e7eb' }}>
          <span style={{ color:'#9ca3af' }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="キーワードで検索" style={{ flex:1, border:'none', outline:'none', fontSize:13, color:'#374151', background:'none' }} />
        </div>
      </div>
      <div style={{ display:'flex', gap:6, padding:'8px 14px', overflowX:'auto', flexShrink:0, background:'white', msOverflowStyle:'none', scrollbarWidth:'none' }}>
        {DATES.map((d, i) => (
          <button key={i} onClick={() => setSelDate(i)} style={{ flexShrink:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', width:52, height:58, borderRadius:12, border: i===selDate ? 'none' : '1px solid #e5e7eb', background: i===selDate ? '#facc15' : 'white', cursor:'pointer', padding:0 }}>
            {i === 0 ? (<><span style={{ fontSize:9, color: i===selDate ? '#78350f' : '#6b7280', fontWeight:600 }}>今日</span><span style={{ fontSize:20, fontWeight:700, lineHeight:1.1, color: i===selDate ? '#78350f' : '#1f2937' }}>{d.dayNum}</span><span style={{ fontSize:9, color: i===selDate ? '#78350f' : '#6b7280' }}>{d.dow}</span></>)
            : (<><span style={{ fontSize:20, fontWeight:700, lineHeight:1.1, color: d.isSun ? '#ef4444' : d.isSat ? '#5B67F8' : '#1f2937' }}>{d.dayNum}</span><span style={{ fontSize:9, color: d.isSun ? '#ef4444' : d.isSat ? '#5B67F8' : '#6b7280' }}>{d.dow}</span></>)}
          </button>
        ))}
      </div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 14px', background:'white', borderTop:'1px solid #f3f4f6', borderBottom:'1px solid #f3f4f6', flexShrink:0 }}>
        <button style={{ display:'flex', alignItems:'center', gap:4, background:'none', border:'none', cursor:'pointer', fontSize:12, color:'#374151' }}>⇕ 現在地から近い順 <span style={{ color:'#9ca3af' }}>▼</span></button>
        <button onClick={() => setShowMap(true)} style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 12px', borderRadius:20, border:'1px solid #e5e7eb', background:'white', fontSize:12, cursor:'pointer', color:'#374151' }}>🗺 マップ</button>
      </div>
      <div className="pita-phone-body">
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px 6px' }}>
          <span style={{ fontSize:12, fontWeight:600, color:'#1f2937' }}>{label}</span>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ fontSize:9, color:'#9ca3af' }}>この日の新しい募集を通知</span>
            <button onClick={() => setNotifOn(v => !v)} style={{ padding:'3px 10px', borderRadius:12, border:'1px solid #e5e7eb', background: notifOn ? '#5B67F8' : 'white', color: notifOn ? 'white' : '#374151', fontSize:10, fontWeight:600, cursor:'pointer' }}>{notifOn ? 'ON' : 'OFF'}</button>
          </div>
        </div>
        <div style={{ padding:'0 10px 10px' }}>
          {dayJobs.length === 0 && <div style={{ textAlign:'center', padding:'40px 0', color:'#9ca3af', fontSize:12 }}>この日の募集はありません</div>}
          {dayJobs.map(j => (
            <Link key={j.id} to={`/employee-ver2/sukima/${j.id}`} style={{ textDecoration:'none', display:'block', marginBottom:8 }}>
              <div style={{ background:'white', borderRadius:12, border:'1px solid #e5e7eb', overflow:'hidden', display:'flex' }}>
                <div style={{ width:88, flexShrink:0, background:j.bgColor, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', position:'relative', minHeight:100 }}>
                  <span style={{ fontSize:30 }}>{j.emoji}</span>
                  <div style={{ position:'absolute', top:6, left:6, background:'#ef4444', color:'white', fontSize:8, fontWeight:700, padding:'2px 5px', borderRadius:4 }}>⏰ あと {Math.floor(j.deadlineHours)}h{Math.round((j.deadlineHours%1)*60)>0?`${Math.round((j.deadlineHours%1)*60)}m`:''}</div>
                </div>
                <div style={{ flex:1, padding:'10px 10px 8px' }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'#1f2937', marginBottom:2 }}>{j.store}：{j.role}</div>
                  <div style={{ fontSize:14, fontWeight:800, color:'#1f2937', marginBottom:1 }}>時給 ¥{j.wage.toLocaleString()}</div>
                  <div style={{ fontSize:9, color:'#ef4444', fontWeight:600, marginBottom:4 }}>{deadlineLabel(j.deadlineHours)}</div>
                  <div style={{ fontSize:10, color:'#6b7280', lineHeight:1.7 }}>
                    <div>募集 {j.filled}/{j.total}人 · {j.startTime}〜{j.endTime}</div>
                    <div>交通費 {j.transport ? '含む' : 'なし'} · {j.location}</div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
      <EmployeeTabBar base="/employee-ver2" active="sukima" sukima={true} />

      {showCondition && (
        <>
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:50, touchAction:'none' }} onClick={() => setShowCondition(false)} />
          <div style={{ position:'fixed', bottom:0, left:0, right:0, background:'white', borderRadius:'16px 16px 0 0', zIndex:51, padding:'20px 16px 28px' }}>
            <div style={{ display:'flex', alignItems:'center', marginBottom:18 }}>
              <div style={{ fontSize:15, fontWeight:700, color:'#1f2937' }}>条件登録</div>
              <div style={{ flex:1 }} />
              <button onClick={() => setShowCondition(false)} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#9ca3af', lineHeight:1, padding:0 }}>✕</button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:7 }}>時給（〇〇円以上）</label>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <input type="number" value={cond.minWage} onChange={e => setCond(p => ({...p, minWage:e.target.value}))} placeholder="例：1200" style={{ flex:1, padding:'9px 10px', borderRadius:8, border:'1px solid #e5e7eb', fontSize:13, outline:'none' }} />
                  <span style={{ fontSize:12, color:'#6b7280', flexShrink:0 }}>円以上</span>
                </div>
              </div>
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:7 }}>場所（現在地から〇〇km以内）</label>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <input type="number" value={cond.maxDist} onChange={e => setCond(p => ({...p, maxDist:e.target.value}))} placeholder="例：3" style={{ flex:1, padding:'9px 10px', borderRadius:8, border:'1px solid #e5e7eb', fontSize:13, outline:'none' }} />
                  <span style={{ fontSize:12, color:'#6b7280', flexShrink:0 }}>km以内</span>
                </div>
              </div>
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:7 }}>稼働時間（〇〇時間以上〜〇〇時間以下）</label>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <input type="number" value={cond.minHours} onChange={e => setCond(p => ({...p, minHours:e.target.value}))} placeholder="最小" style={{ flex:1, padding:'9px 10px', borderRadius:8, border:'1px solid #e5e7eb', fontSize:13, outline:'none' }} />
                  <span style={{ fontSize:12, color:'#6b7280', flexShrink:0 }}>〜</span>
                  <input type="number" value={cond.maxHours} onChange={e => setCond(p => ({...p, maxHours:e.target.value}))} placeholder="最大" style={{ flex:1, padding:'9px 10px', borderRadius:8, border:'1px solid #e5e7eb', fontSize:13, outline:'none' }} />
                  <span style={{ fontSize:12, color:'#6b7280', flexShrink:0 }}>時間</span>
                </div>
              </div>
            </div>
            <button onClick={() => setShowCondition(false)} style={{ marginTop:22, width:'100%', padding:'14px 0', borderRadius:10, border:'none', background:'#5B67F8', color:'white', fontSize:14, fontWeight:700, cursor:'pointer' }}>
              登録する
            </button>
          </div>
        </>
      )}
    </>
  )
}
