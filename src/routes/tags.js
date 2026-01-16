const express = require('express');
const db = require('../models/database');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

// All routes require authentication
router.use(requireAuth);

// Maximum number of tags allowed per user
const MAX_TAGS = 10;

// Get all tags for current user
router.get('/', (req, res) => {
  try {
    const tags = db.prepare(`
      SELECT id, name, created_at
      FROM tags
      WHERE user_id = ?
      ORDER BY name ASC
    `).all(req.session.userId);

    res.json(tags);
  } catch (error) {
    console.error('Error fetching tags:', error);
    res.status(500).json({ error: 'Error fetching tags' });
  }
});

// Add new tag
router.post('/', (req, res) => {
  const { name } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Tag name is required' });
  }

  const trimmedName = name.trim();

  // Validate tag name (no spaces, hashtags, or special characters that would break hashtag format)
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmedName)) {
    return res.status(400).json({ error: 'Tag name can only contain letters, numbers, underscores, and hyphens' });
  }

  if (trimmedName.length > 30) {
    return res.status(400).json({ error: 'Tag name must be 30 characters or less' });
  }

  try {
    // Check current tag count
    const countResult = db.prepare('SELECT COUNT(*) as count FROM tags WHERE user_id = ?').get(req.session.userId);

    if (countResult.count >= MAX_TAGS) {
      return res.status(400).json({ error: `Maximum of ${MAX_TAGS} tags allowed` });
    }

    const stmt = db.prepare(`
      INSERT INTO tags (user_id, name)
      VALUES (?, ?)
    `);

    const result = stmt.run(req.session.userId, trimmedName);

    const newTag = db.prepare('SELECT * FROM tags WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json(newTag);
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'This tag already exists' });
    }
    console.error('Error adding tag:', error);
    res.status(500).json({ error: 'Error adding tag' });
  }
});

// Delete tag
router.delete('/:id', (req, res) => {
  try {
    const stmt = db.prepare('DELETE FROM tags WHERE id = ? AND user_id = ?');
    const result = stmt.run(req.params.id, req.session.userId);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Tag not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting tag:', error);
    res.status(500).json({ error: 'Error deleting tag' });
  }
});

module.exports = router;
