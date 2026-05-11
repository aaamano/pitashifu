import { Router } from 'express'
import { getDb } from '../db.js'

const router = Router()

function rowToTarget(row) {
  return {
    day: row.day,
    dow: row.dow,
    sales: row.sales,
    customers: row.customers,
    avgSpend: row.avg_spend,
    orders: row.orders,
    laborCost: row.labor_cost,
    isWeekend: row.is_weekend === 1,
    laborRatio: row.labor_ratio,
    productivity: row.productivity,
  }
}

// GET /api/targets
router.get('/', (req, res) => {
  try {
    const rows = getDb().prepare('SELECT * FROM daily_targets ORDER BY day').all()
    res.json(rows.map(rowToTarget))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/targets/:day  (single day update)
router.put('/:day', (req, res) => {
  try {
    const db = getDb()
    const day = parseInt(req.params.day)
    const existing = db.prepare('SELECT * FROM daily_targets WHERE day = ?').get(day)
    if (!existing) return res.status(404).json({ error: 'Day not found' })

    const { sales, customers, avgSpend, orders, laborCost, isWeekend, laborRatio, productivity, dow } = req.body

    db.prepare(`
      UPDATE daily_targets SET
        dow = COALESCE(?, dow),
        sales = COALESCE(?, sales),
        customers = COALESCE(?, customers),
        avg_spend = COALESCE(?, avg_spend),
        orders = COALESCE(?, orders),
        labor_cost = COALESCE(?, labor_cost),
        is_weekend = COALESCE(?, is_weekend),
        labor_ratio = COALESCE(?, labor_ratio),
        productivity = COALESCE(?, productivity)
      WHERE day = ?
    `).run(
      dow ?? null,
      sales ?? null,
      customers ?? null,
      avgSpend ?? null,
      orders ?? null,
      laborCost ?? null,
      isWeekend !== undefined ? (isWeekend ? 1 : 0) : null,
      laborRatio ?? null,
      productivity ?? null,
      day,
    )

    const row = db.prepare('SELECT * FROM daily_targets WHERE day = ?').get(day)
    res.json(rowToTarget(row))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/targets  (batch update - body is array)
router.put('/', (req, res) => {
  try {
    const db = getDb()
    const items = req.body
    if (!Array.isArray(items)) return res.status(400).json({ error: 'Body must be an array' })

    const upsert = db.prepare(`
      INSERT OR REPLACE INTO daily_targets (day, dow, sales, customers, avg_spend, orders, labor_cost, is_weekend, labor_ratio, productivity)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const tx = db.transaction(() => {
      for (const t of items) {
        upsert.run(
          t.day,
          t.dow ?? '',
          t.sales ?? 0,
          t.customers ?? 0,
          t.avgSpend ?? 0,
          t.orders ?? 0,
          t.laborCost ?? 0,
          t.isWeekend ? 1 : 0,
          t.laborRatio ?? 0,
          t.productivity ?? 0,
        )
      }
    })
    tx()

    const rows = db.prepare('SELECT * FROM daily_targets ORDER BY day').all()
    res.json(rows.map(rowToTarget))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
