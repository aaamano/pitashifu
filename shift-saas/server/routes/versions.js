import { Router } from 'express'
import { getDb } from '../db.js'

const router = Router()

function rowToVersion(row) {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    author: row.author,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// GET /api/versions
router.get('/', (req, res) => {
  try {
    const rows = getDb().prepare('SELECT * FROM shift_versions ORDER BY created_at').all()
    res.json(rows.map(rowToVersion))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/versions
router.post('/', (req, res) => {
  try {
    const db = getDb()
    const { id, name, status = 'draft', author = '' } = req.body
    if (!name) return res.status(400).json({ error: 'name is required' })

    // Generate an ID if not provided
    const versionId = id || `v${Date.now()}`

    db.prepare(`
      INSERT INTO shift_versions (id, name, status, author)
      VALUES (?, ?, ?, ?)
    `).run(versionId, name, status, author)

    const row = db.prepare('SELECT * FROM shift_versions WHERE id = ?').get(versionId)
    res.status(201).json(rowToVersion(row))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/versions/:id
router.put('/:id', (req, res) => {
  try {
    const db = getDb()
    const existing = db.prepare('SELECT * FROM shift_versions WHERE id = ?').get(req.params.id)
    if (!existing) return res.status(404).json({ error: 'Version not found' })

    const { name, status, author } = req.body

    db.prepare(`
      UPDATE shift_versions SET
        name = COALESCE(?, name),
        status = COALESCE(?, status),
        author = COALESCE(?, author),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(name ?? null, status ?? null, author ?? null, req.params.id)

    const row = db.prepare('SELECT * FROM shift_versions WHERE id = ?').get(req.params.id)
    res.json(rowToVersion(row))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/versions/:id
router.delete('/:id', (req, res) => {
  try {
    const db = getDb()
    const existing = db.prepare('SELECT id FROM shift_versions WHERE id = ?').get(req.params.id)
    if (!existing) return res.status(404).json({ error: 'Version not found' })

    const deleteTx = db.transaction(() => {
      db.prepare('DELETE FROM shift_data WHERE version_id = ?').run(req.params.id)
      db.prepare('DELETE FROM slot_assignments WHERE version_id = ?').run(req.params.id)
      db.prepare('DELETE FROM shift_versions WHERE id = ?').run(req.params.id)
    })
    deleteTx()

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
