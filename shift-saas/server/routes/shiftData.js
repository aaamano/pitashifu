import { Router } from 'express'
import { getDb } from '../db.js'

const router = Router()

// GET /api/shift-data/:versionId
// Returns { staffId: [code_day1, code_day2, ... code_day30], ... }
router.get('/shift-data/:versionId', (req, res) => {
  try {
    const db = getDb()
    const { versionId } = req.params

    const rows = db.prepare(
      'SELECT staff_id, day, code FROM shift_data WHERE version_id = ? ORDER BY staff_id, day'
    ).all(versionId)

    // Build map: staffId -> array of 30 codes (index = day-1)
    const result = {}
    for (const row of rows) {
      if (!result[row.staff_id]) result[row.staff_id] = []
      result[row.staff_id][row.day - 1] = row.code
    }

    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/shift-data/:versionId
// Body: { staffId: [codes], ... }  - upserts all rows
router.put('/shift-data/:versionId', (req, res) => {
  try {
    const db = getDb()
    const { versionId } = req.params
    const shiftMap = req.body // { staffId: [code_day1...] }

    const upsert = db.prepare(`
      INSERT OR REPLACE INTO shift_data (version_id, staff_id, day, code)
      VALUES (?, ?, ?, ?)
    `)

    const tx = db.transaction(() => {
      for (const [staffIdStr, codes] of Object.entries(shiftMap)) {
        const staffId = parseInt(staffIdStr)
        if (!Array.isArray(codes)) continue
        codes.forEach((code, idx) => {
          upsert.run(versionId, staffId, idx + 1, code ?? 'X')
        })
      }
    })
    tx()

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/slot-assignments/:versionId/:day
// Returns { slot: [staffId, ...], ... }
router.get('/slot-assignments/:versionId/:day', (req, res) => {
  try {
    const db = getDb()
    const { versionId, day } = req.params

    const rows = db.prepare(
      'SELECT slot, staff_ids FROM slot_assignments WHERE version_id = ? AND day = ?'
    ).all(versionId, parseInt(day))

    const result = {}
    for (const row of rows) {
      result[row.slot] = JSON.parse(row.staff_ids || '[]')
    }

    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/slot-assignments/:versionId/:day
// Body: { slot: [staffId, ...], ... }
router.put('/slot-assignments/:versionId/:day', (req, res) => {
  try {
    const db = getDb()
    const { versionId, day } = req.params
    const slotMap = req.body // { slot: [staffIds] }

    const upsert = db.prepare(`
      INSERT OR REPLACE INTO slot_assignments (version_id, day, slot, staff_ids)
      VALUES (?, ?, ?, ?)
    `)

    const tx = db.transaction(() => {
      for (const [slot, staffIds] of Object.entries(slotMap)) {
        upsert.run(versionId, parseInt(day), slot, JSON.stringify(staffIds))
      }
    })
    tx()

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
