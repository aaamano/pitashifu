import { useState } from 'react'
import { Link } from 'react-router-dom'
import { sukimaJobs, DEFAULT_STORE_ADDRESS } from '../../data/mockData'
import EmployeeTabBar from '../../components/EmployeeTabBar'

const getStoreAddress = () => {
  try { return localStorage.getItem('pitashif_store_address') || DEFAULT_STORE_ADDRESS } catch { return DEFAULT_STORE_ADDRESS }
}

function GoogleMapEmbed({ query, height = 240 }) {
  const src = `https://maps.google.com/maps?q=${encodeURIComponent(query)}&output=embed&hl=ja&z=15`
  return (
    <iframe
      src={src}
      width="100%"
      height={height}
      style={{ border:'none', display:'block' }}
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
      title="Google Maps"
    />
  )
}

const DAYS_JP = ['日','月','火','水','木','金','土']
const TODAY = new Date('2026-04-21')
const DATES = Array.from({ length: 7 }, (_, i) => {
  const d = new Date(TODAY); d.setDate(TODAY.getDate() + i)
  return { d, dayNum: d.getDate(), dow: DAYS_JP[d.getDay()], dateStr: d.toISOString().slice(0,10), isSat: d.getDay()===6, isSun: d.getDay()===0 }
})

const FILTER_OPTS = [
  { key:'role',    label:'職種',   options:['すべて','バリスタ','ホールスタッフ','キッチンスタッフ','フロアスタッフ'] },
  { key:'pay',     label:'報酬',   options:['指定なし','¥1,100以上','¥1,200以上','¥1,300以上'] },
  { key:'time',    label:'時間帯', options:['指定なし','午前（〜12:00）','午後（12:00〜17:00）','夜（17:00〜）'] },
  { key:'benefit', label:'待遇',   options:['指定なし','交通費あり','未経験OK'] },
]
const DEFAULT_FILTERS = { role:'すべて', pay:'指定なし', time:'指定なし', benefit:'指定なし' }
const MAP_POS = { 1:{x:35,y:62}, 2:{x:48,y:40}, 3:{x:44,y:52}, 4:{x:65,y:50}, 5:{x:38,y:57}, 6:{x:52,y:25}, 7:{x:42,y:58} }

const INDIGO  = '#4F46E5'
const CORAL   = '#FF6B6B'
const SKY     = '#38BDF8'
const BORDER  = '#E2E8F0'

function deadlineLabel(h) {
  if (h >= 24) return `あと${Math.floor(h/24)}日`
  return `あと${Math.floor(h)}h`
}
function deadlineFull(h) {
  if (h >= 24) return `あと${Math.floor(h/24)}日で締め切り`
  return `あと${Math.floor(h)}時間${Math.round((h%1)*60)>0?`${Math.round((h%1)*60)}分`:''}で締め切り`
}

const IconSearch = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
)
const IconSliders = () => (
  <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="3" y1="5" x2="17" y2="5"/>
    <circle cx="13" cy="5" r="2.5" fill="white" stroke="currentColor" strokeWidth="2"/>
    <line x1="3" y1="10" x2="17" y2="10"/>
    <circle cx="7" cy="10" r="2.5" fill="white" stroke="currentColor" strokeWidth="2"/>
    <line x1="3" y1="15" x2="17" y2="15"/>
    <circle cx="11" cy="15" r="2.5" fill="white" stroke="currentColor" strokeWidth="2"/>
  </svg>
)
const IconMap = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
    <line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>
  </svg>
)

function Sheet({ onClose, title, children }) {
  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.4)', zIndex:60, touchAction:'none' }} />
      <div style={{ position:'fixed', bottom:0, left:0, right:0, background:'white', borderRadius:'18px 18px 0 0', zIndex:61, paddingBottom:'max(20px,env(safe-area-inset-bottom))' }}>
        <div style={{ width:36, height:4, background:BORDER, borderRadius:2, margin:'12px auto 0' }} />
        <div style={{ display:'flex', alignItems:'center', padding:'14px 16px 10px', borderBottom:`1px solid ${BORDER}` }}>
          <span style={{ fontSize:15, fontWeight:700, color:'#0F172A' }}>{title}</span>
          <button onClick={onClose} style={{ marginLeft:'auto', background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#94A3B8', lineHeight:1, padding:0 }}>✕</button>
        </div>
        {children}
      </div>
    </>
  )
}

