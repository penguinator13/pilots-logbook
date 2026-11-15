const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const Database = require('better-sqlite3');

module.exports = function testAircraftProfileMigration() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'logbook-migration-'));
  const dbPath = path.join(dir, 'legacy.db');
  try {
    const legacy = new Database(dbPath);
    legacy.exec(`
      CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL);
      INSERT INTO users VALUES (1, 'legacy', 'not-a-real-password');
      CREATE TABLE flights (id INTEGER PRIMARY KEY, user_id INTEGER, date TEXT, aircraft_type TEXT,
        registration TEXT, aircraft_category TEXT, engine_type TEXT, flight_time_hours REAL, aircraft_profile_id INTEGER);
      INSERT INTO flights VALUES (1, 1, '2020-01-02', 'Original Type', 'c-old', 'Helicopter', 'Single Engine', 1.25, 7);
    `);
    legacy.exec(`CREATE TABLE aircraft_profiles (
      id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id),
      registration TEXT NOT NULL, aircraft_type TEXT NOT NULL, aircraft_category TEXT DEFAULT 'Helicopter',
      engine_type TEXT DEFAULT 'Single Engine', nickname TEXT DEFAULT '', operator TEXT DEFAULT '',
      favourite INTEGER DEFAULT 0, is_default INTEGER DEFAULT 0, archived INTEGER DEFAULT 0, last_used_at TEXT);
      INSERT INTO aircraft_profiles (id, user_id, registration, aircraft_type, nickname, last_used_at)
        VALUES (7, 1, 'C-OLD', 'AS350B3', 'Historical', '2020-01-01');`);
    const originalProfile = legacy.prepare('SELECT * FROM aircraft_profiles ORDER BY id').all();
    const original = legacy.prepare('SELECT * FROM flights').get();
    legacy.close();
    for (let run = 0; run < 2; run++) {
      const result = spawnSync(process.execPath, ['-e', "require('./src/models/database').close()"], {
        cwd: path.join(__dirname, '..'), env: { ...process.env, DB_PATH: dbPath }, encoding: 'utf8'
      });
      assert.strictEqual(result.status, 0, result.stderr);
      const db = new Database(dbPath, { readonly: true });
      const migrated = db.prepare('SELECT * FROM flights').get();
      for (const [field, value] of Object.entries(original)) assert.strictEqual(migrated[field], value);
      assert.strictEqual(migrated.aircraft_profile_id, 7);
      assert.strictEqual(db.prepare('SELECT COUNT(*) n FROM flights').get().n, 1);
      assert.strictEqual(migrated.engine_model, '', 'historical flights remain unknown');
      const migratedProfiles = db.prepare('SELECT * FROM aircraft_profiles ORDER BY id').all();
      assert.strictEqual(migratedProfiles[0].engine_model, '');
      assert.deepStrictEqual(migratedProfiles.map(({ engine_model, ...old }) => old), originalProfile);
      assert.strictEqual(db.prepare('SELECT COUNT(*) n FROM aircraft_profiles').get().n, 1);
      assert.strictEqual(db.prepare('SELECT COUNT(*) n FROM aircraft_types').get().n, 0);
      assert.strictEqual(db.pragma('foreign_key_check').length, 0);
      db.close();
    }
    console.log('Aircraft profile additive/idempotent migration tests passed');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
};
