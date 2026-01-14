const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/logbook.db');
const dbDir = path.dirname(dbPath);

// Ensure data directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize database schema
function initializeDatabase() {
  // Create users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create flights table
  db.exec(`
    CREATE TABLE IF NOT EXISTS flights (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      date DATE NOT NULL,
      aircraft_type TEXT NOT NULL,
      registration TEXT,
      pilot_in_command TEXT,
      copilot_student TEXT,
      flight_details TEXT,
      flight_time_hours REAL NOT NULL,
      day_hours REAL DEFAULT 0,
      night_hours REAL DEFAULT 0,
      longline_sling INTEGER DEFAULT 0,
      mountain INTEGER DEFAULT 0,
      instructor INTEGER DEFAULT 0,
      longline_hours REAL DEFAULT 0,
      mountain_hours REAL DEFAULT 0,
      instructor_hours REAL DEFAULT 0,
      takeoffs_day INTEGER DEFAULT 0,
      takeoffs_night INTEGER DEFAULT 0,
      landings_day INTEGER DEFAULT 0,
      landings_night INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Migrate existing table if needed (add new columns)
  try {
    db.exec(`ALTER TABLE flights ADD COLUMN longline_hours REAL DEFAULT 0`);
  } catch (e) {
    // Column already exists
  }
  try {
    db.exec(`ALTER TABLE flights ADD COLUMN mountain_hours REAL DEFAULT 0`);
  } catch (e) {
    // Column already exists
  }
  try {
    db.exec(`ALTER TABLE flights ADD COLUMN instructor_hours REAL DEFAULT 0`);
  } catch (e) {
    // Column already exists
  }
  try {
    db.exec(`ALTER TABLE flights ADD COLUMN crosscountry_hours REAL DEFAULT 0`);
  } catch (e) {
    // Column already exists
  }
  try {
    db.exec(`ALTER TABLE flights ADD COLUMN night_vision_hours REAL DEFAULT 0`);
  } catch (e) {
    // Column already exists
  }
  try {
    db.exec(`ALTER TABLE flights ADD COLUMN instrument_hours REAL DEFAULT 0`);
  } catch (e) {
    // Column already exists
  }
  try {
    db.exec(`ALTER TABLE flights ADD COLUMN simulated_instrument_hours REAL DEFAULT 0`);
  } catch (e) {
    // Column already exists
  }
  try {
    db.exec(`ALTER TABLE flights ADD COLUMN aircraft_category TEXT DEFAULT 'Helicopter'`);
  } catch (e) {
    // Column already exists
  }
  try {
    db.exec(`ALTER TABLE flights ADD COLUMN ground_instrument_hours REAL DEFAULT 0`);
  } catch (e) {
    // Column already exists
  }
  try {
    db.exec(`ALTER TABLE flights ADD COLUMN engine_type TEXT DEFAULT 'Single Engine'`);
  } catch (e) {
    // Column already exists
  }

  // Add new flight time breakdown fields
  try {
    db.exec(`ALTER TABLE flights ADD COLUMN day_pic REAL DEFAULT 0`);
  } catch (e) {
    // Column already exists
  }
  try {
    db.exec(`ALTER TABLE flights ADD COLUMN night_pic REAL DEFAULT 0`);
  } catch (e) {
    // Column already exists
  }
  try {
    db.exec(`ALTER TABLE flights ADD COLUMN day_dual REAL DEFAULT 0`);
  } catch (e) {
    // Column already exists
  }
  try {
    db.exec(`ALTER TABLE flights ADD COLUMN night_dual REAL DEFAULT 0`);
  } catch (e) {
    // Column already exists
  }
  try {
    db.exec(`ALTER TABLE flights ADD COLUMN day_sic REAL DEFAULT 0`);
  } catch (e) {
    // Column already exists
  }
  try {
    db.exec(`ALTER TABLE flights ADD COLUMN night_sic REAL DEFAULT 0`);
  } catch (e) {
    // Column already exists
  }
  try {
    db.exec(`ALTER TABLE flights ADD COLUMN day_cmnd_practice REAL DEFAULT 0`);
  } catch (e) {
    // Column already exists
  }
  try {
    db.exec(`ALTER TABLE flights ADD COLUMN night_cmnd_practice REAL DEFAULT 0`);
  } catch (e) {
    // Column already exists
  }

  // Create aircraft_types table for managing saved aircraft
  db.exec(`
    CREATE TABLE IF NOT EXISTS aircraft_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, name),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Create custom_fields table for user-defined fields
  db.exec(`
    CREATE TABLE IF NOT EXISTS custom_fields (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      field_name TEXT NOT NULL,
      field_label TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, field_name),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Create custom_field_values table to store values for custom fields
  db.exec(`
    CREATE TABLE IF NOT EXISTS custom_field_values (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      flight_id INTEGER NOT NULL,
      field_id INTEGER NOT NULL,
      value REAL DEFAULT 0,
      UNIQUE(flight_id, field_id),
      FOREIGN KEY (flight_id) REFERENCES flights(id) ON DELETE CASCADE,
      FOREIGN KEY (field_id) REFERENCES custom_fields(id) ON DELETE CASCADE
    )
  `);

  // Create index on date for faster sorting
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_flights_date ON flights(date DESC)
  `);

  // Create index on aircraft_type for filtering
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_flights_aircraft ON flights(aircraft_type)
  `);

  // Check if default user exists
  const userCheck = db.prepare('SELECT COUNT(*) as count FROM users').get();

  if (userCheck.count === 0) {
    // Create default user from environment variables
    const defaultUsername = process.env.ADMIN_USERNAME || 'admin';
    const defaultPassword = process.env.ADMIN_PASSWORD || 'changeme';
    const hashedPassword = bcrypt.hashSync(defaultPassword, 10);

    db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run(defaultUsername, hashedPassword);
    console.log(`Default user created: ${defaultUsername}`);
  }
}

// Initialize on module load
initializeDatabase();

module.exports = db;
