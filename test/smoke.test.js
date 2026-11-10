/**
 * Smoke test: boots the server against a throwaway database and exercises
 * the main API paths end-to-end. Run with `npm test`.
 */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

const PORT = 3999;
const BASE = `http://127.0.0.1:${PORT}`;
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'logbook-test-'));
const dbPath = path.join(tmpDir, 'test.db');

const child = spawn(process.execPath, [path.join(__dirname, '..', 'src', 'server.js')], {
  env: {
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(PORT),
    DB_PATH: dbPath,
    SESSION_SECRET: 'test-secret-not-for-production',
    ADMIN_USERNAME: 'tester',
    ADMIN_PASSWORD: 'password123',
    TRUST_PROXY: 'false'
  },
  stdio: ['ignore', 'pipe', 'pipe']
});
let serverLog = '';
child.stdout.on('data', d => { serverLog += d; });
child.stderr.on('data', d => { serverLog += d; });

let cookie = '';
async function api(method, url, body, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (cookie) headers.Cookie = cookie;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(BASE + url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined, redirect: 'manual' });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  return res;
}

// Assert status and return the parsed body (text consumed exactly once)
async function expect(res, status, label) {
  const text = await res.text();
  assert.strictEqual(res.status, status, `${label || ''} expected ${status} got ${res.status}: ${text.slice(0, 300)}`);
  try { return JSON.parse(text); } catch (e) { return text; }
}

async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(BASE + '/healthz');
      if (r.ok) return;
    } catch (e) { /* retry */ }
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('Server did not start:\n' + serverLog);
}

const today = new Date();
const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

