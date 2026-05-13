import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { staff as mockStaff } from '../../data/mockData'
import EmployeeTabBar from '../../components/EmployeeTabBar'
import { useOrg } from '../../context/OrgContext'
import { supabase } from '../../lib/supabase'
import * as shiftsApi from '../../api/shifts'

const INDIGO = '#4F46E5'
const CORAL  = '#FF6B6B'
const BORDER = '#E2E8F0'
const DOW_HEADERS = ['日', '月', '火', '水', '木', '金', '土']
const DOW_JP = ['日', '月', '火', '水', '木', '金', '土']

// 月の daysConfig を動的生成
function buildDaysConfig(year, month) {
  const lastDay = new Date(year, month, 0).getDate()
  return Array.from({ length: lastDay }, (_, i) => {
    const day = i + 1
    const dow = new Date(year, month - 1, day).getDay()
    return {
      day,
      dow: DOW_JP[dow],
      dowIdx: dow,
      isWeekend: dow === 0 || dow === 6,
    }
  })
}

// assigned[day][slot]=[empId,...] → 当該日の連続スロット → コード
function deriveDayCode(daySlots, empId) {
  if (!daySlots) return 'X'
  const hours = []
  for (const [slot, ids] of Object.entries(daySlots)) {
    if (Array.isArray(ids) && ids.includes(empId)) {
      const h = parseInt(slot.split(':')[0], 10)
      if (!Number.isNaN(h)) hours.push(h)
    }
  }
  if (!hours.length) return 'X'
  hours.sort((a, b) => a - b)
  const s = hours[0], e = hours[hours.length - 1] + 1
  if (s === 9 && e === 18) return 'F'
  if (s === 9) return `O-${e}`
  if (e === 22) return `${s}-L`
  return `${s}-${e}`
}

function parseCode(code) {
  if (!code || code === 'X') return null
  if (code === 'F') return { start: 9, end: 18 }
  const m = code.match(/^O-(\d+(?:\.\d+)?)$/)
  if (m) return { start: 9, end: parseFloat(m[1]) }
  const m2 = code.match(/^(\d+(?:\.\d+)?)[.-](\d+(?:\.\d+)?|L)$/)
  if (m2) return { start: parseFloat(m2[1]), end: m2[2] === 'L' ? 22 : parseFloat(m2[2]) }
  return null
}

function fmtH(h) {
  const hh = Math.floor(h)
  const mm = Math.round((h - hh) * 60)
  return `${hh}:${mm === 0 ? '00' : String(mm).padStart(2, '0')}`
}

function shiftHours(code) {
  const t = parseCode(code)
  if (!t) return 0
  return Math.max(0, t.end - t.start - 1)
}

const pad = (n) => String(n).padStart(2, '0')

