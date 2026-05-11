import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { sukimaJobs, DEFAULT_STORE_ADDRESS } from '../../data/mockData'
import EmployeeTabBar from '../../components/EmployeeTabBar'

const INDIGO = '#4F46E5'
const CORAL  = '#FF6B6B'
const BORDER = '#E2E8F0'

const getStoreAddress = () => {
  try { return localStorage.getItem('pitashif_store_address') || DEFAULT_STORE_ADDRESS } catch { return DEFAULT_STORE_ADDRESS }
}

function deadlineLabel(h) {
  if (h >= 24) return `あと${Math.floor(h/24)}日で締め切り`
  return `あと${Math.floor(h)}時間${Math.round((h%1)*60)>0?`${Math.round((h%1)*60)}分`:''}で締め切り`
}

const InfoRow = ({ icon, label, value, accent }) => (
  <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderBottom:`1px solid ${BORDER}` }}>
    <span style={{ fontSize:16, width:22, textAlign:'center', flexShrink:0 }}>{icon}</span>
    <span style={{ fontSize:11, color:'#64748B', width:52, flexShrink:0, fontWeight:500 }}>{label}</span>
    <span style={{ fontSize:13, fontWeight:600, color: accent ? CORAL : '#0F172A', flex:1 }}>{value}</span>
  </div>
)

