const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../models/database');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

const MIN_PASSWORD_LENGTH = 8;

// Login
router.post('/login', (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Username and password required' });
  }

  try {
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const validPassword = bcrypt.compareSync(password, user.password);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Regenerate session on login to prevent session fixation attacks
    req.session.regenerate((err) => {
      if (err) {
        console.error('Session regeneration error:', err);
        return res.status(500).json({ error: 'Login failed' });
      }
      req.session.userId = user.id;
      req.session.username = user.username;
      res.json({ success: true, username: user.username });
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ error: 'Error logging out' });
    }
    res.clearCookie('logbook.sid');
    res.json({ success: true });
  });
});

// Check authentication status
router.get('/me', (req, res) => {
  if (req.session && req.session.userId) {
    res.json({ authenticated: true, username: req.session.username });
  } else {
    res.json({ authenticated: false });
  }
});

// Change password (requires current password)
router.post('/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};

  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
    return res.status(400).json({ error: 'Current and new password are required' });
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters` });
  }
  if (newPassword === currentPassword) {
    return res.status(400).json({ error: 'New password must differ from the current password' });
  }

  try {
    const user = db.prepare('SELECT id, password FROM users WHERE id = ?').get(req.session.userId);
    if (!user || !bcrypt.compareSync(currentPassword, user.password)) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hashed = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashed, user.id);

    // Invalidate every other session for this user (keep the current one)
    const currentSid = req.sessionID;
    db.prepare(`DELETE FROM sessions WHERE sid != ? AND json_extract(sess, '$.userId') = ?`).run(currentSid, user.id);

    res.json({ success: true });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Error changing password' });
  }
});

module.exports = router;
