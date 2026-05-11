export const STORE_NAME = 'Segafredo ZANETTI 新宿三丁目店'
export const YEAR_MONTH = '2026年4月'

export const staff = [
  { id: 1,  name: '金子 光男',       type: 'F',    role: 'マネージャー', skills: ['barista', 'cashier', 'floor', 'opening', 'closing'], hourlyOrders: 12, wage: 1250, transitPerDay: 0    },
  { id: 2,  name: '澤井 詩議',       type: 'F',    role: 'サブマネージャー', skills: ['barista', 'cashier', 'opening', 'closing'], hourlyOrders: 11, wage: 1200, transitPerDay: 1050 },
  { id: 3,  name: '吉田 郁美',       type: 'P',    role: 'スタッフ',     skills: ['barista', 'cashier', 'floor', 'opening'], hourlyOrders: 9,  wage: 1050, transitPerDay: 272  },
  { id: 4,  name: '岩間 康尚',       type: 'P',    role: 'スタッフ',     skills: ['cashier', 'floor'],             hourlyOrders: 8,  wage: 1050, transitPerDay: 962  },
  { id: 5,  name: '杉崎 浩枝',       type: 'P',    role: 'スタッフ',     skills: ['cashier'],                      hourlyOrders: 7,  wage: 1050, transitPerDay: 682  },
  { id: 6,  name: 'スクアルチナ マルコ', type: 'P', role: 'バリスタ',   skills: ['barista', 'cashier', 'floor', 'opening'], hourlyOrders: 13, wage: 1100, transitPerDay: 1050 },
  { id: 7,  name: '二関 大地',       type: 'P',    role: 'スタッフ',     skills: ['floor', 'closing'],                        hourlyOrders: 7,  wage: 1050, transitPerDay: 420  },
  { id: 8,  name: '松井 華乃',       type: 'P',    role: 'スタッフ',     skills: ['cashier', 'floor'],             hourlyOrders: 8,  wage: 1050, transitPerDay: 1430 },
  { id: 9,  name: '堀内 省吾',       type: 'P',    role: 'スタッフ',     skills: ['floor', 'closing'],                        hourlyOrders: 6,  wage: 1030, transitPerDay: 648  },
  { id: 10, name: '崔 恩雄',         type: 'P',    role: 'スタッフ',     skills: ['barista', 'floor', 'opening'],             hourlyOrders: 9,  wage: 1050, transitPerDay: 712  },
  { id: 11, name: 'クイ',            type: 'P',    role: 'スタッフ',     skills: ['floor'],                        hourlyOrders: 6,  wage: 1030, transitPerDay: 1028 },
  { id: 12, name: '吉冨 寛大',       type: 'P',    role: 'スタッフ',     skills: ['cashier', 'floor', 'closing'],             hourlyOrders: 7,  wage: 1050, transitPerDay: 0    },
  { id: 13, name: '譚木 りさ',       type: 'P',    role: 'スタッフ',     skills: ['barista', 'cashier'],           hourlyOrders: 8,  wage: 1050, transitPerDay: 900  },
  { id: 14, name: '飯田 奈洋美',     type: 'P',    role: 'スタッフ',     skills: ['cashier', 'floor', 'closing'],             hourlyOrders: 8,  wage: 1050, transitPerDay: 2442 },
  { id: 15, name: '若林 百央',       type: 'P',    role: 'スタッフ',     skills: ['barista'],                      hourlyOrders: 7,  wage: 1050, transitPerDay: 376  },
  { id: 16, name: '吉野 友吾',       type: 'P',    role: 'スタッフ',     skills: ['floor'],                        hourlyOrders: 6,  wage: 1030, transitPerDay: 356  },
  { id: 17, name: 'サラ',            type: 'P',    role: 'スタッフ',     skills: ['cashier', 'floor'],             hourlyOrders: 7,  wage: 1050, transitPerDay: 418  },
  { id: 18, name: 'アイリーン',      type: 'P',    role: 'スタッフ',     skills: ['floor', 'closing'],                        hourlyOrders: 6,  wage: 1030, transitPerDay: 682  },
  { id: 19, name: 'エミリー',        type: 'P',    role: 'バリスタ',     skills: ['barista', 'cashier'],           hourlyOrders: 10, wage: 1080, transitPerDay: 816  },
  { id: 20, name: '薬方 咲',         type: 'P',    role: 'スタッフ',     skills: ['cashier', 'floor'],             hourlyOrders: 7,  wage: 1050, transitPerDay: 320  },
  { id: 21, name: '佐藤 慧',         type: 'F',    role: 'スタッフ',     skills: ['barista', 'cashier', 'floor', 'opening', 'closing'], hourlyOrders: 9,  wage: 1080, transitPerDay: 682  },
]

