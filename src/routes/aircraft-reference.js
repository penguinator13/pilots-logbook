const express = require('express');
const { requireAuth } = require('../middleware/auth');
module.exports = function aircraftReference(load = () => require('../data/aircraft-types.json')) {
  const router = express.Router();
  router.use(requireAuth);
  router.get('/', (req, res) => {
    if ((req.query.q !== undefined && (typeof req.query.q !== 'string' || req.query.q.length > 100)) ||
        (req.query.category !== undefined && !['helicopter', 'all'].includes(req.query.category))) {
      return res.status(400).json({ error: 'Use q (at most 100 characters) and category helicopter or all.' });
    }
    try {
      const catalogue = load();
      if (!catalogue?.source || !Array.isArray(catalogue.aircraft)) throw new Error('Missing catalogue');
      // Compare a compact search key only; never rewrite the published aliases.
      const compact = value => String(value).toLowerCase().replace(/[\s\-‐‑–—]+/g, '');
      const query = compact(req.query.q || '');
      const aircraft = catalogue.aircraft.filter(row =>
        (req.query.category === 'all' || row.category === 'helicopter') &&
        [row.icao, row.manufacturer, row.model].some(value => compact(value).includes(query)));
      res.json({ source: catalogue.source, aircraft: aircraft.slice(0, 100), total: aircraft.length });
    } catch (error) {
      res.status(503).json({ error: 'Local aircraft reference unavailable. Manual profile entry is still available.' });
    }
  });
  return router;
};
