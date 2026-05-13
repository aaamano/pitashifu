import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOrg } from '../../context/OrgContext'
import { supabase } from '../../lib/supabase'
import { readWorkbookFromFile, extractStaffList, extractSalesPatterns, extractShifts } from '../../utils/excelImport'
import * as employeesApi from '../../api/employees'
import { loadSettings, saveSettings } from '../../api/orgSettings'

// シフトコード → start_time / end_time
function parseShiftTimes(code) {
  if (!code || code === 'X') return null
  if (code === 'F') return { start: 9, end: 18 }
  const m = code.match(/^O-(\d+(?:\.\d+)?)$/)
  if (m) return { start: 9, end: parseFloat(m[1]) }
  const m2 = code.match(/^(\d+(?:\.\d+)?)[.-](\d+(?:\.\d+)?|L)$/)
  if (m2) return { start: parseFloat(m2[1]), end: m2[2] === 'L' ? 22 : parseFloat(m2[2]) }
  return null
}

const pad = (n) => String(n).padStart(2, '0')
const hhmm = (h) => `${pad(Math.floor(h))}:${pad(Math.round((h - Math.floor(h)) * 60))}:00`

// '平日①' → 'weekday1' などラベル → key
function patternLabelToKey(label) {
  if (!label) return null
  const l = String(label).trim()
  if (l.includes('平日①') || l === '平日1') return 'weekday1'
  if (l.includes('平日②') || l === '平日2') return 'weekday2'
  if (l.includes('平日'))                    return 'weekday1'
  if (l.includes('金'))                      return 'friday'
  if (l.includes('土'))                      return 'saturday'
  if (l.includes('日'))                      return 'sunday'
  return null
}