const DAYS_IN_MONTH = 30 // 月全体
// 2026年4月の曜日配列 (4/1=水 ... 4/30=木)
const DOW = ['水','木','金','土','日','月','火','水','木','金','土','日','月','火','水',
             '木','金','土','日','月','火','水','木','金','土','日','月','火','水','木']

export const daysConfig = Array.from({ length: DAYS_IN_MONTH }, (_, i) => ({
  day: i + 1,
  dow: DOW[i],
  isWeekend: ['土','日'].includes(DOW[i]),
  half: i < 15 ? 'first' : 'second',
}))

// Shift patterns per staff (simplified)
const SP = {
  F: 'F', X: 'X', O16: 'O-16', O14: 'O-14', O18: 'O-18',
  '918': '9-18', '1018': '10-18', '1020': '10-20', '1116': '11-16',
  '1318': '13-18', '13L': '13-L', '11L': '11-L', '14L': '14-L',
  '175L': '17.5-L', '1820': '18-L', '1116b': '11-16', '1519': '15-19',
  '913': '9-13',
}

export const shiftData = {
  1:  [SP.F,   SP.F,   SP.F,   SP.F,   SP.X,   SP.F,   SP.F,   SP.F,   SP.F,   SP.F,   SP.F,   SP.F,   SP.F,   SP.F,   SP.F],
  2:  [SP.F,   SP.X,   SP.F,   SP.F,   SP.F,   SP.F,   SP.F,   SP.F,   SP.F,   SP.F,   SP.F,   SP.F,   SP.F,   SP.F,   SP.F],
  3:  [SP.X,   SP['918'],SP.X, SP.X,   SP.X,   SP['918'],SP.X,  SP['918'],SP['913'],SP.X, SP.X,   SP.X,   SP['918'],SP['918'],SP['918']],
  4:  [SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X],
  5:  [SP.X,   SP.X,   SP['13L'],SP['13L'],SP.X,SP.X,   SP.X,   SP.X,   SP.X,   SP['13L'],SP['13L'],SP.X, SP.X,   SP.X,   SP.X],
  6:  [SP.O16, SP.O16, SP.X,   SP.O18, SP.O18, SP.X,   SP.O16, SP.O16, SP.O16, SP.X,   SP.O18, SP.O18, SP.X,   SP.O16, SP.X],
  7:  [SP.X,   SP.X,   SP.X,   SP['13L'],SP['14L'],SP['14L'],SP.X,SP.X, SP.X,   SP.X,   SP['13L'],SP['14L'],SP['14L'],SP.X, SP.X],
  8:  [SP.O16, SP.O16, SP.O14, SP.O14, SP.X,   SP.X,   SP.O16, SP.O16, SP.O16, SP.X,   SP.X,   SP.X,   SP.O16, SP.X,   SP.O16],
  9:  [SP.X,   SP['13L'],SP['13L'],SP['11L'],SP['14L'],SP.X,   SP.X,   SP['13L'],SP['13L'],SP['13L'],SP['11L'],SP['11L'],SP.X,SP.X,SP['13L']],
  10: [SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X],
  11: [SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X],
  12: [SP.X,   SP.X,   SP.X,   SP.O14, SP.X,   SP.X,   SP.X,   SP.O16, SP.O14, SP.X,   SP['1116'],SP.X,SP.X,   SP.X,   SP.X],
  13: [SP['1020'],SP.X,SP['1020'],SP.X,SP.X,    SP.X,   SP.X,   SP['1020'],SP.X,SP['1020'],SP.X,SP.X,   SP.X,   SP['1116'],SP['1020']],
  14: [SP.X,   SP.X,   SP.X,   SP['913'],SP['918'],SP.X,SP['918'],SP.X,SP['913'],SP['918'],SP['1116'],SP['913'],SP.X,SP['918'],SP.X],
  15: [SP['1116'],SP.X,SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP['1116'],SP['1116'],SP.X,SP.X,  SP.X],
  16: [SP.X,   SP['175L'],SP.X,SP['175L'],SP.X,SP['175L'],SP.X,SP['175L'],SP.X,  SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X],
  17: [SP.X,   SP['11L'],SP['11L'],SP.X,SP.X,   SP.X,   SP.X,   SP['14L'],SP['14L'],SP['14L'],SP.X,SP.X,  SP.X,   SP['14L'],SP['14L']],
  18: [SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X],
  19: [SP.X,   SP['1820'],SP.X,SP['1820'],SP['1820'],SP['13L'],SP.X,SP['1820'],SP['1519'],SP.X,SP['1820'],SP.X,SP['13L'],SP['1519'],SP.X],
  20: [SP.X,   SP.X,   SP.X,   SP.X,   SP['14L'],SP.X, SP.X,   SP.X,   SP.X,   SP['14L'],SP['14L'],SP.X,SP['14L'],SP.X,  SP.X],
  21: [SP.F,   SP.F,   SP.F,   SP.F,   SP.F,   SP.F,   SP.F,   SP.F,   SP.F,   SP.F,   SP.F,   SP.X,   SP.F,   SP.F,   SP.F],
}
// 後半(16-30日)はサンプルとして前半をミラーリング
Object.keys(shiftData).forEach(id => { shiftData[id] = [...shiftData[id], ...shiftData[id]] })

