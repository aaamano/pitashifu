// ピタシフ用 Excel (.xlsx) インポートユーティリティ
//
// 「ピタシフ_テストデータ.xlsx」相当の Excel をそのままアップロードして、
// 各画面 (メンバー管理 / 目標計画 / シフト決定) の CSV 取込と同等の結果を得る。
//
// シート構成 (主要):
//   ﾃﾞｰﾀ入力       : 計画データ・スタッフリスト・時間帯別売上パターン
//   ｼﾌﾄ原本 / ｼﾌﾄ表 : 1〜31日のシフトコード一覧
//
// 名前マッチング:
//   Excel の名前列は「K.M」のような短縮形が多く、ﾓｯｸﾃﾞｰﾀ の「金子 光男」と
//   一致しない場合がある。そのため、可能なら NO. 列 (id) を優先キーにする。

import * as XLSX from 'xlsx'

// ── ファイル → SheetJS workbook ───────────────────────────────────────────
export const readWorkbookFromFile = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result)
      const wb = XLSX.read(data, { type: 'array', cellDates: false })
      resolve(wb)
    } catch (err) { reject(err) }
  }
  reader.onerror = () => reject(reader.error)
  reader.readAsArrayBuffer(file)
})

// ── シート → 行配列 (A1基点, 1‑indexed → cells[col] = value) ──────────────
const sheetToCellRows = (ws) => {
  if (!ws || !ws['!ref']) return []
  const range = XLSX.utils.decode_range(ws['!ref'])
  const rows = []
  for (let R = range.s.r; R <= range.e.r; R++) {
    const row = {}
    for (let C = range.s.c; C <= range.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C })
      const cell = ws[addr]
      if (!cell) continue
      const colLetter = XLSX.utils.encode_col(C)
      row[colLetter] = cell.v
    }
    rows.push(row)
  }
  return rows
}

const findSheet = (wb, candidates) => {
  for (const name of wb.SheetNames) {
    for (const cand of candidates) {
      if (name === cand || name.includes(cand)) return wb.Sheets[name]
    }
  }
  return null
}

// Excel の時刻 (0..1 の小数) → 時 (整数, 0..23)
const fracToHour = (v) => {
  if (v == null || v === '') return null
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  // 0.2083... = 5:00, 0.25 = 6:00, ... 0.9583 = 23:00, 0 = 0:00
  return Math.round(n * 24) % 24
}

