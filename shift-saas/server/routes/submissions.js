import { Router } from 'express'
import { getDb } from '../db.js'

const router = Router()

function rowToSubmission(row) {
  return {
    id: row.id,
    staffId: row.staff_id,
    period: row.period,
    shiftRow: JSON.parse(row.shift_row || '[]'),
    status: row.status,
    submittedAt: row.submitted_at,
    lastEditedAt: row.last_edited_at,
    createdAt: row.created_at,
  }
}

// GET /api/submissions?staffId=X
router.get('/', (req, res) => {
  try {
    const db = getDb()
    const { staffId } = req.query

    let rows
    if (staffId) {
      rows = db.prepare(
        'SELECT * FROM shift_submissions WHERE staff_id = ? ORDER BY created_at DESC'
      ).all(parseInt(staffId))
    } else {
      rows = db.prepare(
        'SELECT * FROM shift_submissions ORDER BY created_at DESC'
      ).all()
    }

    res.json(rows.map(rowToSubmission))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/submissions
router.post('/', (req, res) => {
  try {
    const db = getDb()
    const {
      staffId,
      period,
      shiftRow = [],
      status = 'draft',
      submittedAt = null,
      lastEditedAt = null,
    } = req.body

    if (!staffId) return res.status(400).json({ error: 'staffId is required' })
    if (!period) return res.status(400).json({ error: 'period is required' })

    const result = db.prepare(`
      INSERT INTO shift_submissions (staff_id, period, shift_row, status, submitted_at, last_edited_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(staffId, period, JSON.stringify(shiftRow), status, submittedAt, lastEditedAt)

    const row = db.prepare('SELECT * FROM shift_submissions WHERE id = ?').get(result.lastInsertRowid)
    res.status(201).json(rowToSubmission(row))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/submissions/:id
router.put('/:id', (req, res) => {
  try {
    const db = getDb()
    const existing = db.prepare('SELECT * FROM shift_submissions WHERE id = ?').get(req.params.id)
    if (!existing) return res.status(404).json({ error: 'Submission not found' })

    const { shiftRow, status, submittedAt, lastEditedAt, period } = req.body

    db.prepare(`
      UPDATE shift_submissions SET
        period = COALESCE(?, period),
        shift_row = COALESCE(?, shift_row),
        status = COALESCE(?, status),
        submitted_at = COALESCE(?, submitted_at),
        last_edited_at = COALESCE(?, last_edited_at)
      WHERE id = ?
    `).run(
      period ?? null,
      shiftRow !== undefined ? JSON.stringify(shiftRow) : null,
      status ?? null,
      submittedAt ?? null,
      lastEditedAt ?? null,
      req.params.id,
    )

    const row = db.prepare('SELECT * FROM shift_submissions WHERE id = ?').get(req.params.id)
    res.json(rowToSubmission(row))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/submissions/:id
router.delete('/:id', (req, res) => {
  try {
    const db = getDb()
    const existing = db.prepare('SELECT id FROM shift_submissions WHERE id = ?').get(req.params.id)
    if (!existing) return res.status(404).json({ error: 'Submission not found' })
    db.prepare('DELETE FROM shift_submissions WHERE id = ?').run(req.params.id)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