export const dailyTargets = [
  { day: 1,  dow: '水', sales: 420, customers: 140, avgSpend: 3000, orders: 210, laborCost: 130, isWeekend: false },
  { day: 2,  dow: '木', sales: 410, customers: 137, avgSpend: 2993, orders: 205, laborCost: 127, isWeekend: false },
  { day: 3,  dow: '金', sales: 480, customers: 160, avgSpend: 3000, orders: 240, laborCost: 149, isWeekend: false },
  { day: 4,  dow: '土', sales: 620, customers: 206, avgSpend: 3010, orders: 310, laborCost: 198, isWeekend: true  },
  { day: 5,  dow: '日', sales: 590, customers: 196, avgSpend: 3010, orders: 295, laborCost: 189, isWeekend: true  },
  { day: 6,  dow: '月', sales: 380, customers: 126, avgSpend: 3016, orders: 190, laborCost: 118, isWeekend: false },
  { day: 7,  dow: '火', sales: 370, customers: 123, avgSpend: 3008, orders: 185, laborCost: 115, isWeekend: false },
  { day: 8,  dow: '水', sales: 415, customers: 138, avgSpend: 3007, orders: 207, laborCost: 129, isWeekend: false },
  { day: 9,  dow: '木', sales: 405, customers: 135, avgSpend: 3000, orders: 202, laborCost: 126, isWeekend: false },
  { day: 10, dow: '金', sales: 475, customers: 158, avgSpend: 3006, orders: 237, laborCost: 147, isWeekend: false },
  { day: 11, dow: '土', sales: 650, customers: 216, avgSpend: 3009, orders: 325, laborCost: 208, isWeekend: true  },
  { day: 12, dow: '日', sales: 610, customers: 203, avgSpend: 3004, orders: 305, laborCost: 195, isWeekend: true  },
  { day: 13, dow: '月', sales: 360, customers: 120, avgSpend: 3000, orders: 180, laborCost: 112, isWeekend: false },
  { day: 14, dow: '火', sales: 355, customers: 118, avgSpend: 3008, orders: 177, laborCost: 110, isWeekend: false },
  { day: 15, dow: '水', sales: 425, customers: 141, avgSpend: 3014, orders: 212, laborCost: 132, isWeekend: false },
  { day: 16, dow: '木', sales: 415, customers: 138, avgSpend: 3007, orders: 207, laborCost: 129, isWeekend: false },
  { day: 17, dow: '金', sales: 485, customers: 162, avgSpend: 2994, orders: 242, laborCost: 150, isWeekend: false },
  { day: 18, dow: '土', sales: 635, customers: 211, avgSpend: 3009, orders: 317, laborCost: 203, isWeekend: true  },
  { day: 19, dow: '日', sales: 600, customers: 199, avgSpend: 3015, orders: 300, laborCost: 192, isWeekend: true  },
  { day: 20, dow: '月', sales: 375, customers: 124, avgSpend: 3024, orders: 187, laborCost: 116, isWeekend: false },
  { day: 21, dow: '火', sales: 365, customers: 121, avgSpend: 3017, orders: 182, laborCost: 113, isWeekend: false },
  { day: 22, dow: '水', sales: 420, customers: 140, avgSpend: 3000, orders: 210, laborCost: 130, isWeekend: false },
  { day: 23, dow: '木', sales: 410, customers: 137, avgSpend: 2993, orders: 205, laborCost: 127, isWeekend: false },
  { day: 24, dow: '金', sales: 480, customers: 160, avgSpend: 3000, orders: 240, laborCost: 149, isWeekend: false },
  { day: 25, dow: '土', sales: 645, customers: 214, avgSpend: 3014, orders: 322, laborCost: 206, isWeekend: true  },
  { day: 26, dow: '日', sales: 615, customers: 204, avgSpend: 3015, orders: 307, laborCost: 197, isWeekend: true  },
  { day: 27, dow: '月', sales: 370, customers: 123, avgSpend: 3008, orders: 185, laborCost: 115, isWeekend: false },
  { day: 28, dow: '火', sales: 365, customers: 121, avgSpend: 3017, orders: 182, laborCost: 113, isWeekend: false },
  { day: 29, dow: '水', sales: 420, customers: 140, avgSpend: 3000, orders: 210, laborCost: 130, isWeekend: false },
  { day: 30, dow: '木', sales: 410, customers: 137, avgSpend: 2993, orders: 205, laborCost: 127, isWeekend: false },
]

