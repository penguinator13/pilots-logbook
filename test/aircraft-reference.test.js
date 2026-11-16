const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
// Deliberately synthetic test fixture, never shipped as a production catalogue.
const fixture = { source: { title: 'TEST ONLY', url: 'https://www.faa.gov/test-fixture' }, aircraft: [
  { icao: 'TEST', manufacturer: 'Test Alpha', model: 'Rotor One', category: 'helicopter', engineCount: 1, engineType: 'turbine' },
  { icao: 'TEST', manufacturer: 'Test Beta', model: 'Rotor Alias', category: 'helicopter', engineCount: 2, engineType: 'turbine' },
  { icao: 'FAKE', manufacturer: 'Test Wing', model: 'Plane', category: 'fixed-wing', engineCount: 2, engineType: 'piston' }
] };
async function withApi(run, catalogue = fixture) {
  const app = express();
  app.use((req, res, next) => { req.session = req.headers.authorization ? { userId: 1 } : {}; next(); });
  const file = path.join(__dirname, '../src/routes/aircraft-reference.js');
  if (fs.existsSync(file)) app.use('/api/aircraft-reference', require(file)(() => catalogue));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const get = (query = '', authenticated = true) => fetch(`http://127.0.0.1:${server.address().port}/api/aircraft-reference${query}`, { headers: authenticated ? { Authorization: 'test' } : {} });
  try { await run(get); } finally { await new Promise(resolve => server.close(resolve)); }
}
test('reference search requires authentication', async () => {
  await withApi(async get => assert.equal((await get('', false)).status, 401));
});
test('local search defaults to helicopters, retains distinct aliases and searches each reference field', async () => {
  await withApi(async get => {
    const defaults = await (await get()).json();
    assert.equal(defaults.aircraft.length, 2);
    assert.equal(defaults.total, 2);
    assert.deepEqual(defaults.source, fixture.source);
    for (const query of ['test', 'alpha', 'rotor one']) {
      const result = await (await get(`?q=${encodeURIComponent(query)}`)).json();
      assert.ok(result.aircraft.some(row => row.manufacturer === 'Test Alpha'));
    }
    assert.equal((await (await get('?category=all&q=plane')).json()).aircraft[0].icao, 'FAKE');
    assert.equal((await (await get('?q=not-found')).json()).total, 0);
  });
});

test('reference rejects malformed queries, bounds results and reports unavailable local data', async () => {
  await withApi(async get => {
    for (const query of ['?category=unknown', '?q[x]=bad', '?q=' + 'x'.repeat(101)]) {
      assert.equal((await get(query)).status, 400);
    }
  });
  await withApi(async get => {
    const result = await (await get()).json();
    assert.equal(result.total, 150);
    assert.equal(result.aircraft.length, 100);
  }, { ...fixture, aircraft: Array.from({ length: 150 }, () => fixture.aircraft[0]) });
  await withApi(async get => assert.equal((await get()).status, 503), null);
});

test('real FAA models match compact H125/AS350 queries without altering source aliases', async () => {
  const catalogue = require('../src/data/aircraft-types.json');
  await withApi(async get => {
    for (const [query, expectedModel] of [['H125', 'H-125'], ['AS350', 'AS-350']]) {
      const response = await get('?q=' + query);
      assert.equal(response.status, 200);
      const result = await response.json();
      assert.ok(result.aircraft.some(row => row.model.includes(expectedModel)), query + ' finds hyphenated FAA aliases');
      for (const row of result.aircraft) assert.ok(catalogue.aircraft.some(original => JSON.stringify(original) === JSON.stringify(row)), 'source row unchanged');
    }
  }, catalogue);
});

test('bundled catalogue is trackable and explicitly included in container context, unlike private runtime data', () => {
  const root = path.join(__dirname, '..');
  assert.ok(fs.existsSync(path.join(root, 'src/data/aircraft-types.json')), 'real catalogue present (also in Docker test target)');
  // Ignore files are not copied into Docker's test stage; inclusion is tested there by loading the real catalogue above.
  for (const ignore of ['.gitignore', '.dockerignore']) {
    const file = path.join(root, ignore);
    if (fs.existsSync(file)) assert.match(fs.readFileSync(file, 'utf8'), /!src\/data\/aircraft-types\.json/);
  }
});