(async () => {
  await waitForServer();

  // Unauthenticated: pages redirect, API 401s, static assets fine
  let r = await api('GET', '/flights.html');
  assert.strictEqual(r.status, 302, 'html pages must not be served unauthenticated');
  r = await api('GET', '/');
  assert.strictEqual(r.status, 302);
  r = await api('GET', '/login.html');
  assert.strictEqual(r.status, 200);
  r = await api('GET', '/css/styles.css');
  assert.strictEqual(r.status, 200);
  r = await api('GET', '/api/flights');
  assert.strictEqual(r.status, 401);
  r = await api('GET', '/api/nope');
  assert.strictEqual(r.status, 404);
  assert.strictEqual((await r.json()).error, 'Not found');

  // Login
  r = await api('POST', '/api/auth/login', { username: 'tester', password: 'wrong' });
  assert.strictEqual(r.status, 401);
  r = await api('POST', '/api/auth/login', { username: 'tester', password: 'password123' });
  assert.strictEqual(r.status, 200);
  assert.ok(cookie.startsWith('logbook.sid='), 'session cookie set');
  r = await api('GET', '/api/auth/me');
  assert.deepStrictEqual(await r.json(), { authenticated: true, username: 'tester' });
  r = await api('GET', '/flights.html');
  assert.strictEqual(r.status, 200);
  const csp = r.headers.get('content-security-policy') || '';
  assert.ok(csp.includes("script-src-attr 'unsafe-inline'"), 'CSP must allow inline onclick handlers: ' + csp);
  assert.ok(csp.includes('https://cdn.jsdelivr.net'), 'CSP must allow Chart.js CDN');
  r = await api('GET', '/login.html');
  assert.strictEqual(r.status, 302, 'login page redirects when already signed in');

  // Aircraft + custom field setup
  r = await api('POST', '/api/aircraft', { name: 'AS350 B2' });
  assert.strictEqual(r.status, 201, await r.clone().text());
  r = await api('POST', '/api/custom-fields', { field_name: 'longline_hours', field_label: 'Longline' });
  const customField = await expect(r, 201);


  // Validation
  r = await api('POST', '/api/flights', { date: todayStr, aircraft_type: 'AS350 B2' });
  assert.strictEqual(r.status, 400, 'zero hours rejected');
  r = await api('POST', '/api/flights', { date: '2099-01-01', aircraft_type: 'AS350 B2', day_pic: 1 });
  assert.strictEqual(r.status, 400, 'future date rejected');
  r = await api('POST', '/api/flights', { date: '2026-02-30', aircraft_type: 'AS350 B2', day_pic: 1 });
  assert.strictEqual(r.status, 400, 'invalid calendar date rejected');
  r = await api('POST', '/api/flights', { date: todayStr, aircraft_type: 'AS350 B2', day_pic: -1, night_pic: 2 });
  assert.strictEqual(r.status, 400, 'negative hours rejected');
  r = await api('POST', '/api/flights', { date: todayStr, aircraft_type: 'AS350 B2', day_pic: 30 });
  assert.strictEqual(r.status, 400, '>24h single entry rejected');

  // Create
  r = await api('POST', '/api/flights', {
    date: todayStr, aircraft_type: 'AS350 B2', registration: 'C-GXYZ', pic: 'Self',
    route: 'YYD, "Hudson Bay Mtn", YYD', departure: 'cyyd', arrival: 'CYYD',
    day_pic: 1.5, night_pic: 0.2, takeoffs_day: 3, landings_day: 3,
    custom_fields: [{ field_id: customField.id, value: 0.8 }, { field_id: 99999, value: 5 }]
  });
  const flight = await expect(r, 201);

  assert.strictEqual(flight.flight_time_hours, 1.7);
  assert.strictEqual(flight.departure, 'CYYD');

  r = await api('GET', `/api/flights/${flight.id}`);
  const detail = await r.json();
  assert.strictEqual(detail.custom_fields.length, 1, 'custom field belonging to another user/nonexistent is ignored');
  assert.strictEqual(detail.custom_fields[0].value, 0.8);

  // Update
  r = await api('PUT', `/api/flights/${flight.id}`, { ...detail, day_pic: 2, night_pic: 0, custom_fields: [{ field_id: customField.id, value: 1.1 }] });
  const updated = await expect(r, 200);
  assert.strictEqual(updated.flight_time_hours, 2);
  r = await api('PUT', '/api/flights/999999', { date: todayStr, aircraft_type: 'X', day_pic: 1 });
  assert.strictEqual(r.status, 404);

  // Stats
  r = await api('GET', '/api/flights/stats/summary');
  const stats = await r.json();
  assert.strictEqual(stats.totalHours, 2);
  assert.strictEqual(stats.totalFlights, 1);
  assert.strictEqual(stats.customFieldTotals[0].total_hours, 1.1);

  // CSV export escaping
  r = await api('GET', '/api/flights/export/csv');
  assert.strictEqual(r.status, 200);
  const csv = await r.text();
  assert.ok(csv.includes('"YYD, ""Hudson Bay Mtn"", YYD"'), 'quotes/commas escaped: ' + csv);
  assert.strictEqual(csv.trim().split('\n').length, 2);

  // PDF + summary exports respond
  r = await api('GET', '/api/flights/export/pdf');
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.headers.get('content-type'), 'application/pdf');
  r = await api('GET', '/api/flights/export/summary');
  assert.strictEqual(r.status, 200);

  // Backup download is a valid SQLite file
  r = await api('GET', '/api/backup/db');
  assert.strictEqual(r.status, 200);
  const buf = Buffer.from(await r.arrayBuffer());
  assert.strictEqual(buf.subarray(0, 15).toString(), 'SQLite format 3');

  // Change password
  r = await api('POST', '/api/auth/change-password', { currentPassword: 'nope', newPassword: 'newpassword1' });
  assert.strictEqual(r.status, 401);
  r = await api('POST', '/api/auth/change-password', { currentPassword: 'password123', newPassword: 'short' });
  assert.strictEqual(r.status, 400);
  r = await api('POST', '/api/auth/change-password', { currentPassword: 'password123', newPassword: 'newpassword1' });
  assert.strictEqual(r.status, 200, await r.clone().text());

  // Session persists in SQLite
  const Database = require('better-sqlite3');
  const db = new Database(dbPath, { readonly: true });
  assert.strictEqual(db.prepare('SELECT COUNT(*) n FROM sessions').get().n, 1);
  assert.strictEqual(db.pragma('journal_mode', { simple: true }), 'wal');
  db.close();

  // Logout
  r = await api('POST', '/api/auth/logout');
  assert.strictEqual(r.status, 200);
  cookie = '';
  r = await api('POST', '/api/auth/login', { username: 'tester', password: 'newpassword1' });
  assert.strictEqual(r.status, 200, 'new password works');

  // Delete
  r = await api('DELETE', `/api/flights/${flight.id}`);
  assert.strictEqual(r.status, 200);

  console.log('All smoke tests passed');
  child.kill('SIGTERM');
  await new Promise(r => child.on('exit', r));
  fs.rmSync(tmpDir, { recursive: true, force: true });
  process.exit(0);
})().catch(err => {
  console.error('TEST FAILED:', err.message);
  console.error('--- server log ---\n' + serverLog);
  child.kill('SIGKILL');
  fs.rmSync(tmpDir, { recursive: true, force: true });
  process.exit(1);
});