// For the shift decision screen – staff availability per time slot
export const timeSlots = ['9:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00']

export const assignedShifts = {
  // day -> { slot -> [staffId, ...] }
  1: {
    '9:00':  [1, 2, 3],
    '10:00': [1, 2, 3, 6],
    '11:00': [1, 2, 3, 6, 8],
    '12:00': [1, 2, 3, 6, 8, 9],
    '13:00': [1, 2, 6, 8, 7, 14],
    '14:00': [2, 6, 8, 7, 14, 17],
    '15:00': [2, 6, 7, 14, 17, 19],
    '16:00': [2, 7, 14, 17, 19],
    '17:00': [2, 14, 17, 19, 20],
    '18:00': [2, 14, 17, 19],
    '19:00': [2, 17, 19],
    '20:00': [2, 19],
    '21:00': [2],
  },
}

export const availableForSlot = (day, slot) => {
  // Returns staff who are working that day and cover that time
  return staff.filter(s => {
    const sd = shiftData[s.id]
    if (!sd) return false
    const code = sd[day - 1]
    if (!code || code === 'X') return false
    return true
  })
}

export const skillLabels = {
  barista: 'バリスタ',
  cashier: 'レジ',
  floor:   'フロア',
  opening: '開店作業',
  closing: '閉店作業',
}

// ─── New additions ──────────────────────────────────────────────────────────

export const DEFAULT_STORE_ADDRESS = '〒160-0022 東京都新宿区新宿3-31-7'

export const storeConfig = {
  openHour: 9,
  closeHour: 23,
  slotInterval: 15, // minutes
  avgProductivity: 8, // orders processed per staff per hour
  address: DEFAULT_STORE_ADDRESS,
  specialTasks: [
    { id: 1, name: '搬入',  startTime: '9:00',  endTime: '9:45',  requiredStaff: 2, colorKey: 'orange', enabled: true },
    { id: 2, name: '掃除',  startTime: '22:00', endTime: '22:45', requiredStaff: 2, colorKey: 'purple', enabled: true },
  ],
  // Break rules: first rule where workHours >= minWorkHours applies (sorted desc)
  breakRules: [
    { minWorkHours: 8, breakMinutes: 60 },
    { minWorkHours: 6, breakMinutes: 45 },
  ],
}

