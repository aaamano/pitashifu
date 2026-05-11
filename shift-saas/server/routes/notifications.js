import { Router } from 'express'
import { getDb } from '../db.js'

const router = Router()

function rowToNotification(row) {
  return {
    id: row.id,
    role: row.role,
    type: row.type,
    title: row.title,
    body: row.body,
    read: row.read === 1,
    createdAt: row.created_at,
  }
}

// GET /api/notifications?role=manager|employee
router.get('/', (req, res) => {
  try {
    const db = getDb()
    const { role } = req.query

    let rows
    if (role) {
      rows = db.prepare(
        'SELECT * FROM notifications WHERE role = ? ORDER BY created_at DESC'
      ).all(role)
    } else {
      rows = db.prepare('SELECT * FROM notifications ORDER BY created_at DESC').all()
    }

    res.json(rows.map(rowToNotification))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/notifications/:id/read
router.put('/:id/read', (req, res) => {
  try {
    const db = getDb()
    const existing = db.prepare('SELECT * FROM notifications WHERE id = ?').get(req.params.id)
    if (!existing) return res.status(404).json({ error: 'Notification not found' })

    db.prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(req.params.id)

    const row = db.prepare('SELECT * FROM notifications WHERE id = ?').get(req.params.id)
    res.json(rowToNotification(row))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/notifications
router.post('/', (req, res) => {
  try {
    const db = getDb()
    const { role = 'manager', type = 'info', title = '', body = '', read = false } = req.body

    const result = db.prepare(`
      INSERT INTO notifications (role, type, title, body, read)
      VALUES (?, ?, ?, ?, ?)
    `).run(role, type, title, body, read ? 1 : 0)

    const row = db.prepare('SELECT * FROM notifications WHERE id = ?').get(result.lastInsertRowid)
    res.status(201).json(rowToNotification(row))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
