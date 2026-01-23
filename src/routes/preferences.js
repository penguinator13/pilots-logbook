const express = require('express');
const db = require('../models/database');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

// All routes require authentication
router.use(requireAuth);

// Default dashboard configuration
const DEFAULT_CONFIG = {
  showHoursOverTime: true,
  showAircraftChart: true,
  showMonthlyActivity: true,
  hiddenCustomFields: []
};

// Get user preferences
router.get('/', (req, res) => {
  try {
    const prefs = db.prepare(`
      SELECT dashboard_config
      FROM user_preferences
      WHERE user_id = ?
    `).get(req.session.userId);

    if (!prefs) {
      // Return default config if no preferences exist
      return res.json(DEFAULT_CONFIG);
    }

    // Parse JSON config and merge with defaults
    let config;
    try {
      config = JSON.parse(prefs.dashboard_config);
    } catch (e) {
      config = {};
    }

    // Merge with defaults to ensure all keys exist
    const mergedConfig = { ...DEFAULT_CONFIG, ...config };
    res.json(mergedConfig);
  } catch (error) {
    console.error('Error fetching preferences:', error);
    res.status(500).json({ error: 'Error fetching preferences' });
  }
});

// Save user preferences
router.put('/', (req, res) => {
  const { showHoursOverTime, showAircraftChart, showMonthlyActivity, hiddenCustomFields } = req.body;

  // Validate input
  const config = {
    showHoursOverTime: showHoursOverTime !== false,
    showAircraftChart: showAircraftChart !== false,
    showMonthlyActivity: showMonthlyActivity !== false,
    hiddenCustomFields: Array.isArray(hiddenCustomFields) ? hiddenCustomFields.filter(id => Number.isInteger(id)) : []
  };

  try {
    const configJson = JSON.stringify(config);

    // Upsert: insert or update
    const existing = db.prepare('SELECT id FROM user_preferences WHERE user_id = ?').get(req.session.userId);

    if (existing) {
      db.prepare(`
        UPDATE user_preferences
        SET dashboard_config = ?, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `).run(configJson, req.session.userId);
    } else {
      db.prepare(`
        INSERT INTO user_preferences (user_id, dashboard_config)
        VALUES (?, ?)
      `).run(req.session.userId, configJson);
    }

    res.json({ success: true, config });
  } catch (error) {
    console.error('Error saving preferences:', error);
    res.status(500).json({ error: 'Error saving preferences' });
  }
});

module.exports = router;