export default function Schedule({ base: baseProp, sukima = false }) {
  const { orgId: paramOrg } = useParams()
  const navigate = useNavigate()
  const base = baseProp ?? `/${paramOrg}/employee`
  const { stores } = useOrg()
  const storeId = stores[0]?.id

  // 月選択（今日の年月を初期値）
  const today = new Date()
  const [year,  setYear]  = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const monthLabel = `${year}年${month}月`
  const daysConfig = useMemo(() => buildDaysConfig(year, month), [year, month])
  const firstDow   = daysConfig[0]?.dowIdx ?? 0

  // 今日にあたる日（同じ月の時のみ）
  const todayDay = (today.getFullYear() === year && today.getMonth() + 1 === month)
    ? today.getDate()
    : daysConfig[0]?.day ?? 1
  const [selectedDay, setSelectedDay] = useState(todayDay)
  useEffect(() => { setSelectedDay(todayDay) }, [year, month, todayDay])

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12) } else { setMonth(m => m - 1) }
  }
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1) } else { setMonth(m => m + 1) }
  }

  // 現在ログイン中ユーザーの employees 行
  const [me, setMe]               = useState(null)
  const [meLoading, setMeLoading] = useState(true)
  const [myShifts, setMyShifts]   = useState([])

  useEffect(() => {
    let cancelled = false
    setMeLoading(true)
    ;(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (cancelled) return
        if (!user) { setMe(null); return }
        const { data: meRow } = await supabase
          .from('employees')
          .select('*')
          .eq('auth_user_id', user.id)
          .maybeSingle()
        if (!cancelled) setMe(meRow ?? null)
      } catch (e) {
        console.error('[Schedule.loadMe]', e)
      } finally {
        if (!cancelled) setMeLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  // 選択月のシフトを date 範囲でロードして自分のコード配列を組み立て
  useEffect(() => {
    if (!me || !storeId) { setMyShifts(daysConfig.map(() => 'X')); return }
    let cancelled = false
    const dateFrom = `${year}-${pad(month)}-01`
    const dateTo   = `${year}-${pad(month)}-${pad(daysConfig.length)}`
    shiftsApi.loadShiftsByDateRange({ storeId, dateFrom, dateTo })
      .then(assigned => {
        if (cancelled) return
        setMyShifts(daysConfig.map(d => deriveDayCode(assigned?.[d.day], me.id)))
      })
      .catch(e => console.error('[Schedule.loadShifts]', e))
    return () => { cancelled = true }
  }, [me, storeId, year, month, daysConfig])

  // 選択日の最終編集者情報を shift_requests から取得
  const [editorInfo, setEditorInfo] = useState(null)
  useEffect(() => {
    if (!me) { setEditorInfo(null); return }
    let cancelled = false
    const dateStr = `${year}-${pad(month)}-${pad(selectedDay)}`
    ;(async () => {
      try {
        const { data } = await supabase
          .from('shift_requests')
          .select('last_edited_at, editor:employees!shift_requests_last_edited_by_fkey(name)')
          .eq('employee_id', me.id)
          .eq('date', dateStr)
          .maybeSingle()
        if (!cancelled) setEditorInfo(data ?? null)
      } catch (e) { console.error('[Schedule.editorInfo]', e) }
    })()
    return () => { cancelled = true }
  }, [me, year, month, selectedDay])

  // DBから取れていない時のフォールバック（未ログインや読み込み中）
  const meDisp = me ?? (meLoading ? null : mockStaff[0])
  const myShiftsDisp = myShifts.length === daysConfig.length ? myShifts : daysConfig.map(() => 'X')

  if (!meDisp) {
    return (
      <>
        <div className="pita-phone-header" style={{ justifyContent: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>読み込み中…</div>
        </div>
        <div className="pita-phone-body" />
        <EmployeeTabBar base={base} sukima={sukima} />
      </>
    )
  }

  const workDays  = myShiftsDisp.filter(c => c && c !== 'X').length
  const workHours = myShiftsDisp.reduce((s, c) => s + shiftHours(c), 0)
  const estPay    = workHours * (meDisp.wage ?? 1050)

  const selCode  = myShiftsDisp[selectedDay - 1]
  const selShift = parseCode(selCode)
  const selDow   = daysConfig[selectedDay - 1]?.dow

  // カレンダーセル: nullで先頭パディング → 日番号 → nullで末尾パディング
  const calCells = [
    ...Array(firstDow).fill(null),
    ...daysConfig.map(d => d.day),
  ]
  while (calCells.length % 7 !== 0) calCells.push(null)

  return (
    <>
      {/* Header with month navigation */}
      <div className="pita-phone-header" style={{ justifyContent: 'space-between' }}>
        <button onClick={prevMonth} aria-label="前月"
          style={{ background:'none', border:'none', color: INDIGO, fontSize: 18, fontWeight: 700, cursor: 'pointer', padding: '4px 10px' }}>‹</button>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#0F172A' }}>{monthLabel}</div>
          <div style={{ fontSize: 10, color: '#94A3B8' }}>{meDisp.name}</div>
        </div>
        <button onClick={nextMonth} aria-label="翌月"
          style={{ background:'none', border:'none', color: INDIGO, fontSize: 18, fontWeight: 700, cursor: 'pointer', padding: '4px 10px' }}>›</button>
      </div>

      <div className="pita-phone-body">

        {/* Monthly summary */}
        <div style={{ display: 'flex', gap: 8, padding: '12px 12px 0', flexShrink: 0 }}>
          {[
            { label: '出勤日数', value: `${workDays}日` },
            { label: '勤務時間', value: `${workHours}h` },
            { label: '想定収入', value: `¥${estPay.toLocaleString()}` },
          ].map(({ label, value }) => (
            <div key={label} style={{
              flex: 1, background: 'white', border: `1px solid ${BORDER}`,
              borderRadius: 10, padding: '9px 6px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 9, color: '#94A3B8', marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Calendar */}
        <div style={{ padding: '14px 12px', flexShrink: 0 }}>
          <div style={{ background: 'white', borderRadius: 12, padding: '10px 6px', border: `1px solid ${BORDER}` }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
              {DOW_HEADERS.map((dow, i) => (
                <div key={dow} style={{ fontSize: 9, fontWeight: 600, color: i === 0 ? CORAL : i === 6 ? '#3b82c4' : '#94A3B8', textAlign: 'center', padding: '4px 0' }}>{dow}</div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
              {calCells.map((day, idx) => {
                if (day == null) return <div key={idx} />
                const code    = myShiftsDisp[day - 1]
                const shift   = parseCode(code)
                const dowIdx  = (firstDow + day - 1) % 7
                const isSelected = day === selectedDay
                const dowColor = dowIdx === 0 ? CORAL : dowIdx === 6 ? '#3b82c4' : '#0F172A'
                return (
                  <button key={idx} onClick={() => setSelectedDay(day)} style={{
                    aspectRatio: '1 / 1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    background: isSelected ? INDIGO : shift ? '#EEF0FE' : 'white',
                    color: isSelected ? 'white' : dowColor,
                    border: isSelected ? `1px solid ${INDIGO}` : `1px solid ${BORDER}`,
                    borderRadius: 6, cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', padding: 0,
                  }}>
                    <div style={{ fontWeight: isSelected ? 700 : 500 }}>{day}</div>
                    {shift && (
                      <div style={{ fontSize: 8, marginTop: 1, opacity: isSelected ? 0.85 : 0.7, color: isSelected ? 'white' : '#475569' }}>
                        {fmtH(shift.start)}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Selected day details */}
        <div style={{ padding: '0 12px 14px', flexShrink: 0 }}>
          <div style={{ background: 'white', borderRadius: 12, padding: '14px 16px', border: `1px solid ${BORDER}` }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>
                {month}月{selectedDay}日 <span style={{ fontSize: 11, color: selDow === '日' ? CORAL : selDow === '土' ? '#3b82c4' : '#94A3B8', marginLeft: 4 }}>({selDow})</span>
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: selShift ? INDIGO : '#94A3B8' }}>
                {selShift ? '出勤' : '休み'}
              </div>
            </div>
            {selShift ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {[
                  { l: '勤務時間', v: `${fmtH(selShift.start)} 〜 ${fmtH(selShift.end)}` },
                  { l: '労働時間', v: `${Math.max(0, selShift.end - selShift.start - 1)}h` },
                  { l: '想定報酬', v: `¥${(Math.max(0, selShift.end - selShift.start - 1) * (meDisp.wage ?? 1050)).toLocaleString()}` },
                  { l: '時給',     v: `¥${(meDisp.wage ?? 1050).toLocaleString()}` },
                ].map(({ l, v }) => (
                  <div key={l} style={{ background: '#F8FAFC', borderRadius: 8, padding: '8px 10px' }}>
                    <div style={{ fontSize: 9, color: '#94A3B8', marginBottom: 1 }}>{l}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#0F172A', fontFamily: 'system-ui' }}>{v}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center', padding: '12px 0' }}>この日は出勤予定がありません</div>
            )}
            {editorInfo?.last_edited_at && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${BORDER}`, fontSize: 10, color: '#94A3B8' }}>
                最終編集: {editorInfo.editor?.name ?? '—'} ／ {new Date(editorInfo.last_edited_at).toLocaleString('ja-JP')}
              </div>
            )}
          </div>
        </div>

      </div>

      <EmployeeTabBar base={base} sukima={sukima} />
    </>
  )
}