export const staffConstraints = {
  1:  { incompatible: [], targetEarnings: 0, retentionPriority: 1 },
  2:  { incompatible: [], targetEarnings: 0, retentionPriority: 2 },
  3:  { incompatible: [{ staffId: 7, severity: 3 }], targetEarnings: 120000, retentionPriority: 3 },
  4:  { incompatible: [], targetEarnings: 80000, retentionPriority: 5 },
  5:  { incompatible: [{ staffId: 9, severity: 1 }], targetEarnings: 60000, retentionPriority: 8 },
  6:  { incompatible: [], targetEarnings: 100000, retentionPriority: 3 },
  7:  { incompatible: [{ staffId: 3, severity: 3 }, { staffId: 12, severity: 2 }], targetEarnings: 70000, retentionPriority: 7 },
  8:  { incompatible: [], targetEarnings: 80000, retentionPriority: 6 },
  9:  { incompatible: [{ staffId: 5, severity: 1 }], targetEarnings: 50000, retentionPriority: 9 },
  10: { incompatible: [], targetEarnings: 90000, retentionPriority: 4 },
  11: { incompatible: [], targetEarnings: 60000, retentionPriority: 10 },
  12: { incompatible: [{ staffId: 7, severity: 2 }], targetEarnings: 75000, retentionPriority: 7 },
  13: { incompatible: [], targetEarnings: 100000, retentionPriority: 4 },
  14: { incompatible: [], targetEarnings: 80000, retentionPriority: 6 },
  15: { incompatible: [], targetEarnings: 70000, retentionPriority: 8 },
  16: { incompatible: [], targetEarnings: 65000, retentionPriority: 9 },
  17: { incompatible: [], targetEarnings: 70000, retentionPriority: 7 },
  18: { incompatible: [], targetEarnings: 60000, retentionPriority: 10 },
  19: { incompatible: [], targetEarnings: 90000, retentionPriority: 5 },
  20: { incompatible: [], targetEarnings: 75000, retentionPriority: 8 },
  21: { incompatible: [], targetEarnings: 0, retentionPriority: 2 },
}

// Fraction of daily orders occurring each hour (9-22, values sum to 1.0)
export const ORDER_DISTRIBUTION = {
  9:  0.05,
  10: 0.07,
  11: 0.09,
  12: 0.13,
  13: 0.12,
  14: 0.08,
  15: 0.07,
  16: 0.07,
  17: 0.08,
  18: 0.09,
  19: 0.08,
  20: 0.05,
  21: 0.02,
  22: 0.00,
}

export const allStores = [
  { id: 1, name: '新宿三丁目店', status: 'active' },
  { id: 2, name: '渋谷店',       status: 'soon' },
  { id: 3, name: '原宿店',       status: 'soon' },
]

/**
 * Generate time slot labels for a given interval (minutes) and hour range.
 * Returns array like ['9:00', '9:30', '10:00', ...]
 */
export function generateSlots(interval = 60, startHour = 9, endHour = 23) {
  const slots = []
  const totalMinutes = (endHour - startHour) * 60
  const steps = totalMinutes / interval
  for (let i = 0; i < steps; i++) {
    const totalMins = startHour * 60 + i * interval
    const h = Math.floor(totalMins / 60)
    const m = totalMins % 60
    slots.push(`${h}:${m === 0 ? '00' : m < 10 ? '0' + m : m}`)
  }
  return slots
}

/**
 * Parse a shift code like '9-18', '13-L', 'O-16', 'F' into {start, end} hours.
 * Returns null for 'X' or unknown codes.
 */
export function parseShiftTimes(code) {
  if (!code || code === 'X') return null
  if (code === 'F') return { start: 9, end: 23 }
  // Open shifts like O-16, O-18, O-14 → start at 9, end at the number
  const openMatch = code.match(/^O-(\d+(?:\.\d+)?)$/)
  if (openMatch) return { start: 9, end: parseFloat(openMatch[1]) }
  // Time range like '9-18', '13-L', '17.5-L', '11-16'
  const rangeMatch = code.match(/^(\d+(?:\.\d+)?)[.-](\d+(?:\.\d+)?|L)$/)
  if (rangeMatch) {
    return {
      start: parseFloat(rangeMatch[1]),
      end: rangeMatch[2] === 'L' ? 23 : parseFloat(rangeMatch[2]),
    }
  }
  return { start: 9, end: 18 }
}

/**
 * Calculate required staff count for a given hour slot.
 * @param {number} dailyOrders - total orders for the day
 * @param {number} hour - hour of day (e.g. 12 for 12:00)
 * @param {number} avgProductivity - orders per staff per hour
 * @param {number} extraStaff - additional staff from special tasks
 */
