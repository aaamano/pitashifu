import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const Database = require('better-sqlite3')

import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.join(__dirname, 'pitashifu.db')

let _db = null

export function getDb() {
  if (_db) return _db
  _db = new Database(DB_PATH)
  _db.pragma('journal_mode = WAL')
  _db.pragma('foreign_keys = ON')
  initSchema(_db)
  seedIfEmpty(_db)
  return _db
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS staff (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT DEFAULT 'P',
      role TEXT DEFAULT 'スタッフ',
      skills TEXT DEFAULT '[]',
      hourly_orders INTEGER DEFAULT 8,
      wage INTEGER DEFAULT 1050,
      transit_per_day INTEGER DEFAULT 0,
      contact_email TEXT DEFAULT '',
      contact_phone TEXT DEFAULT '',
      address TEXT DEFAULT '',
      emergency_contact TEXT DEFAULT '',
      bank_info TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      employment_start TEXT DEFAULT '',
      employment_type TEXT DEFAULT 'part_time',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS shift_versions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT DEFAULT 'draft',
      author TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS shift_data (
      version_id TEXT NOT NULL,
      staff_id INTEGER NOT NULL,
      day INTEGER NOT NULL,
      code TEXT DEFAULT 'X',
      PRIMARY KEY (version_id, staff_id, day)
    );

    CREATE TABLE IF NOT EXISTS slot_assignments (
      version_id TEXT NOT NULL,
      day INTEGER NOT NULL,
      slot TEXT NOT NULL,
      staff_ids TEXT DEFAULT '[]',
      PRIMARY KEY (version_id, day, slot)
    );

    CREATE TABLE IF NOT EXISTS shift_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_id INTEGER NOT NULL,
      period TEXT NOT NULL,
      shift_row TEXT DEFAULT '[]',
      status TEXT DEFAULT 'draft',
      submitted_at TEXT,
      last_edited_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS daily_targets (
      day INTEGER PRIMARY KEY,
      dow TEXT,
      sales INTEGER DEFAULT 0,
      customers INTEGER DEFAULT 0,
      avg_spend INTEGER DEFAULT 0,
      orders INTEGER DEFAULT 0,
      labor_cost INTEGER DEFAULT 0,
      is_weekend INTEGER DEFAULT 0,
      labor_ratio REAL DEFAULT 0,
      productivity INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role TEXT DEFAULT 'manager',
      type TEXT DEFAULT 'info',
      title TEXT,
      body TEXT,
      read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `)
}

// ──────────────────────────────────────────────────────────
// Seed data (sourced from src/data/mockData.js)
// ──────────────────────────────────────────────────────────

const SEED_STAFF = [
  { id: 1,  name: '金子 光男',         type: 'F', role: 'マネージャー',     skills: ['barista','cashier','floor','opening','closing'], hourlyOrders: 12, wage: 1250, transitPerDay: 0    },
  { id: 2,  name: '澤井 詩議',         type: 'F', role: 'サブマネージャー', skills: ['barista','cashier','opening','closing'],          hourlyOrders: 11, wage: 1200, transitPerDay: 1050 },
  { id: 3,  name: '吉田 郁美',         type: 'P', role: 'スタッフ',         skills: ['barista','cashier','floor','opening'],            hourlyOrders: 9,  wage: 1050, transitPerDay: 272  },
  { id: 4,  name: '岩間 康尚',         type: 'P', role: 'スタッフ',         skills: ['cashier','floor'],                               hourlyOrders: 8,  wage: 1050, transitPerDay: 962  },
  { id: 5,  name: '杉崎 浩枝',         type: 'P', role: 'スタッフ',         skills: ['cashier'],                                       hourlyOrders: 7,  wage: 1050, transitPerDay: 682  },
  { id: 6,  name: 'スクアルチナ マルコ', type: 'P', role: 'バリスタ',         skills: ['barista','cashier','floor','opening'],            hourlyOrders: 13, wage: 1100, transitPerDay: 1050 },
  { id: 7,  name: '二関 大地',         type: 'P', role: 'スタッフ',         skills: ['floor','closing'],                               hourlyOrders: 7,  wage: 1050, transitPerDay: 420  },
  { id: 8,  name: '松井 華乃',         type: 'P', role: 'スタッフ',         skills: ['cashier','floor'],                               hourlyOrders: 8,  wage: 1050, transitPerDay: 1430 },
  { id: 9,  name: '堀内 省吾',         type: 'P', role: 'スタッフ',         skills: ['floor','closing'],                               hourlyOrders: 6,  wage: 1030, transitPerDay: 648  },
  { id: 10, name: '崔 恩雄',           type: 'P', role: 'スタッフ',         skills: ['barista','floor','opening'],                      hourlyOrders: 9,  wage: 1050, transitPerDay: 712  },
  { id: 11, name: 'クイ',              type: 'P', role: 'スタッフ',         skills: ['floor'],                                         hourlyOrders: 6,  wage: 1030, transitPerDay: 1028 },
  { id: 12, name: '吉冨 寛大',         type: 'P', role: 'スタッフ',         skills: ['cashier','floor','closing'],                      hourlyOrders: 7,  wage: 1050, transitPerDay: 0    },
  { id: 13, name: '譚木 りさ',         type: 'P', role: 'スタッフ',         skills: ['barista','cashier'],                             hourlyOrders: 8,  wage: 1050, transitPerDay: 900  },
  { id: 14, name: '飯田 奈洋美',       type: 'P', role: 'スタッフ',         skills: ['cashier','floor','closing'],                      hourlyOrders: 8,  wage: 1050, transitPerDay: 2442 },
  { id: 15, name: '若林 百央',         type: 'P', role: 'スタッフ',         skills: ['barista'],                                       hourlyOrders: 7,  wage: 1050, transitPerDay: 376  },
  { id: 16, name: '吉野 友吾',         type: 'P', role: 'スタッフ',         skills: ['floor'],                                         hourlyOrders: 6,  wage: 1030, transitPerDay: 356  },
  { id: 17, name: 'サラ',              type: 'P', role: 'スタッフ',         skills: ['cashier','floor'],                               hourlyOrders: 7,  wage: 1050, transitPerDay: 418  },
  { id: 18, name: 'アイリーン',        type: 'P', role: 'スタッフ',         skills: ['floor','closing'],                               hourlyOrders: 6,  wage: 1030, transitPerDay: 682  },
  { id: 19, name: 'エミリー',          type: 'P', role: 'バリスタ',         skills: ['barista','cashier'],                             hourlyOrders: 10, wage: 1080, transitPerDay: 816  },
  { id: 20, name: '薬方 咲',           type: 'P', role: 'スタッフ',         skills: ['cashier','floor'],                               hourlyOrders: 7,  wage: 1050, transitPerDay: 320  },
  { id: 21, name: '佐藤 慧',           type: 'F', role: 'スタッフ',         skills: ['barista','cashier','floor','opening','closing'], hourlyOrders: 9,  wage: 1080, transitPerDay: 682  },
]

// Shift pattern codes
const SP = {
  F: 'F', X: 'X', O16: 'O-16', O14: 'O-14', O18: 'O-18',
  '918': '9-18', '1018': '10-18', '1020': '10-20', '1116': '11-16',
  '1318': '13-18', '13L': '13-L', '11L': '11-L', '14L': '14-L',
  '175L': '17.5-L', '1820': '18-L', '1519': '15-19', '913': '9-13',
}

const FIRST_HALF = {
  1:  [SP.F,   SP.F,   SP.F,   SP.F,   SP.X,   SP.F,   SP.F,   SP.F,   SP.F,   SP.F,   SP.F,   SP.F,   SP.F,   SP.F,   SP.F],
  2:  [SP.F,   SP.X,   SP.F,   SP.F,   SP.F,   SP.F,   SP.F,   SP.F,   SP.F,   SP.F,   SP.F,   SP.F,   SP.F,   SP.F,   SP.F],
  3:  [SP.X,   SP['918'],SP.X, SP.X,   SP.X,   SP['918'],SP.X, SP['918'],SP['913'],SP.X, SP.X,   SP.X,   SP['918'],SP['918'],SP['918']],
  4:  [SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X],
  5:  [SP.X,   SP.X,   SP['13L'],SP['13L'],SP.X,SP.X,  SP.X,   SP.X,   SP.X,   SP['13L'],SP['13L'],SP.X,SP.X,  SP.X,   SP.X],
  6:  [SP.O16, SP.O16, SP.X,   SP.O18, SP.O18, SP.X,   SP.O16, SP.O16, SP.O16, SP.X,   SP.O18, SP.O18, SP.X,   SP.O16, SP.X],
  7:  [SP.X,   SP.X,   SP.X,   SP['13L'],SP['14L'],SP['14L'],SP.X,SP.X,SP.X,  SP.X,   SP['13L'],SP['14L'],SP['14L'],SP.X,SP.X],
  8:  [SP.O16, SP.O16, SP.O14, SP.O14, SP.X,   SP.X,   SP.O16, SP.O16, SP.O16, SP.X,   SP.X,   SP.X,   SP.O16, SP.X,   SP.O16],
  9:  [SP.X,   SP['13L'],SP['13L'],SP['11L'],SP['14L'],SP.X,SP.X,SP['13L'],SP['13L'],SP['13L'],SP['11L'],SP['11L'],SP.X,SP.X,SP['13L']],
  10: [SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X],
  11: [SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X],
  12: [SP.X,   SP.X,   SP.X,   SP.O14, SP.X,   SP.X,   SP.X,   SP.O16, SP.O14, SP.X,   SP['1116'],SP.X,SP.X,  SP.X,   SP.X],
  13: [SP['1020'],SP.X,SP['1020'],SP.X,SP.X,  SP.X,   SP.X,   SP['1020'],SP.X,SP['1020'],SP.X,SP.X,  SP.X,   SP['1116'],SP['1020']],
  14: [SP.X,   SP.X,   SP.X,   SP['913'],SP['918'],SP.X,SP['918'],SP.X,SP['913'],SP['918'],SP['1116'],SP['913'],SP.X,SP['918'],SP.X],
  15: [SP['1116'],SP.X,SP.X,  SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP['1116'],SP['1116'],SP.X,SP.X, SP.X],
  16: [SP.X,   SP['175L'],SP.X,SP['175L'],SP.X,SP['175L'],SP.X,SP['175L'],SP.X,SP.X,  SP.X,   SP.X,   SP.X,   SP.X,   SP.X],
  17: [SP.X,   SP['11L'],SP['11L'],SP.X,SP.X, SP.X,   SP.X,   SP['14L'],SP['14L'],SP['14L'],SP.X,SP.X, SP.X,   SP['14L'],SP['14L']],
  18: [SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X,   SP.X],
  19: [SP.X,   SP['1820'],SP.X,SP['1820'],SP['1820'],SP['13L'],SP.X,SP['1820'],SP['1519'],SP.X,SP['1820'],SP.X,SP['13L'],SP['1519'],SP.X],
  20: [SP.X,   SP.X,   SP.X,   SP.X,   SP['14L'],SP.X,SP.X,  SP.X,   SP.X,   SP['14L'],SP['14L'],SP.X,SP['14L'],SP.X, SP.X],
  21: [SP.F,   SP.F,   SP.F,   SP.F,   SP.F,   SP.F,   SP.F,   SP.F,   SP.F,   SP.F,   SP.F,   SP.X,   SP.F,   SP.F,   SP.F],
}

// Mirror first half to second half (as in mockData)
function buildFullShift(firstHalf) {
  return [...firstHalf, ...firstHalf]
}

const SEED_VERSIONS = [
  { id: 'v1', name: 'ver1',             status: 'confirmed', author: '金子 光男', created_at: '2026-04-01 10:30', updated_at: '2026-04-03 18:22' },
  { id: 'v2', name: 'ver2 (試案A)',      status: 'draft',     author: '金子 光男', created_at: '2026-04-04 09:15', updated_at: '2026-04-05 14:08' },
  { id: 'v3', name: 'ver3 (週末強化案)', status: 'draft',     author: '澤井 詩議', created_at: '2026-04-05 11:42', updated_at: '2026-04-05 11:42' },
]

const SEED_TARGETS = [
  { day: 1,  dow: '水', sales: 420, customers: 140, avg_spend: 3000, orders: 210, labor_cost: 130, is_weekend: 0 },
  { day: 2,  dow: '木', sales: 410, customers: 137, avg_spend: 2993, orders: 205, labor_cost: 127, is_weekend: 0 },
  { day: 3,  dow: '金', sales: 480, customers: 160, avg_spend: 3000, orders: 240, labor_cost: 149, is_weekend: 0 },
  { day: 4,  dow: '土', sales: 620, customers: 206, avg_spend: 3010, orders: 310, labor_cost: 198, is_weekend: 1 },
  { day: 5,  dow: '日', sales: 590, customers: 196, avg_spend: 3010, orders: 295, labor_cost: 189, is_weekend: 1 },
  { day: 6,  dow: '月', sales: 380, customers: 126, avg_spend: 3016, orders: 190, labor_cost: 118, is_weekend: 0 },
  { day: 7,  dow: '火', sales: 370, customers: 123, avg_spend: 3008, orders: 185, labor_cost: 115, is_weekend: 0 },
  { day: 8,  dow: '水', sales: 415, customers: 138, avg_spend: 3007, orders: 207, labor_cost: 129, is_weekend: 0 },
  { day: 9,  dow: '木', sales: 405, customers: 135, avg_spend: 3000, orders: 202, labor_cost: 126, is_weekend: 0 },
  { day: 10, dow: '金', sales: 475, customers: 158, avg_spend: 3006, orders: 237, labor_cost: 147, is_weekend: 0 },
  { day: 11, dow: '土', sales: 650, customers: 216, avg_spend: 3009, orders: 325, labor_cost: 208, is_weekend: 1 },
  { day: 12, dow: '日', sales: 610, customers: 203, avg_spend: 3004, orders: 305, labor_cost: 195, is_weekend: 1 },
  { day: 13, dow: '月', sales: 360, customers: 120, avg_spend: 3000, orders: 180, labor_cost: 112, is_weekend: 0 },
  { day: 14, dow: '火', sales: 355, customers: 118, avg_spend: 3008, orders: 177, labor_cost: 110, is_weekend: 0 },
  { day: 15, dow: '水', sales: 425, customers: 141, avg_spend: 3014, orders: 212, labor_cost: 132, is_weekend: 0 },
  { day: 16, dow: '木', sales: 415, customers: 138, avg_spend: 3007, orders: 207, labor_cost: 129, is_weekend: 0 },
  { day: 17, dow: '金', sales: 485, customers: 162, avg_spend: 2994, orders: 242, labor_cost: 150, is_weekend: 0 },
  { day: 18, dow: '土', sales: 635, customers: 211, avg_spend: 3009, orders: 317, labor_cost: 203, is_weekend: 1 },
  { day: 19, dow: '日', sales: 600, customers: 199, avg_spend: 3015, orders: 300, labor_cost: 192, is_weekend: 1 },
  { day: 20, dow: '月', sales: 375, customers: 124, avg_spend: 3024, orders: 187, labor_cost: 116, is_weekend: 0 },
  { day: 21, dow: '火', sales: 365, customers: 121, avg_spend: 3017, orders: 182, labor_cost: 113, is_weekend: 0 },
  { day: 22, dow: '水', sales: 420, customers: 140, avg_spend: 3000, orders: 210, labor_cost: 130, is_weekend: 0 },
  { day: 23, dow: '木', sales: 410, customers: 137, avg_spend: 2993, orders: 205, labor_cost: 127, is_weekend: 0 },
  { day: 24, dow: '金', sales: 480, customers: 160, avg_spend: 3000, orders: 240, labor_cost: 149, is_weekend: 0 },
  { day: 25, dow: '土', sales: 645, customers: 214, avg_spend: 3014, orders: 322, labor_cost: 206, is_weekend: 1 },
  { day: 26, dow: '日', sales: 615, customers: 204, avg_spend: 3015, orders: 307, labor_cost: 197, is_weekend: 1 },
  { day: 27, dow: '月', sales: 370, customers: 123, avg_spend: 3008, orders: 185, labor_cost: 115, is_weekend: 0 },
  { day: 28, dow: '火', sales: 365, customers: 121, avg_spend: 3017, orders: 182, labor_cost: 113, is_weekend: 0 },
  { day: 29, dow: '水', sales: 420, customers: 140, avg_spend: 3000, orders: 210, labor_cost: 130, is_weekend: 0 },
  { day: 30, dow: '木', sales: 410, customers: 137, avg_spend: 2993, orders: 205, labor_cost: 127, is_weekend: 0 },
]

const SEED_MANAGER_NOTIFICATIONS = [
  { role: 'manager', type: 'submit',  title: 'シフト提出', body: '金子 光男 さんからシフト提出がありました (2026年5月 前半)',              read: 0 },
  { role: 'manager', type: 'alert',   title: 'シフト確定前日', body: 'シフト確定前日です。シフト確定がまだ完了していません。(4月前半シフト)', read: 0 },
  { role: 'manager', type: 'warning', title: '工数不足', body: '必要工数が不足している日があります（4/8, 4/12）(4月前半シフト)',             read: 0 },
  { role: 'manager', type: 'submit',  title: 'シフト提出', body: '山田 太郎 さんからシフト提出がありました (2026年5月 前半)',                read: 1 },
  { role: 'manager', type: 'info',    title: '提出期限', body: '2026年5月 前半のシフト提出期限が3日後です (期限: 4月23日)',                  read: 1 },
]

const SEED_EMPLOYEE_NOTIFICATIONS = [
  { role: 'employee', type: 'reminder',  title: 'シフト提出リマインダー', body: 'シフト確定前日です。シフト提出がまだです。(2026年5月 前半)',  read: 0 },
  { role: 'employee', type: 'confirmed', title: 'シフト確定',            body: '2026年4月 前半のシフトが確定しました',                       read: 0 },
  { role: 'employee', type: 'info',      title: '提出期限',              body: '2026年5月 前半のシフト提出期限は4月23日です (あと3日)',        read: 1 },
]

function seedIfEmpty(db) {
  const count = db.prepare('SELECT COUNT(*) as c FROM staff').get()
  if (count.c > 0) return

  console.log('[db] Seeding database with mock data...')

  // Seed staff
  const insertStaff = db.prepare(`
    INSERT INTO staff (id, name, type, role, skills, hourly_orders, wage, transit_per_day)
    VALUES (@id, @name, @type, @role, @skills, @hourly_orders, @wage, @transit_per_day)
  `)
  const seedStaffTx = db.transaction(() => {
    for (const s of SEED_STAFF) {
      insertStaff.run({
        id: s.id,
        name: s.name,
        type: s.type,
        role: s.role,
        skills: JSON.stringify(s.skills),
        hourly_orders: s.hourlyOrders,
        wage: s.wage,
        transit_per_day: s.transitPerDay,
      })
    }
  })
  seedStaffTx()

  // Seed shift versions
  const insertVersion = db.prepare(`
    INSERT INTO shift_versions (id, name, status, author, created_at, updated_at)
    VALUES (@id, @name, @status, @author, @created_at, @updated_at)
  `)
  const seedVersionsTx = db.transaction(() => {
    for (const v of SEED_VERSIONS) insertVersion.run(v)
  })
  seedVersionsTx()

  // Seed shift_data for all versions (using same data for all versions as baseline)
  const insertShiftData = db.prepare(`
    INSERT OR REPLACE INTO shift_data (version_id, staff_id, day, code)
    VALUES (@version_id, @staff_id, @day, @code)
  `)
  const seedShiftDataTx = db.transaction(() => {
    for (const ver of SEED_VERSIONS) {
      for (const [staffIdStr, firstHalf] of Object.entries(FIRST_HALF)) {
        const staffId = parseInt(staffIdStr)
        const fullShift = buildFullShift(firstHalf)
        fullShift.forEach((code, idx) => {
          insertShiftData.run({
            version_id: ver.id,
            staff_id: staffId,
            day: idx + 1,
            code,
          })
        })
      }
    }
  })
  seedShiftDataTx()

  // Seed slot_assignments for day 1 of v1 (from assignedShifts in mockData)
  const insertSlot = db.prepare(`
    INSERT OR REPLACE INTO slot_assignments (version_id, day, slot, staff_ids)
    VALUES (@version_id, @day, @slot, @staff_ids)
  `)
  const assignedDay1 = {
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
  }
  const seedSlotsTx = db.transaction(() => {
    for (const [slot, ids] of Object.entries(assignedDay1)) {
      insertSlot.run({ version_id: 'v1', day: 1, slot, staff_ids: JSON.stringify(ids) })
    }
  })
  seedSlotsTx()

  // Seed daily targets
  const insertTarget = db.prepare(`
    INSERT OR REPLACE INTO daily_targets (day, dow, sales, customers, avg_spend, orders, labor_cost, is_weekend)
    VALUES (@day, @dow, @sales, @customers, @avg_spend, @orders, @labor_cost, @is_weekend)
  `)
  const seedTargetsTx = db.transaction(() => {
    for (const t of SEED_TARGETS) insertTarget.run(t)
  })
  seedTargetsTx()

  // Seed shift_submissions (for staff_id 1 and 2, from shiftSubmissions in mockData)
  const insertSub = db.prepare(`
    INSERT INTO shift_submissions (id, staff_id, period, shift_row, status, submitted_at, last_edited_at)
    VALUES (@id, @staff_id, @period, @shift_row, @status, @submitted_at, @last_edited_at)
  `)
  const firstHalfStaff1 = buildFullShift(FIRST_HALF[1])
  const firstHalfStaff2 = buildFullShift(FIRST_HALF[2])
  const seedSubsTx = db.transaction(() => {
    insertSub.run({ id: 1, staff_id: 1, period: '2026年4月 前半', shift_row: JSON.stringify(firstHalfStaff1), status: 'confirmed', submitted_at: '2026-03-25 14:32', last_edited_at: '2026-03-25 14:32' })
    insertSub.run({ id: 2, staff_id: 2, period: '2026年4月 後半', shift_row: JSON.stringify(firstHalfStaff2), status: 'submitted', submitted_at: '2026-04-05 09:15', last_edited_at: '2026-04-05 09:15' })
    insertSub.run({ id: 3, staff_id: 1, period: '2026年5月 前半', shift_row: JSON.stringify(Array.from({ length: 15 }, () => 'X')), status: 'draft', submitted_at: null, last_edited_at: '2026-04-18 22:01' })
  })
  seedSubsTx()

  // Seed notifications
  const insertNotif = db.prepare(`
    INSERT INTO notifications (role, type, title, body, read)
    VALUES (@role, @type, @title, @body, @read)
  `)
  const seedNotifsTx = db.transaction(() => {
    for (const n of SEED_MANAGER_NOTIFICATIONS) insertNotif.run(n)
    for (const n of SEED_EMPLOYEE_NOTIFICATIONS) insertNotif.run(n)
  })
  seedNotifsTx()

  console.log('[db] Seed complete.')
}