function FilterSheet({ opt, current, onSelect, onClose }) {
  return (
    <Sheet onClose={onClose} title={opt.label}>
      <div>
        {opt.options.map(val => {
          const on = current === val
          return (
            <button
              key={val}
              onClick={() => { onSelect(opt.key, val); onClose() }}
              style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', background: on ? '#EEF0FE' : 'none', border:'none', borderBottom:`1px solid ${BORDER}`, cursor:'pointer', textAlign:'left', minHeight:52 }}
            >
              <span style={{ fontSize:15, color: on ? INDIGO : '#374151', fontWeight: on ? 700 : 400 }}>{val}</span>
              {on && (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={INDIGO} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
            </button>
          )
        })}
      </div>
    </Sheet>
  )
}

export default function SukimaTop() {
  const [selDate,       setSelDate]       = useState(0)
  const [showMap,       setShowMap]       = useState(false)
  const [showCondition, setShowCondition] = useState(false)
  const [filters,       setFilters]       = useState(DEFAULT_FILTERS)
  const [filterSheet,   setFilterSheet]   = useState(null)
  const [notifOn,       setNotifOn]       = useState(false)
  const [search,        setSearch]        = useState('')
  const [cond,          setCond]          = useState({ minWage:'', maxDist:'', minHours:'', maxHours:'' })

  const dt    = DATES[selDate]
  const label = `${dt.d.getMonth()+1}月${dt.dayNum}日（${dt.dow}）`

  const dayJobs = sukimaJobs.filter(j => j.date === dt.dateStr).filter(j => {
    if (filters.role !== 'すべて' && j.role !== filters.role) return false
    if (filters.pay  !== '指定なし' && j.wage < parseInt(filters.pay.replace(/[^0-9]/g,''))) return false
    if (search && !j.store.includes(search) && !j.role.includes(search)) return false
    return true
  })

  const activeFilterCount = Object.entries(filters).filter(([k, v]) => {
    const opt = FILTER_OPTS.find(o => o.key === k)
    return v !== opt?.options[0]
  }).length

  const setFilter = (key, val) => setFilters(p => ({ ...p, [key]: val }))
  const clearFilters = () => setFilters(DEFAULT_FILTERS)
  const activeSheetOpt = FILTER_OPTS.find(o => o.key === filterSheet)

  // ── Map view ──
  if (showMap) return (
    <>
      <div className="pita-phone-header">
        <button onClick={() => setShowMap(false)} style={{ fontSize:13, color:INDIGO, background:'none', border:'none', cursor:'pointer', fontWeight:600, padding:'4px 0' }}>← 一覧</button>
        <div style={{ flex:1, textAlign:'center', fontSize:13, fontWeight:700, color:'#0F172A' }}>{label} の募集</div>
        <div style={{ width:48 }} />
      </div>
      <div className="pita-phone-body">
        <GoogleMapEmbed query={getStoreAddress()} height={260} />
        <div style={{ padding:'8px 12px', display:'flex', flexDirection:'column', gap:6 }}>
          {dayJobs.map(j => (
            <Link key={j.id} to={`/pitashif/employee-ver2/sukima/${j.id}`} style={{ textDecoration:'none' }}>
              <div style={{ background:'white', borderRadius:10, padding:'10px 12px', display:'flex', alignItems:'center', gap:10, border:`1px solid ${BORDER}`, boxShadow:'0 1px 3px rgba(15,23,42,0.05)' }}>
                <div style={{ width:36, height:36, borderRadius:10, background:j.bgColor, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>{j.emoji}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'#0F172A' }}>{j.store}：{j.role}</div>
                  <div style={{ fontSize:11, color:'#64748B' }}>¥{j.wage.toLocaleString()} · {j.startTime}〜{j.endTime}</div>
                </div>
                <div style={{ fontSize:10, color:CORAL, fontWeight:700 }}>{j.filled}/{j.total}人</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
      <EmployeeTabBar base="/pitashif/employee-ver2" sukima={true} />
    </>
  )

  // ── Main list view ──
  return (
    <>
      {/* Header */}
      <div className="pita-phone-header">
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:14, fontWeight:700, color:'#0F172A' }}>スキマバイト</div>
          <div style={{ fontSize:10, color:'#64748B', marginTop:1 }}>今日から7日間の募集</div>
        </div>
        <button
          onClick={() => setShowCondition(true)}
          style={{ padding:'8px 14px', borderRadius:8, background:INDIGO, color:'white', border:'none', fontSize:12, fontWeight:700, cursor:'pointer', minHeight:36 }}
        >
          条件登録
        </button>
      </div>

      {/* Search + filter row */}
      <div style={{ padding:'8px 12px', background:'#F8FAFC', borderBottom:`1px solid ${BORDER}`, flexShrink:0, display:'flex', gap:8 }}>
        <div style={{ flex:1, display:'flex', alignItems:'center', gap:8, background:'white', borderRadius:10, padding:'8px 12px', border:`1px solid ${BORDER}` }}>
          <IconSearch />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="店舗名・職種で検索"
            style={{ flex:1, border:'none', outline:'none', fontSize:13, color:'#374151', background:'none' }}
          />
          {search && <button onClick={() => setSearch('')} style={{ background:'none', border:'none', color:'#94A3B8', cursor:'pointer', fontSize:14, padding:0, lineHeight:1 }}>✕</button>}
        </div>
        <button
          onClick={() => setFilterSheet(FILTER_OPTS[0].key)}
          style={{ display:'flex', alignItems:'center', gap:5, padding:'8px 12px', borderRadius:10, border: activeFilterCount > 0 ? 'none' : `1px solid ${BORDER}`, background: activeFilterCount > 0 ? '#EEF0FE' : 'white', color: activeFilterCount > 0 ? INDIGO : '#475569', fontSize:12, fontWeight: activeFilterCount > 0 ? 700 : 400, cursor:'pointer', flexShrink:0, position:'relative', minHeight:36 }}
        >
          <IconSliders /> 絞り込み
          {activeFilterCount > 0 && (
            <span style={{ position:'absolute', top:-4, right:-4, width:16, height:16, borderRadius:'50%', background:CORAL, color:'white', fontSize:9, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center' }}>
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Active filter chips */}
      {activeFilterCount > 0 && (
        <div style={{ display:'flex', gap:6, padding:'6px 12px', overflowX:'auto', background:'#F8FAFC', flexShrink:0, msOverflowStyle:'none', scrollbarWidth:'none' }}>
          {FILTER_OPTS.map(opt => {
            const val = filters[opt.key]
            if (val === opt.options[0]) return null
            return (
              <button
                key={opt.key}
                onClick={() => setFilter(opt.key, opt.options[0])}
                style={{ display:'flex', alignItems:'center', gap:4, padding:'4px 10px', borderRadius:10, border:'none', background:'#EEF0FE', color:INDIGO, fontSize:11, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}
              >
                {val} ✕
              </button>
            )
          })}
          <button onClick={clearFilters} style={{ padding:'4px 10px', borderRadius:10, border:`1px solid ${BORDER}`, background:'white', color:'#64748B', fontSize:11, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}>
            すべて解除
          </button>
        </div>
      )}

      {/* Filter category pills */}
      <div style={{ display:'flex', gap:6, padding:'6px 12px', overflowX:'auto', background:'white', borderBottom:`1px solid ${BORDER}`, flexShrink:0, msOverflowStyle:'none', scrollbarWidth:'none' }}>
        {FILTER_OPTS.map(opt => {
          const val  = filters[opt.key]
          const isOn = val !== opt.options[0]
          return (
            <button
              key={opt.key}
              onClick={() => setFilterSheet(opt.key)}
              style={{
                display:'flex', alignItems:'center', gap:4, padding:'7px 12px',
                borderRadius:16, border: isOn ? 'none' : `1px solid ${BORDER}`,
                background: isOn ? '#EEF0FE' : 'white',
                color: isOn ? INDIGO : '#64748B',
                fontSize:12, fontWeight: isOn ? 700 : 400,
                cursor:'pointer', whiteSpace:'nowrap', flexShrink:0, minHeight:36,
              }}
            >
              {opt.label}
              {isOn
                ? <span style={{ fontSize:10, color:INDIGO }}>▾</span>
                : <span style={{ fontSize:10, color:'#94A3B8' }}>▾</span>
              }
            </button>
          )
        })}
      </div>

      {/* Date selector */}
      <div style={{ display:'flex', gap:6, padding:'8px 12px', overflowX:'auto', flexShrink:0, background:'white', borderBottom:`1px solid ${BORDER}`, msOverflowStyle:'none', scrollbarWidth:'none' }}>
        {DATES.map((d, i) => {
          const isActive  = i === selDate
          const isToday   = i === 0
          const dayColor  = d.isSun ? CORAL : d.isSat ? SKY : '#0F172A'
          return (
            <button
              key={i}
              onClick={() => setSelDate(i)}
              style={{
                flexShrink:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                width:50, height:56, borderRadius:12, padding:0, cursor:'pointer',
                /* today unselected → indigo ring; selected → solid indigo fill; other → gray border */
                border: isActive ? 'none' : isToday ? `2px solid ${INDIGO}` : `1px solid ${BORDER}`,
                background: isActive ? INDIGO : 'white',
                boxShadow: isActive ? '0 2px 8px rgba(79,70,229,0.28)' : 'none',
              }}
            >
              {isToday && (
                <span style={{ fontSize:8, fontWeight:800, color: isActive ? 'rgba(255,255,255,0.85)' : INDIGO, marginBottom:1, letterSpacing:'0.02em' }}>
                  今日
                </span>
              )}
              <span style={{ fontSize:19, fontWeight:800, lineHeight:1.1, color: isActive ? 'white' : isToday ? INDIGO : dayColor }}>
                {d.dayNum}
              </span>
              <span style={{ fontSize:9, color: isActive ? 'rgba(255,255,255,0.7)' : isToday ? INDIGO : (d.isSun ? CORAL : d.isSat ? SKY : '#64748B') }}>
                {d.dow}
              </span>
            </button>
          )
        })}
      </div>

      {/* Sort + map row */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 12px', background:'white', borderBottom:`1px solid ${BORDER}`, flexShrink:0 }}>
        <button style={{ display:'flex', alignItems:'center', gap:4, background:'none', border:'none', cursor:'pointer', fontSize:12, color:'#475569', minHeight:36 }}>
          ⇕ 現在地から近い順 <span style={{ color:'#94A3B8', fontSize:10 }}>▼</span>
        </button>
        <button onClick={() => setShowMap(true)} style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 12px', borderRadius:8, border:`1px solid ${BORDER}`, background:'white', fontSize:12, cursor:'pointer', color:'#475569', minHeight:36 }}>
          <IconMap /> マップ
        </button>
      </div>

      {/* Job list */}
      <div className="pita-phone-body">
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 12px 6px' }}>
          <span style={{ fontSize:12, fontWeight:600, color:'#0F172A' }}>{label} · <span style={{ color:INDIGO }}>{dayJobs.length}件</span></span>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ fontSize:10, color:'#94A3B8' }}>新着通知</span>
            <button
              onClick={() => setNotifOn(v => !v)}
              style={{ padding:'4px 10px', borderRadius:10, border: notifOn ? 'none' : `1px solid ${BORDER}`, background: notifOn ? INDIGO : 'white', color: notifOn ? 'white' : '#475569', fontSize:10, fontWeight:700, cursor:'pointer' }}
            >
              {notifOn ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        <div style={{ padding:'0 10px 16px' }}>
          {dayJobs.length === 0 && (
            <div style={{ textAlign:'center', padding:'48px 20px' }}>
              <div style={{ width:56, height:56, borderRadius:16, background:'#EEF0FE', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px', fontSize:24 }}>🔍</div>
              <div style={{ fontSize:14, fontWeight:700, color:'#0F172A', marginBottom:4 }}>この日の募集はありません</div>
              <div style={{ fontSize:12, color:'#64748B', marginBottom:16 }}>別の日付や条件をお試しください</div>
              {activeFilterCount > 0 && (
                <button onClick={clearFilters} style={{ padding:'9px 20px', borderRadius:8, border:`1px solid ${BORDER}`, background:'white', color:INDIGO, fontSize:12, fontWeight:700, cursor:'pointer' }}>フィルターを解除</button>
              )}
            </div>
          )}
          {dayJobs.map(j => (
            <Link key={j.id} to={`/pitashif/employee-ver2/sukima/${j.id}`} style={{ textDecoration:'none', display:'block', marginBottom:8 }}>
              <div style={{ background:'white', borderRadius:12, border:`1px solid ${BORDER}`, overflow:'hidden', display:'flex', boxShadow:'0 1px 3px rgba(15,23,42,0.05)' }}>
                {/* Emoji thumb */}
                <div style={{ width:84, flexShrink:0, background:j.bgColor, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', position:'relative', minHeight:96 }}>
                  <span style={{ fontSize:28 }}>{j.emoji}</span>
                  <div style={{ position:'absolute', top:6, left:6, background:CORAL, color:'white', fontSize:8, fontWeight:800, padding:'2px 5px', borderRadius:4 }}>
                    {deadlineLabel(j.deadlineHours)}
                  </div>
                </div>
                {/* Info */}
                <div style={{ flex:1, padding:'10px 10px 8px', minWidth:0 }}>
                  <div style={{ fontSize:11, fontWeight:600, color:'#64748B', marginBottom:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{j.store}</div>
                  <div style={{ fontSize:13, fontWeight:700, color:'#0F172A', marginBottom:3 }}>{j.role}</div>
                  <div style={{ fontSize:15, fontWeight:800, color:INDIGO, marginBottom:3 }}>¥{j.wage.toLocaleString()}<span style={{ fontSize:10, fontWeight:500, color:'#64748B' }}>/h</span></div>
                  <div style={{ fontSize:10, color:CORAL, fontWeight:600, marginBottom:4 }}>{deadlineFull(j.deadlineHours)}</div>
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                    <span style={{ fontSize:10, color:'#64748B', background:'#F1F5F9', padding:'2px 6px', borderRadius:4 }}>{j.startTime}〜{j.endTime}</span>
                    <span style={{ fontSize:10, color:'#64748B', background:'#F1F5F9', padding:'2px 6px', borderRadius:4 }}>残{j.total - j.filled}枠</span>
                    {j.transport && <span style={{ fontSize:10, color:'#0E7490', background:'#CFFAFE', padding:'2px 6px', borderRadius:4 }}>交通費込</span>}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <EmployeeTabBar base="/pitashif/employee-ver2" sukima={true} />

      {/* Filter bottom sheet */}
      {filterSheet && activeSheetOpt && (
        <FilterSheet opt={activeSheetOpt} current={filters[filterSheet]} onSelect={setFilter} onClose={() => setFilterSheet(null)} />
      )}

      {/* Condition sheet */}
      {showCondition && (
        <Sheet onClose={() => setShowCondition(false)} title="条件登録">
          <div style={{ padding:'16px 16px 0' }}>
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              {[
                { label:'時給（以上）', key:'minWage', unit:'円以上', placeholder:'例：1200' },
                { label:'現在地から', key:'maxDist', unit:'km以内', placeholder:'例：3' },
              ].map(f => (
                <div key={f.key}>
                  <label className="mgr-label">{f.label}</label>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <input
                      type="number"
                      value={cond[f.key]}
                      onChange={e => setCond(p => ({...p, [f.key]:e.target.value}))}
                      placeholder={f.placeholder}
                      style={{ flex:1, padding:'10px 12px', borderRadius:8, border:`1px solid ${BORDER}`, fontSize:13, outline:'none', fontFamily:'inherit' }}
                    />
                    <span style={{ fontSize:12, color:'#64748B', flexShrink:0 }}>{f.unit}</span>
                  </div>
                </div>
              ))}
              <div>
                <label className="mgr-label">稼働時間</label>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <input type="number" value={cond.minHours} onChange={e => setCond(p => ({...p, minHours:e.target.value}))} placeholder="最小" style={{ flex:1, padding:'10px 12px', borderRadius:8, border:`1px solid ${BORDER}`, fontSize:13, outline:'none', fontFamily:'inherit' }} />
                  <span style={{ color:'#94A3B8' }}>〜</span>
                  <input type="number" value={cond.maxHours} onChange={e => setCond(p => ({...p, maxHours:e.target.value}))} placeholder="最大" style={{ flex:1, padding:'10px 12px', borderRadius:8, border:`1px solid ${BORDER}`, fontSize:13, outline:'none', fontFamily:'inherit' }} />
                  <span style={{ fontSize:12, color:'#64748B', flexShrink:0 }}>時間</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowCondition(false)}
              style={{ marginTop:22, marginBottom:4, width:'100%', padding:'14px 0', borderRadius:10, border:'none', background:INDIGO, color:'white', fontSize:14, fontWeight:700, cursor:'pointer' }}
            >
              登録する
            </button>
          </div>
        </Sheet>
      )}
    </>
  )
}
