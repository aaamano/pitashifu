import { Router } from 'express'
import { getDb } from '../db.js'

const router = Router()

// Helper: map DB row → API shape
function rowToStaff(row) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    role: row.role,
    skills: JSON.parse(row.skills || '[]'),
    hourlyOrders: row.hourly_orders,
    wage: row.wage,
    transitPerDay: row.transit_per_day,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    address: row.address,
    emergencyContact: row.emergency_contact,
    bankInfo: row.bank_info,
    notes: row.notes,
    employmentStart: row.employment_start,
    employmentType: row.employment_type,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// GET /api/staff
router.get('/', (req, res) => {
  try {
    const rows = getDb().prepare('SELECT * FROM staff ORDER BY id').all()
    res.json(rows.map(rowToStaff))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/staff/:id
router.get('/:id', (req, res) => {
  try {
    const row = getDb().prepare('SELECT * FROM staff WHERE id = ?').get(req.params.id)
    if (!row) return res.status(404).json({ error: 'Staff not found' })
    res.json(rowToStaff(row))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/staff
router.post('/', (req, res) => {
  try {
    const db = getDb()
    const {
      name, type = 'P', role = 'スタッフ', skills = [],
      hourlyOrders = 8, wage = 1050, transitPerDay = 0,
      contactEmail = '', contactPhone = '', address = '',
      emergencyContact = '', bankInfo = '', notes = '',
      employmentStart = '', employmentType = 'part_time',
    } = req.body

    if (!name) return res.status(400).json({ error: 'name is required' })

    const result = db.prepare(`
      INSERT INTO staff (name, type, role, skills, hourly_orders, wage, transit_per_day,
        contact_email, contact_phone, address, emergency_contact, bank_info, notes,
        employment_start, employment_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name, type, role, JSON.stringify(skills), hourlyOrders, wage, transitPerDay,
      contactEmail, contactPhone, address, emergencyContact, bankInfo, notes,
      employmentStart, employmentType,
    )
    const row = db.prepare('SELECT * FROM staff WHERE id = ?').get(result.lastInsertRowid)
    res.status(201).json(rowToStaff(row))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/staff/:id
router.put('/:id', (req, res) => {
  try {
    const db = getDb()
    const existing = db.prepare('SELECT * FROM staff WHERE id = ?').get(req.params.id)
    if (!existing) return res.status(404).json({ error: 'Staff not found' })

    const {
      name, type, role, skills,
      hourlyOrders, wage, transitPerDay,
      contactEmail, contactPhone, address,
      emergencyContact, bankInfo, notes,
      employmentStart, employmentType,
    } = req.body

    db.prepare(`
      UPDATE staff SET
        name = COALESCE(?, name),
        type = COALESCE(?, type),
        role = COALESCE(?, role),
        skills = COALESCE(?, skills),
        hourly_orders = COALESCE(?, hourly_orders),
        wage = COALESCE(?, wage),
        transit_per_day = COALESCE(?, transit_per_day),
        contact_email = COALESCE(?, contact_email),
        contact_phone = COALESCE(?, contact_phone),
        address = COALESCE(?, address),
        emergency_contact = COALESCE(?, emergency_contact),
        bank_info = COALESCE(?, bank_info),
        notes = COALESCE(?, notes),
        employment_start = COALESCE(?, employment_start),
        employment_type = COALESCE(?, employment_type),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      name ?? null, type ?? null, role ?? null,
      skills !== undefined ? JSON.stringify(skills) : null,
      hourlyOrders ?? null, wage ?? null, transitPerDay ?? null,
      contactEmail ?? null, contactPhone ?? null, address ?? null,
      emergencyContact ?? null, bankInfo ?? null, notes ?? null,
      employmentStart ?? null, employmentType ?? null,
      req.params.id,
    )

    const row = db.prepare('SELECT * FROM staff WHERE id = ?').get(req.params.id)
    res.json(rowToStaff(row))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/staff/:id
router.delete('/:id', (req, res) => {
  try {
    const db = getDb()
    const existing = db.prepare('SELECT id FROM staff WHERE id = ?').get(req.params.id)
    if (!existing) return res.status(404).json({ error: 'Staff not found' })
    db.prepare('DELETE FROM staff WHERE id = ?').run(req.params.id)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
