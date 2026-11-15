const express = require('express');
const db = require('../models/database');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();
router.use(requireAuth);

const FIELDS = 'id, registration, aircraft_type, aircraft_category, engine_type, engine_model, nickname, operator, favourite, is_default, archived, last_used_at';
const TEXT_LIMITS = { registration: 50, aircraft_type: 50, nickname: 100, operator: 100, engine_model: 100 };
const FLAGS = ['favourite', 'is_default', 'archived'];
const ENUMS = { aircraft_category: ['Helicopter', 'Aeroplane', 'Simulator'], engine_type: ['Single Engine', 'Multi Engine'] };
function serialize(row) {
  return { ...row, favourite: Boolean(row.favourite), is_default: Boolean(row.is_default), archived: Boolean(row.archived) };
}
function validate(body, existing) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'Expected an object' };
  const data = existing ? { ...existing } : {
    aircraft_category: 'Helicopter', engine_type: 'Single Engine', engine_model: '', nickname: '', operator: '',
    favourite: false, is_default: false, archived: false
  };
  for (const [field, max] of Object.entries(TEXT_LIMITS)) {
    if (Object.hasOwn(body, field)) {
      if (typeof body[field] !== 'string' || body[field].length > max || /[\x00-\x1f\x7f]/.test(body[field])) {
        return { error: `${field} must be a string of at most ${max} characters without control characters` };
      }
      data[field] = body[field].trim();
    }
  }
  if (!data.registration || !data.aircraft_type) return { error: 'Registration and aircraft type are required' };
  data.registration = data.registration.toUpperCase();
  if (data.registration.length > TEXT_LIMITS.registration) return { error: 'Registration is too long' };
  for (const field of FLAGS) {
    if (Object.hasOwn(body, field)) {
      if (typeof body[field] !== 'boolean') return { error: `${field} must be a boolean` };
      data[field] = body[field];
    }
  }
  for (const [field, allowed] of Object.entries(ENUMS)) {
    if (Object.hasOwn(body, field)) {
      if (!allowed.includes(body[field])) return { error: `Invalid ${field}` };
      data[field] = body[field];
    }
  }
  if (data.archived) data.is_default = false;
  return { data };
}
function save(req, res, existing) {
  const { data, error } = validate(req.body, existing);
  if (error) return res.status(400).json({ error });
  try {
    const id = db.transaction(() => {
      if (data.is_default) db.prepare('UPDATE aircraft_profiles SET is_default = 0 WHERE user_id = ?').run(req.session.userId);
      const values = [data.registration, data.aircraft_type, data.aircraft_category, data.engine_type, data.engine_model,
        data.nickname, data.operator, Number(data.favourite), Number(data.is_default), Number(data.archived)];
      if (existing) {
        db.prepare(`UPDATE aircraft_profiles SET registration = ?, aircraft_type = ?, aircraft_category = ?, engine_type = ?, engine_model = ?,
          nickname = ?, operator = ?, favourite = ?, is_default = ?, archived = ? WHERE id = ? AND user_id = ?`)
          .run(...values, existing.id, req.session.userId);
        return existing.id;
      }
      return db.prepare(`INSERT INTO aircraft_profiles
        (registration, aircraft_type, aircraft_category, engine_type, engine_model, nickname, operator, favourite, is_default, archived, user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(...values, req.session.userId).lastInsertRowid;
    })();
    const row = db.prepare(`SELECT ${FIELDS} FROM aircraft_profiles WHERE id = ? AND user_id = ?`).get(id, req.session.userId);
    return res.status(existing ? 200 : 201).json(serialize(row));
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: 'Registration already exists' });
    console.error('Error saving aircraft profile:', err);
    return res.status(500).json({ error: 'Error saving aircraft profile' });
  }
}

router.get('/', (req, res) => {
  const rows = db.prepare(`SELECT ${FIELDS} FROM aircraft_profiles WHERE user_id = ?
    ${req.query.include_archived === 'true' ? '' : 'AND archived = 0'}
    ORDER BY is_default DESC, favourite DESC, last_used_at DESC, registration COLLATE NOCASE ASC, id ASC`).all(req.session.userId);
  res.json(rows.map(serialize));
});
router.post('/', (req, res) => save(req, res));
router.put('/:id', (req, res) => {
  if (!/^[1-9]\d*$/.test(req.params.id) || !Number.isSafeInteger(Number(req.params.id))) {
    return res.status(400).json({ error: 'Invalid aircraft profile id' });
  }
  const existing = db.prepare(`SELECT ${FIELDS} FROM aircraft_profiles WHERE id = ? AND user_id = ?`).get(Number(req.params.id), req.session.userId);
  if (!existing) return res.status(404).json({ error: 'Aircraft profile not found' });
  return save(req, res, serialize(existing));
});

module.exports = router;