export function calcRequiredStaff(dailyOrders, hour, avgProductivity = 8, extraStaff = 0) {
  const fraction = ORDER_DISTRIBUTION[hour] ?? 0
  const ordersThisHour = dailyOrders * fraction
  const base = Math.ceil(ordersThisHour / avgProductivity)
  return Math.max(1, base) + extraStaff
}

export const shiftSubmissions = [
  {
    id: 1,
    period: '2026年4月 前半',
    submittedAt: '2026-03-25 14:32',
    lastEditedAt: '2026-03-25 14:32',
    status: 'confirmed',
    shiftRow: [...shiftData[1]],
  },
  {
    id: 2,
    period: '2026年4月 後半',
    submittedAt: '2026-04-05 09:15',
    lastEditedAt: '2026-04-05 09:15',
    status: 'submitted',
    shiftRow: [...shiftData[2]],
  },
  {
    id: 3,
    period: '2026年5月 前半',
    submittedAt: null,
    lastEditedAt: '2026-04-18 22:01',
    status: 'draft',
    shiftRow: Array.from({ length: 15 }, () => 'X'),
  },
]

// ─── シフトバージョン一覧（/manager/shift トップ）─────────────────────────────
export const shiftVersions = [
  {
    id: 'v1',
    name: 'ver1',
    status: 'confirmed', // 'draft' | 'confirmed'
    createdAt: '2026-04-01 10:30',
    updatedAt: '2026-04-03 18:22',
    author: '金子 光男',
  },
  {
    id: 'v2',
    name: 'ver2 (試案A)',
    status: 'draft',
    createdAt: '2026-04-04 09:15',
    updatedAt: '2026-04-05 14:08',
    author: '金子 光男',
  },
  {
    id: 'v3',
    name: 'ver3 (週末強化案)',
    status: 'draft',
    createdAt: '2026-04-05 11:42',
    updatedAt: '2026-04-05 11:42',
    author: '澤井 詩議',
  },
]

export const managerNotifications = [
  { id: 1, type: 'submit',  text: '金子 光男 さんからシフト提出がありました',              sub: '2026年5月 前半',    time: '5分前',        read: false },
  { id: 2, type: 'alert',   text: 'シフト確定前日です。シフト確定がまだ完了していません。', sub: '4月前半シフト',     time: '1時間前',      read: false },
  { id: 3, type: 'warning', text: '必要工数が不足している日があります（4/8, 4/12）',        sub: '4月前半シフト',     time: '本日 9:00',    read: false },
  { id: 4, type: 'submit',  text: '山田 太郎 さんからシフト提出がありました',              sub: '2026年5月 前半',    time: '昨日 18:32',   read: true  },
  { id: 5, type: 'info',    text: '2026年5月 前半のシフト提出期限が3日後です',             sub: '期限: 4月23日',     time: '昨日 10:00',   read: true  },
]

export const employeeNotifications = [
  { id: 1, type: 'reminder',   text: 'シフト確定前日です。シフト提出がまだです。',  sub: '2026年5月 前半',              time: '2時間前',     read: false },
  { id: 2, type: 'confirmed',  text: '2026年4月 前半のシフトが確定しました',      sub: 'マネージャーが確定しました',   time: '昨日 14:30',  read: false },
  { id: 3, type: 'info',       text: '2026年5月 前半のシフト提出期限は4月23日です', sub: 'あと3日',                    time: '3日前',       read: true  },
]

