import express from 'express'
import cors from 'cors'
import { getDb } from './db.js'

import staffRouter from './routes/staff.js'
import versionsRouter from './routes/versions.js'
import shiftDataRouter from './routes/shiftData.js'
import submissionsRouter from './routes/submissions.js'
import targetsRouter from './routes/targets.js'
import notificationsRouter from './routes/notifications.js'

const app = express()
const PORT = 3001

// Middleware
app.use(cors())
app.use(express.json())

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Mount routes
app.use('/api/staff', staffRouter)
app.use('/api/versions', versionsRouter)
// shiftData router handles its own path prefixes (shift-data and slot-assignments)
app.use('/api', shiftDataRouter)
app.use('/api/submissions', submissionsRouter)
app.use('/api/targets', targetsRouter)
app.use('/api/notifications', notificationsRouter)

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` })
})

// Error handler
app.use((err, req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: err.message })
})

// Initialize DB on startup
try {
  getDb()
  console.log('[server] Database initialized.')
} catch (err) {
  console.error('[server] Failed to initialize database:', err)
  process.exit(1)
}

app.listen(PORT, () => {
  console.log(`[server] PitaShift API running on http://localhost:${PORT}`)
})
