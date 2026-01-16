const express = require('express');
const router = express.Router();
const db = require('../models/database');
const { requireAuth } = require('../middleware/auth');

// All routes require authentication
router.use(requireAuth);

// GET /api/custom-fields - Get all custom fields for the current user
router.get('/', (req, res) => {
  try {
    const customFields = db.prepare(`
      SELECT id, field_name, field_label, created_at
      FROM custom_fields
      WHERE user_id = ?
      ORDER BY created_at ASC
    `).all(req.session.userId);

    res.json(customFields);
  } catch (error) {
    console.error('Get custom fields error:', error);
    res.status(500).json({ error: 'Failed to retrieve custom fields' });
  }
});

// POST /api/custom-fields - Create a new custom field
router.post('/', (req, res) => {
  try {
    const { field_name, field_label } = req.body;

    // Validation
    if (!field_name || !field_label) {
      return res.status(400).json({ error: 'Field name and label are required' });
    }

    // Validate field_name format (must be lowercase with underscores and end with _hours)
    if (!/^[a-z_]+_hours$/.test(field_name)) {
      return res.status(400).json({ error: 'Field name must be lowercase letters and underscores only, ending with _hours' });
    }

    // Check if field name already exists for this user
    const existing = db.prepare(`
      SELECT id FROM custom_fields
      WHERE user_id = ? AND field_name = ?
    `).get(req.session.userId, field_name);

    if (existing) {
      return res.status(400).json({ error: 'A custom field with this name already exists' });
    }

    // Insert new custom field
    const result = db.prepare(`
      INSERT INTO custom_fields (user_id, field_name, field_label)
      VALUES (?, ?, ?)
    `).run(req.session.userId, field_name, field_label);

    const newField = db.prepare(`
      SELECT id, field_name, field_label, created_at
      FROM custom_fields
      WHERE id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(newField);
  } catch (error) {
    console.error('Create custom field error:', error);
    if (error.code === 'SQLITE_CONSTRAINT') {
      res.status(400).json({ error: 'A custom field with this name already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create custom field' });
    }
  }
});

// DELETE /api/custom-fields/:id - Delete a custom field
router.delete('/:id', (req, res) => {
  try {
    const fieldId = parseInt(req.params.id);

    // Check if field exists and belongs to user
    const field = db.prepare(`
      SELECT id, field_label
      FROM custom_fields
      WHERE id = ? AND user_id = ?
    `).get(fieldId, req.session.userId);

    if (!field) {
      return res.status(404).json({ error: 'Custom field not found' });
    }

    // Check if field is used in any flights
    const usage = db.prepare(`
      SELECT COUNT(*) as count
      FROM custom_field_values
      WHERE field_id = ? AND value > 0
    `).get(fieldId);

    if (usage.count > 0) {
      return res.status(400).json({
        error: `Cannot delete custom field "${field.field_label}". It is used in ${usage.count} flight(s).`
      });
    }

    // Delete the custom field (will cascade delete values due to ON DELETE CASCADE)
    db.prepare('DELETE FROM custom_fields WHERE id = ?').run(fieldId);

    res.json({ message: 'Custom field deleted successfully' });
  } catch (error) {
    console.error('Delete custom field error:', error);
    res.status(500).json({ error: 'Failed to delete custom field' });
  }
});

module.exports = router;