export default function Import() {
  const { orgId, stores } = useOrg()
  const storeId = stores[0]?.id
  const navigate = useNavigate()
  const fileRef = useRef(null)

  const [file,     setFile]     = useState(null)
  const [parsed,   setParsed]   = useState(null)
  const [parsing,  setParsing]  = useState(false)
  const [importing, setImporting] = useState(false)
  const [result,   setResult]   = useState(null)
  const [errMsg,   setErrMsg]   = useState('')

  // どのシートを取込対象にするか
  const [doStaff,    setDoStaff]    = useState(true)
  const [doPatterns, setDoPatterns] = useState(true)
  const [doShifts,   setDoShifts]   = useState(true)
  const [versionName, setVersionName] = useState('')

  const handleFile = async (f) => {
    if (!f) return
    setFile(f)
    setParsed(null); setResult(null); setErrMsg('')
    setParsing(true)
    try {
      const wb = await readWorkbookFromFile(f)
      const staffData    = extractStaffList(wb)
      const patternsData = extractSalesPatterns(wb)
      const shiftsData   = extractShifts(wb)
      setParsed({
        plan:    staffData.plan,
        staff:   staffData.staff,
        patterns: patternsData,
        shifts:  shiftsData.rows,
      })
      setVersionName(`Excel取込 ${new Date().toLocaleString('ja-JP').replace(/\//g, '-').slice(0, 16)}`)
    } catch (e) {
      console.error('[Import.parse]', e)
      setErrMsg('Excelの読み込みに失敗しました: ' + (e.message || ''))
    } finally {
      setParsing(false)
    }
  }

  const onFileInput = (e) => handleFile(e.target.files?.[0])
  const onDrop = (e) => {
    e.preventDefault()
    handleFile(e.dataTransfer.files?.[0])
  }

  const executeImport = async () => {
    if (!parsed || !orgId) return
    setImporting(true); setErrMsg(''); setResult(null)
    const r = { staff: { inserted: 0, updated: 0 }, patterns: 0, shifts: { saved: 0, skipped: 0, version: null }, errors: [] }
    try {
      // 1. スタッフ
      if (doStaff && parsed.staff?.length) {
        const items = parsed.staff.map(s => ({
          name: s.name,
          type: 'P', role: 'staff', skills: [], hourlyOrders: 7,
          wage: s.wage ?? 1050,
          transitPerDay: s.transit ?? 0,
        }))
        const { inserted, updated } = await employeesApi.bulkUpsertByName({ orgId, items })
        r.staff = { inserted, updated }
      }

      // 2. 売上パターン
      if (doPatterns && parsed.patterns?.length) {
        const existing = (await loadSettings(orgId)) || {}
        const merged = { ...(existing.salesPatterns || {}) }
        for (const p of parsed.patterns) {
          const key = patternLabelToKey(p.label)
          if (!key) continue
          merged[key] = { label: p.label, hourlySales: p.hourlySales }
          r.patterns++
        }
        await saveSettings(orgId, { ...existing, salesPatterns: merged })
      }

      // 3. シフト（version作成 + shifts bulk insert）
      if (doShifts && parsed.shifts?.length && storeId) {
        const year  = parsed.plan?.year  || 2026
        const month = parsed.plan?.month || 4
        // 3-1. 現在のemployeesを名前でマッピング
        const dbEmps = await employeesApi.listEmployees(orgId)
        const nameToId = new Map(dbEmps.map(e => [e.name, e.id]))
        // 3-2. 新しいshift_version作成
        const { data: { user } } = await supabase.auth.getUser()
        const { data: me } = await supabase.from('employees').select('id').eq('auth_user_id', user?.id ?? '').maybeSingle()
        const { data: ver, error: vErr } = await supabase
          .from('shift_versions')
          .insert({
            store_id: storeId,
            name: versionName || 'Excel取込',
            status: 'draft',
            author_id: me?.id ?? null,
          })
          .select()
          .single()
        if (vErr) throw vErr
        r.shifts.version = ver
        // 3-3. shifts行を生成
        const rows = []
        for (const sh of parsed.shifts) {
          const empId = nameToId.get(sh.name)
          if (!empId) {
            r.shifts.skipped += sh.days.filter(c => c && c !== 'X').length
            r.errors.push(`「${sh.name}」がDBに見つかりません（スキップ）`)
            continue
          }
          sh.days.forEach((code, idx) => {
            const t = parseShiftTimes(code)
            if (!t) return
            const day = idx + 1
            if (day > 31) return
            // 月末日チェック
            const lastDay = new Date(year, month, 0).getDate()
            if (day > lastDay) return
            rows.push({
              version_id:  ver.id,
              store_id:    storeId,
              employee_id: empId,
              date:        `${year}-${pad(month)}-${pad(day)}`,
              start_time:  hhmm(t.start),
              end_time:    hhmm(t.end),
              status:      'draft',
              is_open:     false,
            })
          })
        }
        if (rows.length) {
          const { error: insErr } = await supabase.from('shifts').insert(rows)
          if (insErr) throw insErr
        }
        r.shifts.saved = rows.length
      }

      setResult(r)
    } catch (e) {
      console.error('[Import.execute]', e)
      setErrMsg(e.message || 'インポート中にエラーが発生しました')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="mgr-page" style={{ maxWidth: 900 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.01em', margin: 0 }}>インポート</h1>
        <p style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
          ピタシフExcelテンプレート (.xlsx) からスタッフ・売上パターン・シフトをまとめて取込します
        </p>
      </div>

      {errMsg && (
        <div style={{ marginBottom:14, padding:'10px 14px', background:'#FEE2E2', color:'#991B1B', border:'1px solid #FECACA', borderRadius:8, fontSize:13 }}>
          {errMsg}
        </div>
      )}

      {/* STEP 1: ファイル選択 */}
      <div className="mgr-card" style={{ padding: 24, marginBottom: 20 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', margin: '0 0 12px' }}>STEP 1: Excelファイルを選択</h2>
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          style={{
            border: '2px dashed #c7d2fe', borderRadius: 12, padding: '32px 20px',
            textAlign: 'center', cursor: 'pointer', background: '#f8fafc',
          }}
        >
          <div style={{ fontSize: 28, marginBottom: 6 }}>📁</div>
          <div style={{ fontSize: 13, color: '#475569', fontWeight: 600 }}>
            {file ? file.name : 'クリックまたはドラッグでファイル選択'}
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>.xlsx / .xls</div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={onFileInput} />
        </div>
        {parsing && <div style={{ marginTop: 10, fontSize: 12, color: '#475569' }}>解析中…</div>}
      </div>

      {/* STEP 2: プレビュー */}
      {parsed && (
        <div className="mgr-card" style={{ padding: 24, marginBottom: 20 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', margin: '0 0 12px' }}>STEP 2: 取込内容のプレビュー</h2>
          {parsed.plan?.year && (
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
              対象月: {parsed.plan.year}年{parsed.plan.month}月 / 店舗: {parsed.plan.store ?? '—'}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <PreviewRow
              checked={doStaff} onToggle={setDoStaff}
              title={`スタッフ (${parsed.staff.length}名)`}
              detail={parsed.staff.slice(0, 5).map(s => `${s.name}(¥${s.wage ?? '?'})`).join(' / ') + (parsed.staff.length > 5 ? ` ... ほか${parsed.staff.length - 5}名` : '')}
            />
            <PreviewRow
              checked={doPatterns} onToggle={setDoPatterns}
              title={`時間帯別売上パターン (${parsed.patterns.length}件)`}
              detail={parsed.patterns.map(p => p.label).join(' / ')}
            />
            <PreviewRow
              checked={doShifts} onToggle={setDoShifts}
              title={`シフト表 (${parsed.shifts.length}名分)`}
              detail={`新しいバージョンを作成して取込（version名は下記）`}
            />
          </div>
          {doShifts && (
            <div style={{ marginTop: 14 }}>
              <label className="mgr-label">バージョン名</label>
              <input className="mgr-input" value={versionName} onChange={e => setVersionName(e.target.value)} />
            </div>
          )}
        </div>
      )}

      {/* STEP 3: 実行 */}
      {parsed && (
        <div className="mgr-card" style={{ padding: 24, marginBottom: 20 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', margin: '0 0 12px' }}>STEP 3: 取込実行</h2>
          <button
            onClick={executeImport}
            disabled={importing || !orgId}
            className="mgr-btn-primary"
            style={{ minWidth: 200 }}
          >
            {importing ? '取込中…' : '取込を実行する'}
          </button>
        </div>
      )}

      {/* 結果 */}
      {result && (
        <div className="mgr-card" style={{ padding: 24, marginBottom: 20, borderLeft: '4px solid #10b981' }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: '#065f46', margin: '0 0 12px' }}>✓ 取込が完了しました</h2>
          <ul style={{ fontSize: 13, color: '#334155', lineHeight: 1.8, marginLeft: 18, padding: 0 }}>
            <li>スタッフ: 新規 <b>{result.staff.inserted}</b>名 / 更新 <b>{result.staff.updated}</b>名</li>
            <li>売上パターン: <b>{result.patterns}</b>件をマージ保存</li>
            <li>シフト: <b>{result.shifts.saved}</b>件のシフトを「{result.shifts.version?.name}」に保存 {result.shifts.skipped ? `（${result.shifts.skipped}件スキップ）` : ''}</li>
          </ul>
          {result.errors?.length > 0 && (
            <details style={{ marginTop: 10 }}>
              <summary style={{ fontSize: 12, color: '#dc2626', cursor: 'pointer' }}>警告 {result.errors.length}件</summary>
              <ul style={{ fontSize: 11, color: '#991B1B', marginLeft: 18 }}>
                {result.errors.slice(0, 20).map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </details>
          )}
          {result.shifts.version && (
            <button
              onClick={() => navigate(`/${orgId}/manager/shift/${result.shifts.version.id}`)}
              className="mgr-btn-secondary"
              style={{ marginTop: 14 }}
            >
              シフト管理画面で確認 →
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function PreviewRow({ checked, onToggle, title, detail }) {
  return (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px', background: checked ? '#eef0fe' : '#f8fafc', border: `1px solid ${checked ? '#c7d2fe' : '#e2e8f0'}`, borderRadius: 8, cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={() => onToggle(!checked)} style={{ marginTop: 3 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{title}</div>
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, wordBreak: 'break-all' }}>{detail}</div>
      </div>
    </label>
  )
}