export default function SukimaDetail() {
  const { id } = useParams()
  const job = sukimaJobs.find(j => j.id === parseInt(id))

  const [applied,     setApplied]     = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  if (!job) return (
    <div style={{ padding:24, textAlign:'center', color:'#64748B', fontSize:13 }}>
      募集が見つかりません
    </div>
  )

  const pos = MAP_POS[job.id] || {x:50,y:50}

  const handleApply = () => {
    setApplied(true)
    setShowConfirm(false)
    setShowSuccess(true)
    setTimeout(() => setShowSuccess(false), 3000)
  }

  return (
    <>
      {/* Header */}
      <div className="pita-phone-header">
        <Link
          to="/pitashif/employee-ver2/sukima"
          style={{ fontSize:13, color:INDIGO, textDecoration:'none', fontWeight:600, padding:'4px 0', flexShrink:0 }}
        >
          ← 一覧
        </Link>
        <div style={{ flex:1, textAlign:'center', fontSize:13, fontWeight:700, color:'#0F172A', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', padding:'0 8px' }}>
          {job.store}：{job.role}
        </div>
        <div style={{ width:40 }} />
      </div>

      {/* Scrollable body */}
      <div className="pita-phone-body">

        {/* Hero */}
        <div style={{ height:120, background:job.bgColor, display:'flex', alignItems:'center', justifyContent:'center', position:'relative', flexShrink:0 }}>
          <span style={{ fontSize:52 }}>{job.emoji}</span>
          {job.deadlineHours < 24 && (
            <div style={{ position:'absolute', top:10, left:10, background:CORAL, color:'white', fontSize:10, fontWeight:800, padding:'4px 9px', borderRadius:6 }}>
              ⏰ {deadlineLabel(job.deadlineHours)}
            </div>
          )}
          {applied && (
            <div style={{ position:'absolute', top:10, right:10, background:'#059669', color:'white', fontSize:10, fontWeight:800, padding:'4px 9px', borderRadius:6 }}>
              ✓ 応募済み
            </div>
          )}
        </div>

        {/* Title + wage */}
        <div style={{ padding:'16px 16px 4px', background:'white', borderBottom:`1px solid ${BORDER}` }}>
          <div style={{ fontSize:12, color:'#64748B', fontWeight:500, marginBottom:2 }}>{job.store}</div>
          <div style={{ fontSize:18, fontWeight:800, color:'#0F172A', marginBottom:8 }}>{job.role}</div>
          <div style={{ display:'flex', alignItems:'baseline', gap:4, marginBottom:12 }}>
            <span style={{ fontSize:28, fontWeight:900, color:INDIGO }}>¥{job.wage.toLocaleString()}</span>
            <span style={{ fontSize:12, color:'#64748B' }}>/時間</span>
          </div>
          {/* Tags */}
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', paddingBottom:14 }}>
            <span style={{ fontSize:11, background:'#EEF0FE', color:INDIGO, padding:'3px 8px', borderRadius:6, fontWeight:600 }}>{job.startTime}〜{job.endTime}</span>
            <span style={{ fontSize:11, background:'#F1F5F9', color:'#475569', padding:'3px 8px', borderRadius:6 }}>残{job.total - job.filled}枠</span>
            {job.transport && <span style={{ fontSize:11, background:'#CFFAFE', color:'#0E7490', padding:'3px 8px', borderRadius:6, fontWeight:600 }}>交通費込</span>}
          </div>
        </div>

        {/* Info table */}
        <div style={{ background:'white', borderBottom:`1px solid ${BORDER}`, marginTop:8 }}>
          <div style={{ padding:'10px 14px 6px', fontSize:11, fontWeight:700, color:'#64748B', letterSpacing:'0.04em' }}>勤務詳細</div>
          <InfoRow icon="⏰" label="締め切り"  value={deadlineLabel(job.deadlineHours)} accent={job.deadlineHours < 3} />
          <InfoRow icon="👥" label="募集人数"  value={`${job.filled}/${job.total}人`} />
          <InfoRow icon="🕐" label="勤務時間"  value={`${job.startTime}〜${job.endTime}`} />
          <InfoRow icon="🚃" label="交通費"    value={job.transport ? '含む' : 'なし'} />
          <InfoRow icon="📍" label="勤務場所"  value={job.location} />
        </div>

        {/* Description */}
        <div style={{ background:'white', borderBottom:`1px solid ${BORDER}`, marginTop:8, padding:'14px 16px' }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#64748B', letterSpacing:'0.04em', marginBottom:8 }}>仕事の内容</div>
          <div style={{ fontSize:13, color:'#374151', lineHeight:1.8 }}>{job.description}</div>
        </div>

        {/* Map */}
        <div style={{ background:'white', marginTop:8 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#64748B', letterSpacing:'0.04em', padding:'14px 16px 8px' }}>アクセス</div>
          <div style={{ borderRadius:0, overflow:'hidden' }}>
            <iframe
              src={`https://maps.google.com/maps?q=${encodeURIComponent(job.location + ' ' + getStoreAddress())}&output=embed&hl=ja&z=16`}
              width="100%"
              height="200"
              style={{ border:'none', display:'block' }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Google Maps"
            />
          </div>
          <div style={{ fontSize:11, color:'#94A3B8', padding:'6px 16px 12px' }}>📍 {job.location}</div>
        </div>

        <div style={{ height:16 }} />
      </div>

      {/* Apply button */}
      <div style={{ padding:'10px 14px', borderTop:`1px solid ${BORDER}`, background:'white', flexShrink:0 }}>
        {applied ? (
          <div style={{ width:'100%', padding:'14px 0', borderRadius:10, background:'#D1FAE5', color:'#065F46', fontSize:14, fontWeight:700, textAlign:'center' }}>
            ✓ 応募済み — 結果をお待ちください
          </div>
        ) : (
          <button
            onClick={() => setShowConfirm(true)}
            style={{ width:'100%', padding:'14px 0', borderRadius:10, border:'none', background:INDIGO, color:'white', fontSize:14, fontWeight:700, cursor:'pointer', boxShadow:'0 4px 12px rgba(79,70,229,0.30)' }}
          >
            この枠に応募する
          </button>
        )}
      </div>

      <EmployeeTabBar base="/pitashif/employee-ver2" sukima={true} />

      {/* Success toast */}
      {showSuccess && (
        <div style={{ position:'fixed', top:24, left:'50%', transform:'translateX(-50%)', background:'#065F46', color:'white', padding:'10px 22px', borderRadius:10, fontSize:13, fontWeight:700, zIndex:100, boxShadow:'0 4px 20px rgba(0,0,0,0.22)', whiteSpace:'nowrap' }}>
          ✓ 応募が完了しました！
        </div>
      )}

      {/* Confirm bottom sheet */}
      {showConfirm && (
        <>
          <div onClick={() => setShowConfirm(false)} style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.4)', zIndex:50, touchAction:'none' }} />
          <div style={{ position:'fixed', bottom:0, left:0, right:0, background:'white', borderRadius:'18px 18px 0 0', zIndex:51, padding:'0 16px max(28px,env(safe-area-inset-bottom))' }}>
            <div style={{ width:36, height:4, background:BORDER, borderRadius:2, margin:'12px auto 16px' }} />
            <div style={{ fontSize:16, fontWeight:700, color:'#0F172A', marginBottom:10 }}>応募を確定しますか？</div>

            {/* Job summary card */}
            <div style={{ background:'#F8FAFC', border:`1px solid ${BORDER}`, borderRadius:10, padding:'12px 14px', marginBottom:14 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                <div style={{ width:36, height:36, borderRadius:8, background:job.bgColor, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>{job.emoji}</div>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:'#0F172A' }}>{job.store}：{job.role}</div>
                  <div style={{ fontSize:11, color:'#64748B' }}>{job.startTime}〜{job.endTime} · ¥{job.wage.toLocaleString()}/h</div>
                </div>
              </div>
              <div style={{ fontSize:11, color:'#64748B', lineHeight:1.8 }}>
                <div>残り募集: {job.total - job.filled}枠　交通費: {job.transport ? '含む' : 'なし'}</div>
                <div>場所: {job.location}</div>
              </div>
            </div>

            <div style={{ fontSize:11, color:'#94A3B8', marginBottom:18, padding:'10px 12px', background:'#F8FAFC', borderRadius:8, border:`1px solid ${BORDER}` }}>
              ※ 応募後、店舗からの連絡をお待ちください。確定するまでキャンセル可能です。
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button
                onClick={() => setShowConfirm(false)}
                style={{ flex:1, padding:'14px 0', borderRadius:10, border:`1px solid ${BORDER}`, background:'white', color:'#374151', fontSize:13, fontWeight:600, cursor:'pointer' }}
              >
                キャンセル
              </button>
              <button
                onClick={handleApply}
                style={{ flex:2, padding:'14px 0', borderRadius:10, border:'none', background:INDIGO, color:'white', fontSize:14, fontWeight:700, cursor:'pointer', boxShadow:'0 4px 12px rgba(79,70,229,0.28)' }}
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
