import { useParams, Link } from 'react-router-dom'
import { staff, shiftData, daysConfig, skillLabels, YEAR_MONTH } from '../../data/mockData'

const getShiftColor = (code) => {
  if (!code || code === 'X') return 'bg-gray-100 text-gray-400'
  if (code === 'F') return 'bg-green-100 text-green-700'
  if (code.startsWith('O')) return 'bg-blue-100 text-blue-700'
  if (code.endsWith('L')) return 'bg-purple-100 text-purple-700'
  return 'bg-amber-100 text-amber-700'
}

export default function MemberDetail() {
  const { id, orgId } = useParams()
  const member = staff.find(s => s.id === Number(id))

  if (!member) {
    return (
      <div className="mgr-page" style={{ textAlign:'center', color:'#94a3b8', paddingTop:64 }}>
        <div style={{ fontSize:40, marginBottom:12 }}>🔍</div>
        <div style={{ fontSize:14 }}>メンバーが見つかりません</div>
        <Link to={`/${orgId}/manager/members`} style={{ color:'#4f46e5', textDecoration:'none', fontSize:13, display:'inline-block', marginTop:8 }}>← 一覧に戻る</Link>
      </div>
    )
  }

  const row = shiftData[member.id] || []
  const workDays = row.filter(c => c && c !== 'X').length
  const totalHours = row.reduce((sum, code) => {
    if (!code || code === 'X') return sum
    if (code === 'F') return sum + 8
    const m = code.match(/(\d+)[\.-](\d+|L)/)
    if (!m) return sum + 6
    const start = parseInt(m[1])
    const end = m[2] === 'L' ? 22 : parseInt(m[2])
    return sum + Math.max(0, end - start - 1)
  }, 0)

  return (
    <div className="mgr-page">
      {/* Back + header */}
      <div style={{ marginBottom:24 }}>
        <Link to={`/${orgId}/manager/members`} style={{ fontSize:12, color:'#64748b', textDecoration:'none', display:'inline-flex', alignItems:'center', gap:4, marginBottom:14 }}>
          ← メンバー一覧
        </Link>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            <div style={{ width:56, height:56, borderRadius:'50%', background:'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:22, fontWeight:700, flexShrink:0 }}>
              {member.name[0]}
            </div>
            <div>
              <h1 style={{ fontSize:22, fontWeight:700, color:'#0f172a', letterSpacing:'-0.01em', margin:0 }}>{member.name}</h1>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:6 }}>
                <span style={{ fontSize:11, padding:'2px 8px', borderRadius:4, fontWeight:600, background: member.type === 'F' ? '#d1fae5' : '#f0f5f9', color: member.type === 'F' ? '#065f46' : '#475569' }}>
                  {member.type === 'F' ? '正社員' : 'パート/バイト'}
                </span>
                <span style={{ fontSize:12, color:'#64748b' }}>{member.role}</span>
              </div>
            </div>
          </div>
          <Link to={`/${orgId}/manager/members`} className="mgr-btn-primary" style={{ textDecoration:'none' }}>
            編集する
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        {[
          { label: '今月出勤日数',   value: `${workDays}日`,        bg:'#eef2ff', border:'#c7d2fe', txt:'#3730a3' },
          { label: '想定労働時間',   value: `${totalHours}h`,       bg:'#d1fae5', border:'#a7f3d0', txt:'#065f46' },
          { label: '時間生産性',     value: `${member.hourlyOrders}件/h`, bg:'#fef3c7', border:'#fde68a', txt:'#92400e' },
          { label: '時給',           value: `¥${member.wage.toLocaleString()}`, bg:'#ede9fe', border:'#ddd6fe', txt:'#5b21b6' },
        ].map((k, i) => (
          <div key={i} style={{ border:`1px solid ${k.border}`, borderRadius:12, padding:'16px 18px', background:k.bg, boxShadow:'0 1px 3px rgba(15,23,42,0.04)' }}>
            <div style={{ fontSize:11, color:'#64748b', marginBottom:6 }}>{k.label}</div>
            <div style={{ fontSize:22, fontWeight:700, color:k.txt }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Skills */}
      <div className="mgr-card" style={{ padding:20, marginBottom:20 }}>
        <h2 style={{ fontSize:14, fontWeight:600, color:'#0f172a', marginBottom:12, marginTop:0 }}>スキル・能力</h2>
        <div className="flex gap-3 flex-wrap">
          {Object.entries(skillLabels).map(([k, v]) => (
            <div key={k} className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium ${
              member.skills.includes(k)
                ? k === 'barista'
                  ? 'bg-amber-100 border-amber-300 text-amber-800'
                  : k === 'cashier'
                  ? 'bg-blue-100 border-blue-300 text-blue-800'
                  : 'bg-gray-100 border-gray-300 text-gray-700'
                : 'bg-gray-50 border-gray-200 text-gray-300'
            }`}>
              <span>{member.skills.includes(k) ? '✓' : '—'}</span>
              {v}
            </div>
          ))}
        </div>
        <div style={{ marginTop:12, fontSize:11, color:'#64748b' }}>
          時間生産性係数 <strong>{member.hourlyOrders}</strong> は、1時間あたりに処理できる注文数の想定値です。シフト配置時の必要人員計算に使用されます。
        </div>
      </div>

      {/* Shift calendar */}
      <div className="mgr-card" style={{ overflowX:'auto' }}>
        <div className="mgr-card-head">
          {YEAR_MONTH} 前半シフト
        </div>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-50">
              {daysConfig.map(d => (
                <th key={d.day} className={`text-center px-1 py-2 font-medium min-w-[52px] ${d.isWeekend ? 'text-red-500' : 'text-gray-500'}`}>
                  <div>{d.day}日</div>
                  <div className="text-[9px] font-normal">{d.dow}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {daysConfig.map((d, di) => {
                const code = row[di] || 'X'
                return (
                  <td key={d.day} className={`py-2 px-0.5 ${d.isWeekend ? 'bg-red-50/30' : ''}`}>
                    <div className={`text-center rounded py-2 px-1 font-medium ${getShiftColor(code)}`}>
                      {code === 'X' ? '休' : code}
                    </div>
                  </td>
                )
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
