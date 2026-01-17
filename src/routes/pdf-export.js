/**
 * PDF Export Route
 * Generates aviation logbook format PDFs
 */

const express = require('express');
const db = require('../models/database');
const { requireAuth } = require('../middleware/auth');
const LogbookPDFGenerator = require('../lib/pdf-generator');

const router = express.Router();

// All routes require authentication
router.use(requireAuth);

/**
 * GET /pdf
 * Export flights to PDF logbook format
 * Query params:
 *   - fields: comma-separated list of custom field IDs to include (max 3)
 */
router.get('/pdf', (req, res) => {
  try {
    // Parse custom field IDs from query params
    const fieldIds = req.query.fields
      ? req.query.fields.split(',').map(id => parseInt(id)).filter(id => !isNaN(id)).slice(0, 3)
      : [];

    // Fetch all flights ordered chronologically (ASC)
    const flights = db.prepare(`
      SELECT
        id, date, aircraft_type, registration,
        pilot_in_command, copilot_student, flight_details,
        flight_time_hours, aircraft_category, engine_type,
        day_pic, night_pic, day_dual, night_dual,
        day_sic, night_sic, day_cmnd_practice, night_cmnd_practice,
        instrument_hours, simulated_instrument_hours, ground_instrument_hours
      FROM flights
      WHERE user_id = ?
      ORDER BY date ASC, id ASC
    `).all(req.session.userId);

    if (flights.length === 0) {
      return res.status(404).json({ error: 'No flights to export' });
    }

    // Fetch custom fields if any IDs were provided
    let customFields = [];
    if (fieldIds.length > 0) {
      const placeholders = fieldIds.map(() => '?').join(',');
      customFields = db.prepare(`
        SELECT id, field_name, field_label
        FROM custom_fields
        WHERE id IN (${placeholders}) AND user_id = ?
        ORDER BY id ASC
      `).all(...fieldIds, req.session.userId);
    }

    // Fetch custom field values for all flights
    if (customFields.length > 0) {
      const fieldIdList = customFields.map(cf => cf.id);
      const cfPlaceholders = fieldIdList.map(() => '?').join(',');

      flights.forEach(flight => {
        flight.customFieldValues = {};

        const values = db.prepare(`
          SELECT field_id, value
          FROM custom_field_values
          WHERE flight_id = ? AND field_id IN (${cfPlaceholders})
        `).all(flight.id, ...fieldIdList);

        values.forEach(v => {
          flight.customFieldValues[v.field_id] = v.value || 0;
        });
      });
    } else {
      // Initialize empty customFieldValues for all flights
      flights.forEach(flight => {
        flight.customFieldValues = {};
      });
    }

    // Generate PDF
    const generator = new LogbookPDFGenerator({
      customFields: customFields
    });

    const doc = generator.generate(flights);

    // Set response headers
    const filename = `logbook-${new Date().toISOString().split('T')[0]}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Pipe PDF to response
    doc.pipe(res);
    doc.end();

  } catch (error) {
    console.error('PDF export error:', error);
    res.status(500).json({ error: 'Error generating PDF: ' + error.message });
  }
});

module.exports = router;