// 数値文字列 → number (整数 or 浮動)
const toNum = (v) => {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

const toInt = (v) => {
  const n = toNum(v)
  return n == null ? null : Math.round(n)
}

// ─────────────────────────────────────────────────────────────────────────
// ① スタッフリストを取り出す
//    ﾃﾞｰﾀ入力 シート C/D/E/F 列 (NO. / 名前 / 時給 / 交通費), 3行目〜
// ─────────────────────────────────────────────────────────────────────────
export const extractStaffList = (wb) => {
  const ws = findSheet(wb, ['ﾃﾞｰﾀ入力', 'データ入力'])
  if (!ws) return { staff: [], plan: {} }
  const rows = sheetToCellRows(ws)

  // 計画データ (年/店舗/月) は A/B 列の 3〜5 行目あたり
  const plan = {}
  for (const r of rows.slice(0, 8)) {
    const label = String(r.A ?? '').trim()
    const value = r.B
    if (!label) continue
    if (label.startsWith('年'))       plan.year  = toInt(value)
    else if (label.startsWith('店舗')) plan.store = String(value ?? '')
    else if (label.startsWith('月'))   plan.month = toInt(value)
  }

  // スタッフ行: NO.(C) が数値、名前(D) が空でない
  const staff = []
  for (const r of rows) {
    const no = toInt(r.C)
    const name = r.D == null ? '' : String(r.D).trim()
    if (!no || !name) continue
    if (name === '名前') continue
    const wage   = toInt(r.E) ?? null
    const transit = toInt(r.F) ?? 0
    staff.push({ no, name, wage, transit })
  }
  return { staff, plan }
}

// ─────────────────────────────────────────────────────────────────────────
// ② 時間帯別売上パターンを取り出す
//    ﾃﾞｰﾀ入力 シート、H/J = 時刻範囲、K/N/Q/T/W が各パターン売上 (¥)。
//    各値カラムの隣 (L/O/R/U/X) に "平日①" 等の day-type ラベルが入る。
//    総売上が極端に小さい列はノイズ (隣接領域の OP・CL データ等) として除外する。
// ─────────────────────────────────────────────────────────────────────────
const PATTERN_VALUE_COLS = ['K', 'N', 'Q', 'T', 'W']
const nextCol = (c) => XLSX.utils.encode_col(XLSX.utils.decode_col(c) + 1)
const PATTERN_LABEL_COLS = PATTERN_VALUE_COLS.map(nextCol)
const PATTERN_MIN_TOTAL = 10000 // ¥ 未満はパターンとして扱わない

export const extractSalesPatterns = (wb) => {
  const ws = findSheet(wb, ['ﾃﾞｰﾀ入力', 'データ入力'])
  if (!ws) return []
  const rows = sheetToCellRows(ws)

  // ヘッダ行 (行2: index 1) からパターン名を拾う (隣接ラベル列を優先)
  const header = rows[1] || {}
  const patterns = PATTERN_VALUE_COLS.map((col, i) => {
    const lbl =
      String(header[PATTERN_LABEL_COLS[i]] ?? '').trim() ||
      String(header[col] ?? '').trim() ||
      `パターン${i + 1}`
    return { col, label: lbl, hourlySales: {} }
  })

  // 時刻範囲とパターン売上は 3 行目以降。時刻が割り当てられている行を読む
  for (const r of rows.slice(2)) {
    const startH = fracToHour(r.H)
    if (startH == null) continue
    patterns.forEach(p => {
      const v = toNum(r[p.col])
      if (v != null && v > 0) p.hourlySales[startH] = Math.round(v)
    })
  }
  // 総売上が極小のパターンは除外
  return patterns.filter(p => {
    const total = Object.values(p.hourlySales).reduce((a, b) => a + b, 0)
    return total >= PATTERN_MIN_TOTAL
  })
}

// ─────────────────────────────────────────────────────────────────────────
// ③ シフトコード (1日〜31日) を取り出す
//    ｼﾌﾄ原本 シート: 行3 が日番号 (E〜AI = 1〜31), 行5以降がスタッフ行
//    A=No., B=No., C=名前, D=連絡先, E〜AI = 各日のシフトコード
// ─────────────────────────────────────────────────────────────────────────
const SHIFT_DAY_COLS = (() => {
  // E (4) 〜 AI (34) の31列
  const out = []
  for (let c = 4; c <= 34; c++) out.push(XLSX.utils.encode_col(c))
  return out
})()

export const extractShifts = (wb) => {
  const ws = findSheet(wb, ['ｼﾌﾄ原本', 'シフト原本'])
  if (!ws) return { rows: [] }
  const rows = sheetToCellRows(ws)

  const out = []
  for (const r of rows) {
    const no = toInt(r.A)
    const name = r.C == null ? '' : String(r.C).trim()
    if (!no || !name) continue
    if (name === 'No.' || name === '氏名' || name === '連絡先') continue
    const days = []
    SHIFT_DAY_COLS.forEach((col) => {
      const v = r[col]
      const code = v == null ? '' : String(v).trim()
      days.push(code)
    })
    out.push({ no, name, days })
  }
  return { rows: out }
}

// 1パターン (hourlySales) を SALES_PATTERNS 形式の patterns オブジェクトに
// マージするヘルパ。可能な限り label を見て対応する key を推測する。
export const matchPatternKey = (label, currentPatterns) => {
  if (!label) return null
  const l = String(label).trim()
  // 例: "平日①" → "weekday1", "平日②" → "weekday2", "金曜" → "friday",
  //     "土曜"/"土" → "saturday", "日祝"/"日" → "sunday"
  const map = {
    '平日①': 'weekday1', '平日1': 'weekday1', '平日': 'weekday1',
    '平日②': 'weekday2', '平日2': 'weekday2',
    '金曜': 'friday', '金': 'friday',
    '土曜': 'saturday', '土': 'saturday',
    '日祝': 'sunday', '日': 'sunday',
  }
  for (const [k, v] of Object.entries(map)) {
    if (l.includes(k) && currentPatterns?.[v]) return v
  }
  return null
}