export const sukimaJobs = [
  { id:1, date:'2026-04-21', store:'渋谷店',      role:'バリスタ',         startTime:'12:00', endTime:'15:00', wage:1300, filled:0, total:2, deadlineHours:2.5,  transport:true,  location:'渋谷区道玄坂2-10-7',   bgColor:'#f5ede3', emoji:'☕', description:'人気カフェのバリスタとして活躍。エスプレッソマシン経験者優遇。制服貸与あり。未経験でも丁寧に研修します。' },
  { id:2, date:'2026-04-21', store:'新宿三丁目店', role:'ホールスタッフ',   startTime:'17:00', endTime:'22:00', wage:1150, filled:1, total:3, deadlineHours:4.2,  transport:true,  location:'新宿区新宿3-35-15',    bgColor:'#e3edf5', emoji:'🍸', description:'夜のホールスタッフ募集。接客経験がある方歓迎。活気あるお店です。ドリンク提供あり。' },
  { id:3, date:'2026-04-21', store:'表参道店',     role:'キッチンスタッフ', startTime:'10:00', endTime:'14:00', wage:1200, filled:0, total:1, deadlineHours:0.75, transport:false, location:'港区北青山3-6-1',       bgColor:'#e3f5e9', emoji:'🥗', description:'ランチタイムのキッチン補助。料理経験不問、簡単な調理補助から始められます。' },
  { id:4, date:'2026-04-22', store:'銀座店',       role:'フロアスタッフ',   startTime:'11:00', endTime:'16:00', wage:1250, filled:0, total:2, deadlineHours:22,   transport:true,  location:'中央区銀座4-2-12',      bgColor:'#f5e3f5', emoji:'🍽', description:'銀座の高級感あふれるカフェでフロアスタッフとして活躍。服装規定あり（貸与あり）。' },
  { id:5, date:'2026-04-22', store:'恵比寿店',     role:'バリスタ',         startTime:'08:00', endTime:'12:00', wage:1100, filled:1, total:2, deadlineHours:18,   transport:true,  location:'渋谷区恵比寿4-20-7',   bgColor:'#f5f0e3', emoji:'☕', description:'朝の時間帯にバリスタとして活躍。コーヒーが好きな方大歓迎！研修制度充実。' },
  { id:6, date:'2026-04-23', store:'池袋店',       role:'ホールスタッフ',   startTime:'14:00', endTime:'19:00', wage:1180, filled:0, total:3, deadlineHours:40,   transport:true,  location:'豊島区東池袋1-21-1',   bgColor:'#e3eef5', emoji:'🍹', description:'土曜の賑やかな池袋店でホールを担当。体力に自信がある方向け。経験不問。' },
  { id:7, date:'2026-04-24', store:'青山店',       role:'バリスタ',         startTime:'09:00', endTime:'13:00', wage:1350, filled:0, total:1, deadlineHours:64,   transport:true,  location:'港区南青山5-1-1',       bgColor:'#f0e3f5', emoji:'☕', description:'閑静な青山エリアのカフェ。落ち着いた環境でバリスタスキルを活かせます。' },
]

// ─── 給与・税率定数（Excel: ﾃﾞｰﾀ入力!Monthly Data 由来）──────────────────────
export const PAYROLL = {
  socialInsuranceThresholdHours: 120, // 月間総時間 ≥ 120h で社会保険加入(ENTRY)
  rateSocialInsurance: 0.03,           // 社会保険料 = 給与 × 3%
  rateEmploymentInsurance: 0.006,      // 雇用保険料 = 給与 × 0.6%
  ratePension: 0.1735,                 // 厚生年金料 = 給与 × 17.35%
  rateIncomeTax: 0.10,                 // 所得税 = (給与 - 控除合計) × 10%
  overtimeMultiplier: 0.25,            // 超勤割増 25%
  lateNightMultiplier: 0.25,           // 深夜割増 25%
  lateNightOTMultiplier: 0.5,          // 残深(超勤×深夜) 追加 50%
  overtimeThresholdHours: 8,           // 8時間超で超勤
  lateNightStartHour: 22,              // 22時以降が深夜
  breakHoursIfWorkOver6: 1,            // 6h超勤務で1h休憩
}

// ─── 5+1パターンの時間帯別売上構成比（Excel: ﾃﾞｰﾀ入力!K-R）─────────────────
// 各キーの値: { [hour]: 売上額(円) } 9-22時
export const SALES_PATTERNS = {
  weekday1: {
    label: '平日①',
    hourlySales: { 9:7000, 10:13000, 11:13000, 12:18000, 13:28000, 14:31000, 15:30000, 16:32000, 17:30000, 18:21000, 19:15000, 20:16000, 21:12000, 22:4000 },
  },
  weekday2: {
    label: '平日②',
    hourlySales: { 9:6000, 10:11000, 11:12000, 12:17000, 13:25000, 14:28000, 15:27000, 16:30000, 17:28000, 18:19000, 19:14000, 20:15000, 21:11000, 22:3500 },
  },
  friday: {
    label: '金曜',
    hourlySales: { 9:6000, 10:10000, 11:14000, 12:20000, 13:34000, 14:24000, 15:31000, 16:38000, 17:26000, 18:27000, 19:17000, 20:20000, 21:19000, 22:14000 },
  },
  saturday: {
    label: '土曜',
    hourlySales: { 9:20000, 10:20000, 11:20000, 12:32000, 13:45000, 14:47000, 15:50000, 16:50000, 17:36000, 18:26000, 19:21000, 20:24000, 21:9000, 22:0 },
  },
  sunday: {
    label: '日祝',
    hourlySales: { 9:16000, 10:21000, 11:25000, 12:36000, 13:43000, 14:54000, 15:52000, 16:52000, 17:32000, 18:26000, 19:21000, 20:15000, 21:7000, 22:0 },
  },
}

