const express = require('express');
const db = require('../models/database');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

// All routes require authentication
router.use(requireAuth);

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
             takeoffs_day, takeoffs_night, landings_day, landings_night
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
    console.log('Fetching dashboard stats for user:', req.session.userId);

    // Total flight hours
    const totalHours = db.prepare(
      'SELECT COALESCE(SUM(flight_time_hours), 0) as total FROM flights WHERE user_id = ?'
    ).get(req.session.userId);
    console.log('Total hours query OK');

    // Total day and night hours (sum from new fields)
    const dayNightHours = db.prepare(
      `SELECT
        COALESCE(SUM(day_pic + day_dual + day_sic + day_cmnd_practice), 0) as day,
        COALESCE(SUM(night_pic + night_dual + night_sic + night_cmnd_practice), 0) as night
      FROM flights WHERE user_id = ?`
    ).get(req.session.userId);
    console.log('Day/Night hours query OK');

    // Total dual and PIC hours (sum from new fields)
    const dualPicHours = db.prepare(
      `SELECT
        COALESCE(SUM(day_dual + night_dual), 0) as dual,
        COALESCE(SUM(day_pic + night_pic), 0) as pic
      FROM flights WHERE user_id = ?`
    ).get(req.session.userId);
    console.log('Dual/PIC hours query OK:', dualPicHours);

    // Hours by aircraft type (flight count excludes prime entries)
    const hoursByAircraft = db.prepare(`
      SELECT aircraft_type, SUM(flight_time_hours) as hours,
        SUM(CASE WHEN flight_details IS NULL OR flight_details NOT LIKE '%LOGBOOK PRIME ENTRY%' THEN 1 ELSE 0 END) as flights
      FROM flights
      WHERE user_id = ?
      GROUP BY aircraft_type
      ORDER BY hours DESC
    `).all(req.session.userId);
    console.log('Aircraft breakdown query OK');

    // Total flights count (excludes prime entries)
    const totalFlights = db.prepare(
      "SELECT COUNT(*) as count FROM flights WHERE user_id = ? AND (flight_details IS NULL OR flight_details NOT LIKE '%LOGBOOK PRIME ENTRY%')"
    ).get(req.session.userId);
    console.log('Total flights query OK');

    // Last 10 flights - select specific columns to avoid issues with missing columns
    const recentFlights = db.prepare(`
      SELECT id, date, aircraft_type, registration, pilot_in_command, copilot_student,
             flight_details, flight_time_hours, day_hours, night_hours,
             longline_hours, mountain_hours, instructor_hours,
             COALESCE(crosscountry_hours, 0) as crosscountry_hours,
             takeoffs_day, takeoffs_night, landings_day, landings_night
      FROM flights WHERE user_id = ? ORDER BY date DESC, id DESC LIMIT 10
    `).all(req.session.userId);
    console.log('Recent flights query OK');

    const response = {
      totalHours: totalHours.total,
      totalDayHours: dayNightHours.day,
      totalNightHours: dayNightHours.night,
      totalDualHours: dualPicHours.dual,
      totalPicHours: dualPicHours.pic,
      totalFlights: totalFlights.count,
      byAircraft: hoursByAircraft,
      flights: recentFlights
    };

    console.log('Sending response:', JSON.stringify(response).substring(0, 200));
    res.json(response);
  } catch (error) {
    console.error('Error fetching statistics:', error.message);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ error: 'Error fetching statistics: ' + error.message });
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
    longline_hours,
    mountain_hours,
    instructor_hours,
    crosscountry_hours,
    night_vision_hours,
    instrument_hours,
    simulated_instrument_hours,
    ground_instrument_hours,
    aircraft_category,
    engine_type,
    takeoffs_day,
    takeoffs_night,
    landings_day,
    landings_night
  } = req.body;

  // Calculate total flight time from component fields
  const flight_time = (
    (parseFloat(day_pic) || 0) +
    (parseFloat(night_pic) || 0) +
    (parseFloat(day_dual) || 0) +
    (parseFloat(night_dual) || 0) +
    (parseFloat(day_sic) || 0) +
    (parseFloat(night_sic) || 0) +
    (parseFloat(day_cmnd_practice) || 0) +
    (parseFloat(night_cmnd_practice) || 0)
  );

  // Validation - only date and aircraft_type are required
  if (!date || !aircraft_type) {
    return res.status(400).json({ error: 'Missing required fields: Date and Aircraft Type are required' });
  }

  if (flight_time <= 0) {
    return res.status(400).json({ error: 'Total flight time must be greater than 0. Please enter at least one flight time value.' });
  }

  const flightDate = new Date(date);
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  if (flightDate > today) {
    return res.status(400).json({ error: 'Flight date cannot be in the future' });
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
        takeoffs_day, takeoffs_night, landings_day, landings_night
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const longline_hrs = parseFloat(longline_hours) || 0;
    const mountain_hrs = parseFloat(mountain_hours) || 0;
    const instructor_hrs = parseFloat(instructor_hours) || 0;
    const crosscountry_hrs = parseFloat(crosscountry_hours) || 0;
    const night_vision_hrs = parseFloat(night_vision_hours) || 0;
    const instrument_hrs = parseFloat(instrument_hours) || 0;
    const simulated_instrument_hrs = parseFloat(simulated_instrument_hours) || 0;
    const ground_instrument_hrs = parseFloat(ground_instrument_hours) || 0;

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
      longline_hrs,  // Special operations hours
      mountain_hrs,
      instructor_hrs,
      crosscountry_hrs,
      night_vision_hrs,
      instrument_hrs,
      simulated_instrument_hrs,
      ground_instrument_hrs,
      aircraft_category || 'Helicopter',
      engine_type || 'Single Engine',
      parseInt(takeoffs_day) || 0,
      parseInt(takeoffs_night) || 0,
      parseInt(landings_day) || 0,
      parseInt(landings_night) || 0
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
    longline_hours,
    mountain_hours,
    instructor_hours,
    crosscountry_hours,
    night_vision_hours,
    instrument_hours,
    simulated_instrument_hours,
    ground_instrument_hours,
    aircraft_category,
    engine_type,
    takeoffs_day,
    takeoffs_night,
    landings_day,
    landings_night
  } = req.body;

  // Calculate total flight time from component fields
  const flight_time = (
    (parseFloat(day_pic) || 0) +
    (parseFloat(night_pic) || 0) +
    (parseFloat(day_dual) || 0) +
    (parseFloat(night_dual) || 0) +
    (parseFloat(day_sic) || 0) +
    (parseFloat(night_sic) || 0) +
    (parseFloat(day_cmnd_practice) || 0) +
    (parseFloat(night_cmnd_practice) || 0)
  );

  // Validation - only date and aircraft_type are required
  if (!date || !aircraft_type) {
    return res.status(400).json({ error: 'Missing required fields: Date and Aircraft Type are required' });
  }

  if (flight_time <= 0) {
    return res.status(400).json({ error: 'Total flight time must be greater than 0. Please enter at least one flight time value.' });
  }

  const flightDate = new Date(date);
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  if (flightDate > today) {
    return res.status(400).json({ error: 'Flight date cannot be in the future' });
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
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `);

    const longline_hrs = parseFloat(longline_hours) || 0;
    const mountain_hrs = parseFloat(mountain_hours) || 0;
    const instructor_hrs = parseFloat(instructor_hours) || 0;
    const crosscountry_hrs = parseFloat(crosscountry_hours) || 0;
    const night_vision_hrs = parseFloat(night_vision_hours) || 0;
    const instrument_hrs = parseFloat(instrument_hours) || 0;
    const simulated_instrument_hrs = parseFloat(simulated_instrument_hours) || 0;
    const ground_instrument_hrs = parseFloat(ground_instrument_hours) || 0;

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
      longline_hrs,  // Special operations hours
      mountain_hrs,
      instructor_hrs,
      crosscountry_hrs,
      night_vision_hrs,
      instrument_hrs,
      simulated_instrument_hrs,
      ground_instrument_hrs,
      aircraft_category || 'Helicopter',
      engine_type || 'Single Engine',
      parseInt(takeoffs_day) || 0,
      parseInt(takeoffs_night) || 0,
      parseInt(landings_day) || 0,
      parseInt(landings_night) || 0,
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
    console.log('Delete request for flight:', req.params.id, 'by user:', req.session.userId);
    const stmt = db.prepare('DELETE FROM flights WHERE id = ? AND user_id = ?');
    const result = stmt.run(req.params.id, req.session.userId);

    console.log('Delete result - changes:', result.changes);

    if (result.changes === 0) {
      console.log('Flight not found or unauthorized');
      return res.status(404).json({ error: 'Flight not found' });
    }

    console.log('Flight deleted successfully');
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting flight:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({ error: 'Error deleting flight: ' + error.message });
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

    // CSV header - simple format with all fields
    const headers = [
      'Date',
      'Aircraft Category',
      'Engine Type',
      'Aircraft Type',
      'Registration',
      'Pilot in Command',
      'Co-pilot/Student',
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
      'Longline Hours',
      'Mountain Hours',
      'Instructor Hours',
      'Cross-Country Hours',
      'Night Vision Hours',
      'Instrument Hours',
      'Simulated Instrument Hours',
      'Ground Instrument Hours',
      ...customFields.map(cf => cf.field_label),
      'Takeoffs Day',
      'Takeoffs Night',
      'Landings Day',
      'Landings Night'
    ];

    let csv = headers.join(',') + '\n';

    flights.forEach(flight => {
      // Get custom field values for this flight
      const customFieldValues = {};
      if (customFields.length > 0) {
        const cfValues = db.prepare(`
          SELECT field_id, value
          FROM custom_field_values
          WHERE flight_id = ?
        `).all(flight.id);
        cfValues.forEach(cfv => {
          customFieldValues[cfv.field_id] = cfv.value;
        });
      }

      const row = [
        flight.date,
        flight.aircraft_category || 'Helicopter',
        flight.engine_type || 'Single Engine',
        flight.aircraft_type,
        flight.registration || '',
        flight.pilot_in_command || '',
        flight.copilot_student || '',
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
        flight.longline_hours || 0,
        flight.mountain_hours || 0,
        flight.instructor_hours || 0,
        flight.crosscountry_hours || 0,
        flight.night_vision_hours || 0,
        flight.instrument_hours || 0,
        flight.simulated_instrument_hours || 0,
        flight.ground_instrument_hours || 0,
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
      totalFlights: flights.length,
      totalHours: 0,
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
      longlineHours: 0,
      mountainHours: 0,
      instructorHours: 0,
      crosscountryHours: 0,
      nightVisionHours: 0,
      instrumentHours: 0,
      simulatedInstrumentHours: 0,
      groundInstrumentHours: 0,
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

    flights.forEach(flight => {
      // Total hours
      totals.totalHours += flight.flight_time_hours || 0;

      // Flight time breakdown
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

      // Specialty hours
      totals.longlineHours += flight.longline_hours || 0;
      totals.mountainHours += flight.mountain_hours || 0;
      totals.instructorHours += flight.instructor_hours || 0;
      totals.crosscountryHours += flight.crosscountry_hours || 0;
      totals.nightVisionHours += flight.night_vision_hours || 0;
      totals.instrumentHours += flight.instrument_hours || 0;
      totals.simulatedInstrumentHours += flight.simulated_instrument_hours || 0;
      totals.groundInstrumentHours += flight.ground_instrument_hours || 0;

      // Takeoffs and landings
      totals.totalTakeoffsDay += flight.takeoffs_day || 0;
      totals.totalTakeoffsNight += flight.takeoffs_night || 0;
      totals.totalLandingsDay += flight.landings_day || 0;
      totals.totalLandingsNight += flight.landings_night || 0;

      // By aircraft category
      const category = flight.aircraft_category || 'Helicopter';
      if (!totals.byAircraftCategory[category]) {
        totals.byAircraftCategory[category] = { hours: 0, flights: 0 };
      }
      totals.byAircraftCategory[category].hours += flight.flight_time_hours || 0;
      totals.byAircraftCategory[category].flights += 1;

      // By engine type
      const engineType = flight.engine_type || 'Single Engine';
      if (!totals.byEngineType[engineType]) {
        totals.byEngineType[engineType] = { hours: 0, flights: 0 };
      }
      totals.byEngineType[engineType].hours += flight.flight_time_hours || 0;
      totals.byEngineType[engineType].flights += 1;

      // By aircraft type
      const aircraftType = flight.aircraft_type;
      if (!totals.byAircraftType[aircraftType]) {
        totals.byAircraftType[aircraftType] = { hours: 0, flights: 0 };
      }
      totals.byAircraftType[aircraftType].hours += flight.flight_time_hours || 0;
      totals.byAircraftType[aircraftType].flights += 1;

      // Custom field values
      if (customFields.length > 0) {
        const customFieldValues = db.prepare(`
          SELECT field_id, value
          FROM custom_field_values
          WHERE flight_id = ?
        `).all(flight.id);

        customFieldValues.forEach(cfv => {
          if (totals.customFields[cfv.field_id]) {
            totals.customFields[cfv.field_id].hours += cfv.value || 0;
          }
        });
      }
    });

    // Round all hours to 2 decimal places
    totals.totalHours = Math.round(totals.totalHours * 100) / 100;
    totals.dayPicHours = Math.round(totals.dayPicHours * 100) / 100;
    totals.nightPicHours = Math.round(totals.nightPicHours * 100) / 100;
    totals.dayDualHours = Math.round(totals.dayDualHours * 100) / 100;
    totals.nightDualHours = Math.round(totals.nightDualHours * 100) / 100;
    totals.daySicHours = Math.round(totals.daySicHours * 100) / 100;
    totals.nightSicHours = Math.round(totals.nightSicHours * 100) / 100;
    totals.dayCmndPracticeHours = Math.round(totals.dayCmndPracticeHours * 100) / 100;
    totals.nightCmndPracticeHours = Math.round(totals.nightCmndPracticeHours * 100) / 100;
    totals.totalPicHours = Math.round(totals.totalPicHours * 100) / 100;
    totals.totalDualHours = Math.round(totals.totalDualHours * 100) / 100;
    totals.totalSicHours = Math.round(totals.totalSicHours * 100) / 100;
    totals.totalCmndPracticeHours = Math.round(totals.totalCmndPracticeHours * 100) / 100;
    totals.totalDayHours = Math.round(totals.totalDayHours * 100) / 100;
    totals.totalNightHours = Math.round(totals.totalNightHours * 100) / 100;
    totals.longlineHours = Math.round(totals.longlineHours * 100) / 100;
    totals.mountainHours = Math.round(totals.mountainHours * 100) / 100;
    totals.instructorHours = Math.round(totals.instructorHours * 100) / 100;
    totals.crosscountryHours = Math.round(totals.crosscountryHours * 100) / 100;
    totals.nightVisionHours = Math.round(totals.nightVisionHours * 100) / 100;
    totals.instrumentHours = Math.round(totals.instrumentHours * 100) / 100;
    totals.simulatedInstrumentHours = Math.round(totals.simulatedInstrumentHours * 100) / 100;
    totals.groundInstrumentHours = Math.round(totals.groundInstrumentHours * 100) / 100;

    // Round hours in breakdowns
    Object.keys(totals.byAircraftCategory).forEach(key => {
      totals.byAircraftCategory[key].hours = Math.round(totals.byAircraftCategory[key].hours * 100) / 100;
    });
    Object.keys(totals.byEngineType).forEach(key => {
      totals.byEngineType[key].hours = Math.round(totals.byEngineType[key].hours * 100) / 100;
    });
    Object.keys(totals.byAircraftType).forEach(key => {
      totals.byAircraftType[key].hours = Math.round(totals.byAircraftType[key].hours * 100) / 100;
    });

    // Round custom field hours
    Object.keys(totals.customFields).forEach(key => {
      totals.customFields[key].hours = Math.round(totals.customFields[key].hours * 100) / 100;
    });

    // Format as text report
    let report = '=== FLIGHT EXPERIENCE SUMMARY ===\n\n';
    report += `Total Flights: ${totals.totalFlights}\n`;
    report += `Total Hours: ${totals.totalHours}\n\n`;

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

    report += '--- SPECIALTY OPERATIONS ---\n';
    report += `Longline/Sling Hours: ${totals.longlineHours}\n`;
    report += `Mountain Hours: ${totals.mountainHours}\n`;
    report += `Instructor Hours: ${totals.instructorHours}\n`;
    report += `Cross-Country Hours: ${totals.crosscountryHours}\n`;
    report += `Night Vision Hours: ${totals.nightVisionHours}\n`;
    report += `Instrument Hours: ${totals.instrumentHours}\n`;
    report += `Simulated Instrument Hours: ${totals.simulatedInstrumentHours}\n`;
    report += `Ground Instrument Hours: ${totals.groundInstrumentHours}\n\n`;

    // Add custom fields section if any exist
    if (Object.keys(totals.customFields).length > 0) {
      report += '--- CUSTOM SPECIALTY FIELDS ---\n';
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
