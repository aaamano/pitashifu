import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { sukimaJobs } from '../../data/mockData'
import EmployeeTabBar from '../../components/EmployeeTabBar'

const MAP_POS = { 1:{x:35,y:62}, 2:{x:48,y:40}, 3:{x:44,y:52}, 4:{x:65,y:50}, 5:{x:38,y:57}, 6:{x:52,y:25}, 7:{x:42,y:58} }

function deadlineLabel(h) {
  if (h >= 24) return `あと${Math.floor(h/24)}日で締め切り`
  return `あと${Math.floor(h)}時間${Math.round((h%1)*60)>0?`${Math.round((h%1)*60)}分`:''}で締め切り`
}

export default function SukimaDetail() {
  const { id } = useParams()
  const job = sukimaJobs.find(j => j.id === parseInt(id))

  const [applied,         setApplied]         = useState(false)
  const [showConfirm,     setShowConfirm]      = useState(false)
  const [showSuccess,     setShowSuccess]      = useState(false)

  if (!job) return <div style={{padding:20,color:'#6b7280'}}>募集が見つかりません</div>

  const pos = MAP_POS[job.id] || {x:50,y:50}

  const info = [
    { icon:'⏰', label:'締め切り',  value:deadlineLabel(job.deadlineHours), accent: job.deadlineHours < 3 },
    { icon:'👥', label:'募集人数',  value:`${job.filled}/${job.total}人` },
    { icon:'🕐', label:'勤務時間',  value:`${job.startTime}〜${job.endTime}` },
    { icon:'🚃', label:'交通費',    value:job.transport ? '含む' : 'なし' },
    { icon:'📍', label:'勤務場所',  value:job.location },
  ]

  const handleApply = () => {
    setApplied(true)
    setShowConfirm(false)
    setShowSuccess(true)
    setTimeout(() => setShowSuccess(false), 3000)
  }

  return (
    <>
      <div className="pita-phone-header">
        <Link to="/employee-ver2/sukima" style={{ fontSize:12, color:'var(--pita-accent)', textDecoration:'none', fontWeight:600 }}>← 一覧</Link>
        <div style={{ flex:1, textAlign:'center', fontSize:12, fontWeight:700, color:'var(--pita-text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', padding:'0 4px' }}>{job.store}：{job.role}</div>
        <div style={{ width:40 }} />
      </div>

      <div className="pita-phone-body">
        {/* Hero */}
        <div style={{ height:110, background:job.bgColor, display:'flex', alignItems:'center', justifyContent:'center', position:'relative', flexShrink:0 }}>
          <span style={{ fontSize:48 }}>{job.emoji}</span>
          {job.deadlineHours < 24 && (
            <div style={{ position:'absolute', top:10, left:10, background:'#ef4444', color:'white', fontSize:10, fontWeight:700, padding:'4px 8px', borderRadius:6 }}>⏰ {deadlineLabel(job.deadlineHours)}</div>
          )}
          {applied && (
            <div style={{ position:'absolute', top:10, right:10, background:'#10b981', color:'white', fontSize:10, fontWeight:700, padding:'4px 8px', borderRadius:6 }}>✓ 応募済み</div>
          )}
        </div>

        <div style={{ padding:'14px' }}>
          <div style={{ fontSize:17, fontWeight:800, color:'#1f2937', marginBottom:2 }}>{job.store}：{job.role}</div>
          <div style={{ fontSize:24, fontWeight:900, color:'#1f2937', marginBottom:14 }}>時給 ¥{job.wage.toLocaleString()}</div>

          {/* Info rows */}
          <div style={{ display:'flex', flexDirection:'column', gap:0, background:'white', border:'1px solid #f3f4f6', borderRadius:10, overflow:'hidden', marginBottom:14 }}>
            {info.map((r, i) => (
              <div key={r.label} style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 14px', borderTop: i>0 ? '1px solid #f9fafb' : 'none' }}>
                <span style={{ fontSize:16, width:20, textAlign:'center', flexShrink:0 }}>{r.icon}</span>
                <span style={{ fontSize:12, color:'#6b7280', width:54, flexShrink:0 }}>{r.label}</span>
                <span style={{ fontSize:13, fontWeight:600, color: r.accent ? '#ef4444' : '#1f2937', flex:1 }}>{r.value}</span>
              </div>
            ))}
          </div>

          {/* Description */}
          <div style={{ background:'#f9fafb', borderRadius:10, padding:'12px 14px', marginBottom:14 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#374151', marginBottom:6 }}>仕事の内容</div>
            <div style={{ fontSize:12, color:'#6b7280', lineHeight:1.7 }}>{job.description}</div>
          </div>

          {/* Map */}
          <div style={{ borderRadius:10, overflow:'hidden', marginBottom:6 }}>
            <svg viewBox="0 0 100 60" style={{ width:'100%', display:'block', background:'#d4dde8' }}>
              {[20,40,60,80].map(v => <line key={`h${v}`} x1={0} y1={v*0.6} x2={100} y2={v*0.6} stroke="white" strokeWidth="1.2" />)}
              {[20,40,60,80].map(v => <line key={`v${v}`} x1={v} y1={0} x2={v} y2={60} stroke="white" strokeWidth="0.8" />)}
              <rect x={8} y={4} width={22} height={10} fill="#c8d5c8" rx="1" />
              <rect x={38} y={16} width={16} height={10} fill="#c8d5c8" rx="1" />
              <rect x={60} y={24} width={18} height={10} fill="#c8d5c8" rx="1" />
              <circle cx={pos.x} cy={pos.y*0.6} r="5" fill="#5B67F8" stroke="white" strokeWidth="1.5" opacity="0.25" />
              <circle cx={pos.x} cy={pos.y*0.6} r="3.5" fill="#5B67F8" stroke="white" strokeWidth="1.5" />
              <circle cx={pos.x} cy={pos.y*0.6} r="1.2" fill="white" />
              <text x={pos.x+6} y={pos.y*0.6+2} fontSize="3.5" fill="#1f2937" fontWeight="700">{job.store}</text>
            </svg>
          </div>
          <div style={{ fontSize:10, color:'#9ca3af', marginBottom:16 }}>📍 {job.location}</div>
        </div>
      </div>

      {/* Apply button */}
      <div style={{ padding:'10px 14px', borderTop:'1px solid var(--pita-border)', background:'white', flexShrink:0 }}>
        {applied ? (
          <div style={{ width:'100%', padding:'14px 0', borderRadius:10, background:'#d1fae5', color:'#065f46', fontSize:14, fontWeight:700, textAlign:'center' }}>
            ✓ 応募済み — 結果をお待ちください
          </div>
        ) : (
          <button
            onClick={() => setShowConfirm(true)}
            style={{ width:'100%', padding:'14px 0', borderRadius:10, border:'none', background:'#5B67F8', color:'white', fontSize:14, fontWeight:700, cursor:'pointer' }}
          >
            この枠に応募する
          </button>
        )}
      </div>

      <EmployeeTabBar base="/employee-ver2" active="sukima" sukima={true} />

      {/* Success toast */}
      {showSuccess && (
        <div style={{ position:'fixed', top:20, left:'50%', transform:'translateX(-50%)', background:'#065f46', color:'white', padding:'10px 20px', borderRadius:10, fontSize:13, fontWeight:600, zIndex:100, boxShadow:'0 4px 16px rgba(0,0,0,0.2)', whiteSpace:'nowrap' }}>
          ✓ 応募が完了しました！
        </div>
      )}

      {/* Confirm bottom sheet */}
      {showConfirm && (
        <>
          <div
            style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:50, touchAction:'none' }}
            onClick={() => setShowConfirm(false)}
          />
          <div style={{ position:'fixed', bottom:0, left:0, right:0, background:'white', borderRadius:'16px 16px 0 0', zIndex:51, padding:'20px 16px 32px' }}>
            <div style={{ width:36, height:4, background:'#e5e7eb', borderRadius:2, margin:'0 auto 16px' }} />
            <div style={{ fontSize:16, fontWeight:700, color:'#1f2937', marginBottom:4 }}>応募を確定しますか？</div>
            <div style={{ fontSize:12, color:'#6b7280', lineHeight:1.7, marginBottom:16 }}>
              <div>📍 {job.store}：{job.role}</div>
              <div>🕐 {job.startTime}〜{job.endTime}</div>
              <div>💴 時給 ¥{job.wage.toLocaleString()}</div>
            </div>
            <div style={{ fontSize:11, color:'#9ca3af', marginBottom:20, padding:'10px 12px', background:'#f9fafb', borderRadius:8 }}>
              ※ 応募後、店舗からの連絡をお待ちください。確定するまでキャンセルが可能です。
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button
                onClick={() => setShowConfirm(false)}
                style={{ flex:1, padding:'14px 0', borderRadius:10, border:'1px solid #e5e7eb', background:'white', color:'#374151', fontSize:13, fontWeight:600, cursor:'pointer' }}
              >
                キャンセル
              </button>
              <button
                onClick={handleApply}
                style={{ flex:2, padding:'14px 0', borderRadius:10, border:'none', background:'#5B67F8', color:'white', fontSize:14, fontWeight:700, cursor:'pointer' }}
              >
                応募する
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
