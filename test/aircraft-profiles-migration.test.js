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
        registration TEXT, aircraft_category TEXT, engine_type TEXT, flight_time_hours REAL);
      INSERT INTO flights VALUES (1, 1, '2020-01-02', 'Original Type', 'c-old', 'Helicopter', 'Single Engine', 1.25);
    `);
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
      assert.strictEqual(migrated.aircraft_profile_id, null);
      assert.strictEqual(db.prepare('SELECT COUNT(*) n FROM flights').get().n, 1);
      assert.strictEqual(db.prepare('SELECT COUNT(*) n FROM aircraft_profiles').get().n, 0);
      assert.strictEqual(db.prepare('SELECT COUNT(*) n FROM aircraft_types').get().n, 0);
      assert.strictEqual(db.pragma('foreign_key_check').length, 0);
      db.close();
    }
    console.log('Aircraft profile additive/idempotent migration tests passed');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
};
