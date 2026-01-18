const express = require('express');
const db = require('../models/database');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

// All routes require authentication
router.use(requireAuth);

// ==================== HELPER FUNCTIONS ====================

/**
 * Calculate total flight time from component fields
 */
function calculateFlightTime(data) {
  return (
    (parseFloat(data.day_pic) || 0) +
    (parseFloat(data.night_pic) || 0) +
    (parseFloat(data.day_dual) || 0) +
    (parseFloat(data.night_dual) || 0) +
    (parseFloat(data.day_sic) || 0) +
    (parseFloat(data.night_sic) || 0) +
    (parseFloat(data.day_cmnd_practice) || 0) +
    (parseFloat(data.night_cmnd_practice) || 0)
  );
}

/**
 * Validate flight data
 * @returns {{ valid: boolean, error?: string }}
 */
function validateFlightData(data, flight_time) {
  if (!data.date || !data.aircraft_type) {
    return { valid: false, error: 'Missing required fields: Date and Aircraft Type are required' };
  }

  if (flight_time <= 0) {
    return { valid: false, error: 'Total flight time must be greater than 0. Please enter at least one flight time value.' };
  }

  const flightDate = new Date(data.date);
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  if (flightDate > today) {
    return { valid: false, error: 'Flight date cannot be in the future' };
  }

  return { valid: true };
}

/**
 * Batch fetch custom field values for multiple flights
 * @param {number[]} flightIds - Array of flight IDs
 * @returns {Object} Map of flight_id -> { field_id: value }
 */
function batchFetchCustomFieldValues(flightIds) {
  if (!flightIds || flightIds.length === 0) {
    return {};
  }

  const placeholders = flightIds.map(() => '?').join(',');
  const allValues = db.prepare(`
    SELECT flight_id, field_id, value
    FROM custom_field_values
    WHERE flight_id IN (${placeholders})
  `).all(...flightIds);

  // Group by flight_id
  const result = {};
  allValues.forEach(row => {
    if (!result[row.flight_id]) {
      result[row.flight_id] = {};
    }
    result[row.flight_id][row.field_id] = row.value;
  });

  return result;
}

/**
 * Round a number to 2 decimal places
 */
function roundHours(value) {
  return Math.round(value * 100) / 100;
}

// ==================== ROUTES ====================

// Get all flights with pagination and filtering
router.get('/', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;
  const aircraftFilter = req.query.aircraft_type || '';

  try {
    let query = 'SELECT id, date, aircraft_type, registration, pilot_in_command, copilot_student, flight_details as route, flight_time_hours as flight_time, day_hours, night_hours FROM flights WHERE user_id = ?';
    let countQuery = 'SELECT COUNT(*) as total FROM flights WHERE user_id = ?';
    const params = [req.session.userId];

    if (aircraftFilter) {
      query += ' AND aircraft_type = ?';
      countQuery += ' AND aircraft_type = ?';
      params.push(aircraftFilter);
    }

    query += ' ORDER BY date DESC, id DESC LIMIT ? OFFSET ?';

    const flights = db.prepare(query).all(...params, limit, offset);
    const { total } = db.prepare(countQuery).get(...params);

    res.json({
      flights,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      total
    });
  } catch (error) {
    console.error('Error fetching flights:', error);
    res.status(500).json({ error: 'Error fetching flights' });
  }
});

// Get single flight
router.get('/:id', (req, res) => {
  try {
    const flight = db.prepare(`
      SELECT id, date, aircraft_type, registration,
             pilot_in_command as pic, copilot_student as copilot,
             flight_details as route, flight_time_hours as flight_time,
             day_pic, night_pic, day_dual, night_dual, day_sic, night_sic,
             day_cmnd_practice, night_cmnd_practice,
             longline_hours, mountain_hours, instructor_hours, crosscountry_hours,
             night_vision_hours, instrument_hours, simulated_instrument_hours, ground_instrument_hours,
             aircraft_category, engine_type,
             takeoffs_day, takeoffs_night, landings_day, landings_night,
             departure, arrival
      FROM flights WHERE id = ? AND user_id = ?
    `).get(req.params.id, req.session.userId);

    if (!flight) {
      return res.status(404).json({ error: 'Flight not found' });
    }

    // Fetch custom field values for this flight
    const customFieldValues = db.prepare(`
      SELECT cfv.value, cf.field_name, cf.field_label
      FROM custom_field_values cfv
      JOIN custom_fields cf ON cfv.field_id = cf.id
      WHERE cfv.flight_id = ? AND cf.user_id = ?
    `).all(req.params.id, req.session.userId);

    // Add custom fields to flight object
    flight.custom_fields = customFieldValues;

    res.json(flight);
  } catch (error) {
    console.error('Error fetching flight:', error);
    res.status(500).json({ error: 'Error fetching flight' });
  }
});

