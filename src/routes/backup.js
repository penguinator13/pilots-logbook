/**
 * Backup route: download a consistent snapshot of the SQLite database.
 * Uses SQLite's online backup API so the copy is safe even while the app
 * is running (WAL contents included).
 */
const express = require('express');
const fs = require('fs');
const os = require('os');
const path = require('path');
const db = require('../models/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/backup/db -> logbook-backup-YYYY-MM-DD.db
router.get('/db', async (req, res) => {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const tmpFile = path.join(os.tmpdir(), `logbook-backup-${process.pid}-${Date.now()}.db`);
  try {
    await db.backup(tmpFile);
    res.setHeader('Content-Type', 'application/x-sqlite3');
    res.setHeader('Content-Disposition', `attachment; filename=logbook-backup-${stamp}.db`);
    res.sendFile(tmpFile, (err) => {
      fs.unlink(tmpFile, () => {});
      if (err && !res.headersSent) {
        res.status(500).json({ error: 'Error sending backup' });
      }
    });
  } catch (error) {
    fs.unlink(tmpFile, () => {});
    console.error('Backup error:', error);
    res.status(500).json({ error: 'Error creating backup' });
  }
});

module.exports = router;