// 日 → パターン割当（前半15日分。曜日に応じて自動）
const PATTERN_BY_DOW = { '月':'weekday1','火':'weekday1','水':'weekday2','木':'weekday2','金':'friday','土':'saturday','日':'sunday' }
export const dayPatterns = Object.fromEntries(
  Array.from({ length: 31 }, (_, i) => i + 1).map(day => {
    const dow = DOW[(day - 1) % DOW.length] || '月'
    return [day, PATTERN_BY_DOW[dow] || 'weekday1']
  })
)

// 給与計算：1日分（労働/超勤/深夜/残深を引数に給与を算出）
export function calcDailyPay(wage, labor, overtime, lateNight, otLateNight) {
  return wage * labor
       + wage * PAYROLL.overtimeMultiplier * overtime
       + wage * PAYROLL.lateNightMultiplier * lateNight
       + wage * PAYROLL.lateNightOTMultiplier * otLateNight
}

// 勤務時間→各種時間（Excel式の簡易再現）
// startHour, endHour は decimal (例: 9.5 = 9:30)
// breakRules: storeConfig.breakRules を渡すと店舗設定が反映される
export function decomposeShiftHours(startHour, endHour, breakRules) {
  if (endHour <= startHour) return { work: 0, labor: 0, overtime: 0, lateNight: 0, otLateNight: 0, breakHours: 0, breakStart: null, breakEnd: null }
  const rules = breakRules || storeConfig.breakRules
  const work = endHour - startHour
  const rule = rules.find(r => work >= r.minWorkHours) // rules must be sorted desc by minWorkHours
  const breakHours = rule ? rule.breakMinutes / 60 : 0
  // Break is assumed to start at the 6-hour mark (or halfway for shorter shifts with break)
  const breakStart = breakHours > 0 ? startHour + Math.min(6, work - breakHours) : null
  const breakEnd   = breakStart !== null ? breakStart + breakHours : null
  const labor = Math.max(0, work - breakHours)
  const overtime = Math.max(0, labor - PAYROLL.overtimeThresholdHours)
  const lateNight = Math.max(0, Math.min(endHour, 24) - Math.max(startHour, PAYROLL.lateNightStartHour))
  const otLateNight = Math.min(overtime, lateNight)
  return { work, labor, overtime, lateNight, otLateNight, breakHours, breakStart, breakEnd }
}

// 月次振込予定額の計算（Monthly Data 計算式）
export function calcMonthlyPayroll(staffMember, monthlyTotals) {
  // monthlyTotals = { totalHours, totalDays, totalPay, totalTransit }
  const enroll = monthlyTotals.totalHours >= PAYROLL.socialInsuranceThresholdHours
  const socialIns      = enroll ? monthlyTotals.totalPay * PAYROLL.rateSocialInsurance      : 0
  const empIns         = enroll ? monthlyTotals.totalPay * PAYROLL.rateEmploymentInsurance  : 0
  const pension        = enroll ? monthlyTotals.totalPay * PAYROLL.ratePension              : 0
  const taxableBase    = monthlyTotals.totalPay - (socialIns + empIns + pension)
  const incomeTax      = Math.max(0, taxableBase * PAYROLL.rateIncomeTax)
  const totalDeduction = socialIns + empIns + pension + incomeTax
  const finalPay       = (monthlyTotals.totalPay + monthlyTotals.totalTransit) - totalDeduction
  return { enroll, socialIns, empIns, pension, incomeTax, totalDeduction, finalPay }
}