// Get dashboard statistics
router.get('/stats/summary', (req, res) => {
  try {
    // Total flight hours (excludes simulator flights)
    const totalHours = db.prepare(
      "SELECT COALESCE(SUM(flight_time_hours), 0) as total FROM flights WHERE user_id = ? AND aircraft_category != 'Simulator'"
    ).get(req.session.userId);

    // Ground time (simulator flights only)
    const groundTimeHours = db.prepare(
      "SELECT COALESCE(SUM(flight_time_hours), 0) as total FROM flights WHERE user_id = ? AND aircraft_category = 'Simulator'"
    ).get(req.session.userId);

    // Total day and night hours (sum from new fields, excludes simulator)
    const dayNightHours = db.prepare(
      `SELECT
        COALESCE(SUM(day_pic + day_dual + day_sic + day_cmnd_practice), 0) as day,
        COALESCE(SUM(night_pic + night_dual + night_sic + night_cmnd_practice), 0) as night
      FROM flights WHERE user_id = ? AND aircraft_category != 'Simulator'`
    ).get(req.session.userId);

    // Total dual and PIC hours (sum from new fields, excludes simulator)
    const dualPicHours = db.prepare(
      `SELECT
        COALESCE(SUM(day_dual + night_dual), 0) as dual,
        COALESCE(SUM(day_pic + night_pic), 0) as pic
      FROM flights WHERE user_id = ? AND aircraft_category != 'Simulator'`
    ).get(req.session.userId);

    // Hours by aircraft type (flight count excludes prime entries)
    const hoursByAircraft = db.prepare(`
      SELECT aircraft_type, aircraft_category, SUM(flight_time_hours) as hours,
        SUM(CASE WHEN flight_details IS NULL OR flight_details NOT LIKE '%LOGBOOK PRIME ENTRY%' THEN 1 ELSE 0 END) as flights
      FROM flights
      WHERE user_id = ?
      GROUP BY aircraft_type, aircraft_category
      ORDER BY hours DESC
    `).all(req.session.userId);

    // Total flights count (excludes prime entries and simulator flights)
    const totalFlights = db.prepare(
      "SELECT COUNT(*) as count FROM flights WHERE user_id = ? AND aircraft_category != 'Simulator' AND (flight_details IS NULL OR flight_details NOT LIKE '%LOGBOOK PRIME ENTRY%')"
    ).get(req.session.userId);

    // Last 10 flights - select specific columns to avoid issues with missing columns
    const recentFlights = db.prepare(`
      SELECT id, date, aircraft_type, aircraft_category, registration, pilot_in_command, copilot_student,
             flight_details, flight_time_hours, day_hours, night_hours,
             longline_hours, mountain_hours, instructor_hours,
             COALESCE(crosscountry_hours, 0) as crosscountry_hours,
             takeoffs_day, takeoffs_night, landings_day, landings_night
      FROM flights WHERE user_id = ? ORDER BY date DESC, id DESC LIMIT 10
    `).all(req.session.userId);

    res.json({
      totalHours: totalHours.total,
      groundTimeHours: groundTimeHours.total,
      totalDayHours: dayNightHours.day,
      totalNightHours: dayNightHours.night,
      totalDualHours: dualPicHours.dual,
      totalPicHours: dualPicHours.pic,
      totalFlights: totalFlights.count,
      byAircraft: hoursByAircraft,
      flights: recentFlights
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({ error: 'Error fetching statistics' });
  }
});

// Create new flight
router.post('/', (req, res) => {
  const {
    date,
    aircraft_type,
    registration,
    pic,
    copilot,
    route,
    day_pic,
    night_pic,
    day_dual,
    night_dual,
    day_sic,
    night_sic,
    day_cmnd_practice,
    night_cmnd_practice,
    aircraft_category,
    engine_type,
    takeoffs_day,
    takeoffs_night,
    landings_day,
    landings_night,
    departure,
    arrival
  } = req.body;

  // Calculate total flight time using helper
  const flight_time = calculateFlightTime(req.body);

  // Validate using helper
  const validation = validateFlightData(req.body, flight_time);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO flights (
        user_id, date, aircraft_type, registration, pilot_in_command,
        copilot_student, flight_details, flight_time_hours,
        day_pic, night_pic, day_dual, night_dual, day_sic, night_sic,
        day_cmnd_practice, night_cmnd_practice,
        longline_hours, mountain_hours, instructor_hours, crosscountry_hours,
        night_vision_hours, instrument_hours, simulated_instrument_hours, ground_instrument_hours,
        aircraft_category, engine_type,
        takeoffs_day, takeoffs_night, landings_day, landings_night,
        departure, arrival
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      req.session.userId,
      date,
      aircraft_type,
      registration || '',
      pic || '',
      copilot || '',
      route || '',
      flight_time,  // Calculated total
      parseFloat(day_pic) || 0,
      parseFloat(night_pic) || 0,
      parseFloat(day_dual) || 0,
      parseFloat(night_dual) || 0,
      parseFloat(day_sic) || 0,
      parseFloat(night_sic) || 0,
      parseFloat(day_cmnd_practice) || 0,
      parseFloat(night_cmnd_practice) || 0,
      0,  // longline_hours - legacy column, no longer used
      0,  // mountain_hours - legacy column, no longer used
      0,  // instructor_hours - legacy column, no longer used
      0,  // crosscountry_hours - legacy column, no longer used
      0,  // night_vision_hours - legacy column, no longer used
      0,  // instrument_hours - legacy column, no longer used
      0,  // simulated_instrument_hours - legacy column, no longer used
      0,  // ground_instrument_hours - legacy column, no longer used
      aircraft_category || 'Helicopter',
      engine_type || 'Single Engine',
      parseInt(takeoffs_day) || 0,
      parseInt(takeoffs_night) || 0,
      parseInt(landings_day) || 0,
      parseInt(landings_night) || 0,
      departure || '',
      arrival || ''
    );

    const flightId = result.lastInsertRowid;

    // Handle custom fields if provided
    if (req.body.custom_fields && Array.isArray(req.body.custom_fields)) {
      const customFieldStmt = db.prepare(`
        INSERT INTO custom_field_values (flight_id, field_id, value)
        VALUES (?, ?, ?)
        ON CONFLICT(flight_id, field_id) DO UPDATE SET value = excluded.value
      `);

      for (const cf of req.body.custom_fields) {
        if (cf.field_id && cf.value !== undefined) {
          customFieldStmt.run(flightId, cf.field_id, parseFloat(cf.value) || 0);
        }
      }
    }

    const newFlight = db.prepare('SELECT * FROM flights WHERE id = ?').get(flightId);

    res.status(201).json(newFlight);
  } catch (error) {
    console.error('Error creating flight:', error);
    res.status(500).json({ error: 'Error creating flight' });
  }
});

// Update flight
router.put('/:id', (req, res) => {
  const {
    date,
    aircraft_type,
    registration,
    pic,
    copilot,
    route,
    day_pic,
    night_pic,
    day_dual,
    night_dual,
    day_sic,
    night_sic,
    day_cmnd_practice,
    night_cmnd_practice,
    aircraft_category,
    engine_type,
    takeoffs_day,
    takeoffs_night,
    landings_day,
    landings_night,
    departure,
    arrival
  } = req.body;

  // Calculate total flight time using helper
  const flight_time = calculateFlightTime(req.body);

  // Validate using helper
  const validation = validateFlightData(req.body, flight_time);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  try {
    const stmt = db.prepare(`
      UPDATE flights SET
        date = ?, aircraft_type = ?, registration = ?, pilot_in_command = ?,
        copilot_student = ?, flight_details = ?, flight_time_hours = ?,
        day_pic = ?, night_pic = ?, day_dual = ?, night_dual = ?,
        day_sic = ?, night_sic = ?, day_cmnd_practice = ?, night_cmnd_practice = ?,
        longline_hours = ?, mountain_hours = ?, instructor_hours = ?, crosscountry_hours = ?,
        night_vision_hours = ?, instrument_hours = ?, simulated_instrument_hours = ?, ground_instrument_hours = ?,
        aircraft_category = ?, engine_type = ?,
        takeoffs_day = ?, takeoffs_night = ?, landings_day = ?, landings_night = ?,
        departure = ?, arrival = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `);

    const result = stmt.run(
      date,
      aircraft_type,
      registration || '',
      pic || '',
      copilot || '',
      route || '',
      flight_time,  // Calculated total
      parseFloat(day_pic) || 0,
      parseFloat(night_pic) || 0,
      parseFloat(day_dual) || 0,
      parseFloat(night_dual) || 0,
      parseFloat(day_sic) || 0,
      parseFloat(night_sic) || 0,
      parseFloat(day_cmnd_practice) || 0,
      parseFloat(night_cmnd_practice) || 0,
      0,  // longline_hours - legacy column, no longer used
      0,  // mountain_hours - legacy column, no longer used
      0,  // instructor_hours - legacy column, no longer used
      0,  // crosscountry_hours - legacy column, no longer used
      0,  // night_vision_hours - legacy column, no longer used
      0,  // instrument_hours - legacy column, no longer used
      0,  // simulated_instrument_hours - legacy column, no longer used
      0,  // ground_instrument_hours - legacy column, no longer used
      aircraft_category || 'Helicopter',
      engine_type || 'Single Engine',
      parseInt(takeoffs_day) || 0,
      parseInt(takeoffs_night) || 0,
      parseInt(landings_day) || 0,
      parseInt(landings_night) || 0,
      departure || '',
      arrival || '',
      req.params.id,
      req.session.userId
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Flight not found' });
    }

    // Handle custom fields if provided
    if (req.body.custom_fields && Array.isArray(req.body.custom_fields)) {
      // First, delete existing custom field values for this flight
      db.prepare('DELETE FROM custom_field_values WHERE flight_id = ?').run(req.params.id);

      // Insert new values
      const customFieldStmt = db.prepare(`
        INSERT INTO custom_field_values (flight_id, field_id, value)
        VALUES (?, ?, ?)
      `);

      for (const cf of req.body.custom_fields) {
        if (cf.field_id && cf.value !== undefined && parseFloat(cf.value) > 0) {
          customFieldStmt.run(req.params.id, cf.field_id, parseFloat(cf.value));
        }
      }
    }

    const updatedFlight = db.prepare('SELECT * FROM flights WHERE id = ?').get(req.params.id);

    res.json(updatedFlight);
  } catch (error) {
    console.error('Error updating flight:', error);
    res.status(500).json({ error: 'Error updating flight' });
  }
});

// Delete flight
router.delete('/:id', (req, res) => {
  try {
    const stmt = db.prepare('DELETE FROM flights WHERE id = ? AND user_id = ?');
    const result = stmt.run(req.params.id, req.session.userId);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Flight not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting flight:', error);
    res.status(500).json({ error: 'Error deleting flight' });
  }
});

// Export flights to CSV
router.get('/export/csv', (req, res) => {
  try {
    const flights = db.prepare(
      'SELECT * FROM flights WHERE user_id = ? ORDER BY date DESC'
    ).all(req.session.userId);

    if (flights.length === 0) {
      return res.status(404).json({ error: 'No flights to export' });
    }

    // Get all custom fields for this user
    const customFields = db.prepare(
      'SELECT id, field_label FROM custom_fields WHERE user_id = ? ORDER BY id ASC'
    ).all(req.session.userId);

    // CSV header - simple format with all fields (legacy specialty hours removed)
    const headers = [
      'Date',
      'Aircraft Category',
      'Engine Type',
      'Aircraft Type',
      'Registration',
      'Pilot in Command',
      'Co-pilot/Student',
      'Departure',
      'Arrival',
      'Flight Details',
      'Total Hours',
      'Day PIC',
      'Night PIC',
      'Day Dual',
      'Night Dual',
      'Day SIC',
      'Night SIC',
      'Day Command Practice',
      'Night Command Practice',
      ...customFields.map(cf => cf.field_label),
      'Takeoffs Day',
      'Takeoffs Night',
      'Landings Day',
      'Landings Night'
    ];

    let csv = headers.join(',') + '\n';

    // Batch fetch custom field values (fixes N+1 query)
    const flightIds = flights.map(f => f.id);
    const allCustomFieldValues = customFields.length > 0 ? batchFetchCustomFieldValues(flightIds) : {};

    flights.forEach(flight => {
      // Get custom field values from batch result
      const customFieldValues = allCustomFieldValues[flight.id] || {};

      const row = [
        flight.date,
        flight.aircraft_category || 'Helicopter',
        flight.engine_type || 'Single Engine',
        flight.aircraft_type,
        flight.registration || '',
        flight.pilot_in_command || '',
        flight.copilot_student || '',
        flight.departure || '',
        flight.arrival || '',
        `"${(flight.flight_details || '').replace(/"/g, '""')}"`,
        flight.flight_time_hours,
        flight.day_pic || 0,
        flight.night_pic || 0,
        flight.day_dual || 0,
        flight.night_dual || 0,
        flight.day_sic || 0,
        flight.night_sic || 0,
        flight.day_cmnd_practice || 0,
        flight.night_cmnd_practice || 0,
        ...customFields.map(cf => customFieldValues[cf.id] || 0),
        flight.takeoffs_day || 0,
        flight.takeoffs_night || 0,
        flight.landings_day || 0,
        flight.landings_night || 0
      ];
      csv += row.join(',') + '\n';
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=logbook-export.csv');
    res.send(csv);
  } catch (error) {
    console.error('Error exporting flights:', error);
    res.status(500).json({ error: 'Error exporting flights' });
  }
});

// Export summary statistics
router.get('/export/summary', (req, res) => {
  try {
    const flights = db.prepare(
      'SELECT * FROM flights WHERE user_id = ? ORDER BY date DESC'
    ).all(req.session.userId);

    if (flights.length === 0) {
      return res.status(404).json({ error: 'No flights to summarize' });
    }

    // Get custom fields for this user
    const customFields = db.prepare(
      'SELECT id, field_label FROM custom_fields WHERE user_id = ? ORDER BY id ASC'
    ).all(req.session.userId);

    // Calculate totals
    const totals = {
      totalFlights: 0,
      totalHours: 0,
      groundTimeHours: 0,
      dayPicHours: 0,
      nightPicHours: 0,
      dayDualHours: 0,
      nightDualHours: 0,
      daySicHours: 0,
      nightSicHours: 0,
      dayCmndPracticeHours: 0,
      nightCmndPracticeHours: 0,
      totalPicHours: 0,
      totalDualHours: 0,
      totalSicHours: 0,
      totalCmndPracticeHours: 0,
      totalDayHours: 0,
      totalNightHours: 0,
      totalTakeoffsDay: 0,
      totalTakeoffsNight: 0,
      totalLandingsDay: 0,
      totalLandingsNight: 0,
      byAircraftCategory: {},
      byEngineType: {},
      byAircraftType: {},
      customFields: {}
    };

    // Initialize custom field totals
    customFields.forEach(cf => {
      totals.customFields[cf.id] = { label: cf.field_label, hours: 0 };
    });

    // Batch fetch custom field values (fixes N+1 query)
    const flightIds = flights.map(f => f.id);
    const allCustomFieldValues = customFields.length > 0 ? batchFetchCustomFieldValues(flightIds) : {};

    flights.forEach(flight => {
      const isSimulator = flight.aircraft_category === 'Simulator';
      const isPrimeEntry = flight.flight_details && flight.flight_details.includes('LOGBOOK PRIME ENTRY');

      // Simulator flights go to ground time, not flight time
      if (isSimulator) {
        totals.groundTimeHours += flight.flight_time_hours || 0;
      } else {
        // Total hours (excludes simulator)
        totals.totalHours += flight.flight_time_hours || 0;

        // Count flights (excludes simulator and prime entries)
        if (!isPrimeEntry) {
          totals.totalFlights += 1;
        }

        // Flight time breakdown (only for non-simulator flights)
        const dayPic = flight.day_pic || 0;
        const nightPic = flight.night_pic || 0;
        const dayDual = flight.day_dual || 0;
        const nightDual = flight.night_dual || 0;
        const daySic = flight.day_sic || 0;
        const nightSic = flight.night_sic || 0;
        const dayCmndPractice = flight.day_cmnd_practice || 0;
        const nightCmndPractice = flight.night_cmnd_practice || 0;

        totals.dayPicHours += dayPic;
        totals.nightPicHours += nightPic;
        totals.dayDualHours += dayDual;
        totals.nightDualHours += nightDual;
        totals.daySicHours += daySic;
        totals.nightSicHours += nightSic;
        totals.dayCmndPracticeHours += dayCmndPractice;
        totals.nightCmndPracticeHours += nightCmndPractice;

        totals.totalPicHours += dayPic + nightPic;
        totals.totalDualHours += dayDual + nightDual;
        totals.totalSicHours += daySic + nightSic;
        totals.totalCmndPracticeHours += dayCmndPractice + nightCmndPractice;
        totals.totalDayHours += dayPic + dayDual + daySic + dayCmndPractice;
        totals.totalNightHours += nightPic + nightDual + nightSic + nightCmndPractice;

        // Takeoffs and landings (only for non-simulator flights)
        totals.totalTakeoffsDay += flight.takeoffs_day || 0;
        totals.totalTakeoffsNight += flight.takeoffs_night || 0;
        totals.totalLandingsDay += flight.landings_day || 0;
        totals.totalLandingsNight += flight.landings_night || 0;
      }

      // By aircraft category (includes all flights including simulator)
      const category = flight.aircraft_category || 'Helicopter';
      if (!totals.byAircraftCategory[category]) {
        totals.byAircraftCategory[category] = { hours: 0, flights: 0 };
      }
      totals.byAircraftCategory[category].hours += flight.flight_time_hours || 0;
      if (!isPrimeEntry) {
        totals.byAircraftCategory[category].flights += 1;
      }

      // By engine type (includes all flights including simulator)
      const engineType = flight.engine_type || 'Single Engine';
      if (!totals.byEngineType[engineType]) {
        totals.byEngineType[engineType] = { hours: 0, flights: 0 };
      }
      totals.byEngineType[engineType].hours += flight.flight_time_hours || 0;
      if (!isPrimeEntry) {
        totals.byEngineType[engineType].flights += 1;
      }

      // By aircraft type (includes all flights including simulator)
      const aircraftType = flight.aircraft_type;
      if (!totals.byAircraftType[aircraftType]) {
        totals.byAircraftType[aircraftType] = { hours: 0, flights: 0 };
      }
      totals.byAircraftType[aircraftType].hours += flight.flight_time_hours || 0;
      if (!isPrimeEntry) {
        totals.byAircraftType[aircraftType].flights += 1;
      }

      // Custom field values (applies to ALL flights including simulator)
      const customFieldValues = allCustomFieldValues[flight.id] || {};
      Object.keys(customFieldValues).forEach(fieldId => {
        if (totals.customFields[fieldId]) {
          totals.customFields[fieldId].hours += customFieldValues[fieldId] || 0;
        }
      });
    });

    // Round all hours to 2 decimal places using helper
    totals.totalHours = roundHours(totals.totalHours);
    totals.groundTimeHours = roundHours(totals.groundTimeHours);
    totals.dayPicHours = roundHours(totals.dayPicHours);
    totals.nightPicHours = roundHours(totals.nightPicHours);
    totals.dayDualHours = roundHours(totals.dayDualHours);
    totals.nightDualHours = roundHours(totals.nightDualHours);
    totals.daySicHours = roundHours(totals.daySicHours);
    totals.nightSicHours = roundHours(totals.nightSicHours);
    totals.dayCmndPracticeHours = roundHours(totals.dayCmndPracticeHours);
    totals.nightCmndPracticeHours = roundHours(totals.nightCmndPracticeHours);
    totals.totalPicHours = roundHours(totals.totalPicHours);
    totals.totalDualHours = roundHours(totals.totalDualHours);
    totals.totalSicHours = roundHours(totals.totalSicHours);
    totals.totalCmndPracticeHours = roundHours(totals.totalCmndPracticeHours);
    totals.totalDayHours = roundHours(totals.totalDayHours);
    totals.totalNightHours = roundHours(totals.totalNightHours);

    // Round hours in breakdowns
    Object.keys(totals.byAircraftCategory).forEach(key => {
      totals.byAircraftCategory[key].hours = roundHours(totals.byAircraftCategory[key].hours);
    });
    Object.keys(totals.byEngineType).forEach(key => {
      totals.byEngineType[key].hours = roundHours(totals.byEngineType[key].hours);
    });
    Object.keys(totals.byAircraftType).forEach(key => {
      totals.byAircraftType[key].hours = roundHours(totals.byAircraftType[key].hours);
    });

    // Round custom field hours
    Object.keys(totals.customFields).forEach(key => {
      totals.customFields[key].hours = roundHours(totals.customFields[key].hours);
    });

    // Format as text report
    let report = '=== FLIGHT EXPERIENCE SUMMARY ===\n\n';
    report += `Total Flights: ${totals.totalFlights}\n`;
    report += `Total Hours: ${totals.totalHours}\n`;
    report += `Ground Time (Simulator): ${totals.groundTimeHours}\n\n`;

    report += '--- FLIGHT TIME BREAKDOWN ---\n';
    report += `Total Day Hours: ${totals.totalDayHours}\n`;
    report += `Total Night Hours: ${totals.totalNightHours}\n\n`;

    report += `PIC Hours: ${totals.totalPicHours}\n`;
    report += `Day PIC: ${totals.dayPicHours}\n`;
    report += `Night PIC: ${totals.nightPicHours}\n`;
    report += `Dual Hours: ${totals.totalDualHours}\n`;
    report += `Day Dual: ${totals.dayDualHours}\n`;
    report += `Night Dual: ${totals.nightDualHours}\n`;
    report += `SIC Hours: ${totals.totalSicHours}\n`;
    report += `Day SIC: ${totals.daySicHours}\n`;
    report += `Night SIC: ${totals.nightSicHours}\n`;
    report += `Command Practice Hours: ${totals.totalCmndPracticeHours}\n`;
    report += `Day Command Practice: ${totals.dayCmndPracticeHours}\n`;
    report += `Night Command Practice: ${totals.nightCmndPracticeHours}\n\n`;

    // Add custom fields section if any exist
    if (Object.keys(totals.customFields).length > 0) {
      report += '--- CUSTOM FIELDS ---\n';
      Object.keys(totals.customFields).forEach(fieldId => {
        const cf = totals.customFields[fieldId];
        report += `${cf.label}: ${cf.hours}\n`;
      });
      report += '\n';
    }

    report += '--- TAKEOFFS & LANDINGS ---\n';
    report += `Day Takeoffs: ${totals.totalTakeoffsDay}\n`;
    report += `Night Takeoffs: ${totals.totalTakeoffsNight}\n`;
    report += `Day Landings: ${totals.totalLandingsDay}\n`;
    report += `Night Landings: ${totals.totalLandingsNight}\n\n`;

    report += '--- BY AIRCRAFT CATEGORY ---\n';
    Object.keys(totals.byAircraftCategory).sort().forEach(category => {
      const data = totals.byAircraftCategory[category];
      report += `${category}: ${data.hours} hours (${data.flights} flights)\n`;
    });
    report += '\n';

    report += '--- BY ENGINE TYPE ---\n';
    Object.keys(totals.byEngineType).sort().forEach(type => {
      const data = totals.byEngineType[type];
      report += `${type}: ${data.hours} hours (${data.flights} flights)\n`;
    });
    report += '\n';

    report += '--- BY AIRCRAFT TYPE ---\n';
    Object.keys(totals.byAircraftType).sort().forEach(type => {
      const data = totals.byAircraftType[type];
      report += `${type}: ${data.hours} hours (${data.flights} flights)\n`;
    });

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', 'attachment; filename=logbook-summary.txt');
    res.send(report);
  } catch (error) {
    console.error('Error generating summary:', error);
    res.status(500).json({ error: 'Error generating summary' });
  }
});

module.exports = router;
