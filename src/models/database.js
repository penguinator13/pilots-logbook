const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/logbook.db');
const dbDir = path.dirname(dbPath);

// Ensure data directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

// Pragmas: WAL gives crash-safe, concurrent-friendly writes; busy_timeout
// avoids SQLITE_BUSY if a backup/vacuum overlaps a request.
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('busy_timeout = 5000');
db.pragma('foreign_keys = ON');

/**
 * Add a column if it does not already exist (idempotent migration helper).
 */
function addColumnIfMissing(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!cols.includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

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

  // Migrate existing tables (add columns introduced after v1.0)
  const flightMigrations = [
    ['longline_hours', 'REAL DEFAULT 0'],
    ['mountain_hours', 'REAL DEFAULT 0'],
    ['instructor_hours', 'REAL DEFAULT 0'],
    ['crosscountry_hours', 'REAL DEFAULT 0'],
    ['night_vision_hours', 'REAL DEFAULT 0'],
    ['instrument_hours', 'REAL DEFAULT 0'],
    ['simulated_instrument_hours', 'REAL DEFAULT 0'],
    ['aircraft_category', "TEXT DEFAULT 'Helicopter'"],
    ['ground_instrument_hours', 'REAL DEFAULT 0'],
    ['engine_type', "TEXT DEFAULT 'Single Engine'"],
    ['day_pic', 'REAL DEFAULT 0'],
    ['night_pic', 'REAL DEFAULT 0'],
    ['day_dual', 'REAL DEFAULT 0'],
    ['night_dual', 'REAL DEFAULT 0'],
    ['day_sic', 'REAL DEFAULT 0'],
    ['night_sic', 'REAL DEFAULT 0'],
    ['day_cmnd_practice', 'REAL DEFAULT 0'],
    ['night_cmnd_practice', 'REAL DEFAULT 0'],
    ['departure', "TEXT DEFAULT ''"],
    ['arrival', "TEXT DEFAULT ''"]
  ];
  for (const [column, definition] of flightMigrations) {
    addColumnIfMissing('flights', column, definition);
  }

  // Individual aircraft are separate from the legacy saved type names.
  db.exec(`
    CREATE TABLE IF NOT EXISTS aircraft_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      registration TEXT NOT NULL COLLATE NOCASE,
      aircraft_type TEXT NOT NULL,
      aircraft_category TEXT NOT NULL DEFAULT 'Helicopter' CHECK(aircraft_category IN ('Helicopter', 'Aeroplane', 'Simulator')),
      engine_type TEXT NOT NULL DEFAULT 'Single Engine' CHECK(engine_type IN ('Single Engine', 'Multi Engine')),
      nickname TEXT NOT NULL DEFAULT '',
      operator TEXT NOT NULL DEFAULT '',
      favourite INTEGER NOT NULL DEFAULT 0 CHECK(favourite IN (0, 1)),
      is_default INTEGER NOT NULL DEFAULT 0 CHECK(is_default IN (0, 1)),
      archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0, 1)),
      last_used_at TEXT,
      UNIQUE(user_id, registration),
      CHECK(archived = 0 OR is_default = 0)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_aircraft_profiles_default
      ON aircraft_profiles(user_id) WHERE is_default = 1;
  `);

  addColumnIfMissing('flights', 'aircraft_profile_id', 'INTEGER REFERENCES aircraft_profiles(id)');

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

  // Create tags table for quick-insert tags on flight details
  db.exec(`
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, name),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Create user_preferences table for dashboard settings
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_preferences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      dashboard_config TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Persistent login sessions (survive server restarts)
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      sid TEXT PRIMARY KEY,
      sess TEXT NOT NULL,
      expires INTEGER NOT NULL
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires)`);

  // Indexes
  db.exec(`CREATE INDEX IF NOT EXISTS idx_flights_date ON flights(date DESC)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_flights_aircraft ON flights(aircraft_type)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_flights_user_date ON flights(user_id, date DESC)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_cfv_flight ON custom_field_values(flight_id)`);

  // Check if default user exists
  const userCheck = db.prepare('SELECT COUNT(*) as count FROM users').get();

  if (userCheck.count === 0) {
    // Create default user from environment variables. If no password was
    // supplied, generate one and print it once rather than shipping "changeme".
    const defaultUsername = process.env.ADMIN_USERNAME || 'admin';
    let defaultPassword = process.env.ADMIN_PASSWORD;
    let generated = false;
    if (!defaultPassword) {
      defaultPassword = crypto.randomBytes(9).toString('base64url');
      generated = true;
    }
    const hashedPassword = bcrypt.hashSync(defaultPassword, 10);

    db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run(defaultUsername, hashedPassword);
    console.log(`Default user created: ${defaultUsername}`);
    if (generated) {
      console.log(`Generated initial password for ${defaultUsername}: ${defaultPassword}`);
      console.log('Change it under Settings > Account after first login.');
    }
  }
}

// Initialize on module load
initializeDatabase();

module.exports = db;
