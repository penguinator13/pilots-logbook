const express = require('express');
const db = require('../models/database');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

// All routes require authentication
router.use(requireAuth);

// Get all aircraft types for current user
router.get('/', (req, res) => {
  try {
    const aircraft = db.prepare(`
      SELECT id, name, created_at
      FROM aircraft_types
      WHERE user_id = ?
      ORDER BY name ASC
    `).all(req.session.userId);

    res.json(aircraft);
  } catch (error) {
    console.error('Error fetching aircraft:', error);
    res.status(500).json({ error: 'Error fetching aircraft types' });
  }
});

// Add new aircraft type
router.post('/', (req, res) => {
  const { name } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Aircraft name is required' });
  }

  const trimmedName = name.trim();

  try {
    const stmt = db.prepare(`
      INSERT INTO aircraft_types (user_id, name)
      VALUES (?, ?)
    `);

    const result = stmt.run(req.session.userId, trimmedName);

    const newAircraft = db.prepare('SELECT * FROM aircraft_types WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json(newAircraft);
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'This aircraft type already exists' });
    }
    console.error('Error adding aircraft:', error);
    res.status(500).json({ error: 'Error adding aircraft type' });
  }
});

// Update aircraft type (rename with batch flight update)
router.put('/:id', (req, res) => {
  const { name } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Aircraft name is required' });
  }

  const trimmedName = name.trim();
  const aircraftId = req.params.id;

  try {
    // Get current aircraft name
    const current = db.prepare(`
      SELECT name FROM aircraft_types WHERE id = ? AND user_id = ?
    `).get(aircraftId, req.session.userId);

    if (!current) {
      return res.status(404).json({ error: 'Aircraft type not found' });
    }

    // If name hasn't changed, just return success
    if (current.name === trimmedName) {
      const aircraft = db.prepare('SELECT * FROM aircraft_types WHERE id = ?').get(aircraftId);
      return res.json(aircraft);
    }

    // Check for duplicate name
    const existing = db.prepare(`
      SELECT id FROM aircraft_types WHERE name = ? AND user_id = ? AND id != ?
    `).get(trimmedName, req.session.userId, aircraftId);

    if (existing) {
      return res.status(400).json({ error: 'An aircraft type with this name already exists' });
    }

    // Count flights that will be updated
    const flightCount = db.prepare(`
      SELECT COUNT(*) as count FROM flights WHERE aircraft_type = ? AND user_id = ?
    `).get(current.name, req.session.userId);

    // Use transaction to update both tables atomically
    const updateAircraftType = db.transaction(() => {
      // Update aircraft_types table
      db.prepare(`
        UPDATE aircraft_types SET name = ? WHERE id = ? AND user_id = ?
      `).run(trimmedName, aircraftId, req.session.userId);

      // Batch update all flights referencing the old name
      db.prepare(`
        UPDATE flights SET aircraft_type = ? WHERE aircraft_type = ? AND user_id = ?
      `).run(trimmedName, current.name, req.session.userId);
    });

    updateAircraftType();

    const updated = db.prepare('SELECT * FROM aircraft_types WHERE id = ?').get(aircraftId);
    res.json({
      ...updated,
      flights_updated: flightCount.count
    });

  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'An aircraft type with this name already exists' });
    }
    console.error('Error updating aircraft:', error);
    res.status(500).json({ error: 'Error updating aircraft type' });
  }
});

// Delete aircraft type
router.delete('/:id', (req, res) => {
  try {
    // Check if aircraft is used in any flights
    const usage = db.prepare(`
      SELECT COUNT(*) as count
      FROM flights
      WHERE user_id = ? AND aircraft_type = (
        SELECT name FROM aircraft_types WHERE id = ? AND user_id = ?
      )
    `).get(req.session.userId, req.params.id, req.session.userId);

    if (usage.count > 0) {
      return res.status(400).json({
        error: `Cannot delete aircraft type. It is used in ${usage.count} flight(s).`
      });
    }

    const stmt = db.prepare('DELETE FROM aircraft_types WHERE id = ? AND user_id = ?');
    const result = stmt.run(req.params.id, req.session.userId);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Aircraft type not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting aircraft:', error);
    res.status(500).json({ error: 'Error deleting aircraft type' });
  }
});

module.exports = router;
