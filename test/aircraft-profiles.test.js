const assert = require('assert');

module.exports = async function testAircraftProfiles({ api, expect, dbPath, todayStr }) {
  const profile = await expect(await api('POST', '/api/aircraft-profiles', {
    registration: ' c-gabc ', aircraft_type: 'AS350 B2', aircraft_category: 'Helicopter',
    powerplant_type: 'Turbine', helicopter_class: 'Intermediate', engine_type: 'Single Engine', engine_model: ' 2B ', nickname: 'Workhorse', operator: 'Test Air', favourite: true, is_default: true
  }), 201, 'create aircraft profile');
  assert.strictEqual(profile.registration, 'C-GABC');
  assert.strictEqual(profile.engine_model, '2B');
  assert.strictEqual(profile.powerplant_type, 'Turbine');
  assert.strictEqual(profile.helicopter_class, 'Intermediate');
  assert.strictEqual(profile.favourite, true);
  assert.strictEqual(profile.is_default, true);
  assert.strictEqual(profile.archived, false);
  assert.strictEqual(profile.last_used_at, null);
  const profiles = await expect(await api('GET', '/api/aircraft-profiles'), 200);
  assert.deepStrictEqual(profiles, [profile]);
  const second = await expect(await api('POST', '/api/aircraft-profiles', {
    registration: 'C-ZZZZ', aircraft_type: 'B206', favourite: true, is_default: true
  }), 201, 'second default replaces first');
  assert.strictEqual(second.engine_model, '');
  assert.strictEqual(second.powerplant_type, '');
  assert.strictEqual(second.helicopter_class, '');
  let all = await expect(await api('GET', '/api/aircraft-profiles'), 200);
  assert.deepStrictEqual(all.map(p => p.id), [second.id, profile.id]);
  assert.strictEqual(all.filter(p => p.is_default).length, 1);
  assert.strictEqual(all.filter(p => p.favourite).length, 2);
  await expect(await api('PUT', `/api/aircraft-profiles/${second.id}`, { archived: true }), 200);
  all = await expect(await api('GET', '/api/aircraft-profiles'), 200);
  assert.strictEqual(all.length, 1);
  all = await expect(await api('GET', '/api/aircraft-profiles?include_archived=true'), 200);
  assert.strictEqual(all.length, 2);
  assert.strictEqual(all.find(p => p.id === second.id).is_default, false);
  const restored = await expect(await api('PUT', `/api/aircraft-profiles/${second.id}`, {
    archived: false, is_default: true, nickname: 'Restored', favourite: false
  }), 200);
  assert.strictEqual(restored.archived, false);
  assert.strictEqual(restored.is_default, true);
  assert.strictEqual(restored.nickname, 'Restored');
  await expect(await api('POST', '/api/aircraft-profiles', { registration: ' c-gAbC ', aircraft_type: 'X', is_default: true }), 409);
  await expect(await api('PUT', `/api/aircraft-profiles/${second.id}`, { registration: 'c-gabc' }), 409);
  all = await expect(await api('GET', '/api/aircraft-profiles'), 200);
  assert.strictEqual(all.find(p => p.id === second.id).is_default, true, 'failed duplicate must not clear default');
  for (const invalid of [null, [], 'bad', {}, { registration: 42 }, { registration: {} }, { registration: ['X'] },
    { registration: '' }, { registration: 'x'.repeat(51) }, { aircraft_type: [] }, { aircraft_type: 'x'.repeat(51) },
    { aircraft_category: 'Jet' }, { engine_type: false }, { favourite: 1 }, { is_default: 'true' },
    { engine_model: null }, { engine_model: [] }, { engine_model: {} }, { engine_model: 42 }, { engine_model: true }, { engine_model: 'x'.repeat(101) }, { engine_model: 'bad\nmodel' }, { archived: {} }, { nickname: {} }, { operator: 'x'.repeat(101) }]) {
    const body = invalid && !Array.isArray(invalid) && typeof invalid === 'object' && Object.keys(invalid).length
      ? { registration: 'C-VALID', aircraft_type: 'AS350', ...invalid } : invalid;
    await expect(await api('POST', '/api/aircraft-profiles', body), 400, `invalid create ${JSON.stringify(invalid)}`);
  }
  for (const invalid of [{ aircraft_type: null }, { favourite: 'false' }, { registration: {} }, { nickname: [] }, { aircraft_category: [] }]) {
    await expect(await api('PUT', `/api/aircraft-profiles/${second.id}`, invalid), 400);
  }
  await expect(await api('PUT', '/api/aircraft-profiles/12x', {}), 400);
  await expect(await api('PUT', '/api/aircraft-profiles/999999', {}), 404);
  const flightBody = { date: todayStr, day_pic: 1, aircraft_type: 'FAKE', registration: 'FAKE', aircraft_category: 'Simulator', engine_type: 'Multi Engine', engine_model: 'Manual 2B1', powerplant_type: 'Piston', helicopter_class: 'Light' };
  const snapshotKeys = ['aircraft_type', 'registration', 'aircraft_category', 'engine_type', 'engine_model', 'powerplant_type', 'helicopter_class'];
  function assertSnapshot(flight, expected) {
    for (const key of snapshotKeys) assert.strictEqual(flight[key], expected[key], key);
  }
  const selected = await expect(await api('POST', '/api/flights', { ...flightBody, aircraft_profile_id: profile.id }), 201);
  assert.strictEqual(selected.aircraft_profile_id, profile.id);
  assertSnapshot(selected, profile);
  const selectedOnly = await expect(await api('POST', '/api/flights', { date: todayStr, day_pic: 1, aircraft_profile_id: second.id }), 201);
  assertSnapshot(selectedOnly, second);
  const list = await expect(await api('GET', '/api/flights'), 200);
  assert.strictEqual(list.flights.find(f => f.id === selected.id).aircraft_profile_id, profile.id);
  assert.strictEqual(list.flights.find(f => f.id === selected.id).engine_model, '2B');
  assert.strictEqual(list.flights.find(f => f.id === selected.id).powerplant_type, 'Turbine');
  assert.strictEqual(list.flights.find(f => f.id === selected.id).helicopter_class, 'Intermediate');
  const detail = await expect(await api('GET', `/api/flights/${selected.id}`), 200);
  assert.strictEqual(detail.aircraft_profile_id, profile.id);
  assertSnapshot(detail, profile);
  all = await expect(await api('GET', '/api/aircraft-profiles'), 200);
  assert.ok(all.find(p => p.id === profile.id).last_used_at);
  await expect(await api('PUT', `/api/aircraft-profiles/${profile.id}`, {
    aircraft_type: 'CHANGED', registration: 'C-NEW', aircraft_category: 'Aeroplane', engine_type: 'Multi Engine', engine_model: '2B1', powerplant_type: 'Piston', helicopter_class: 'Heavy'
  }), 200);
  let saved = await expect(await api('PUT', `/api/flights/${selected.id}`, { ...flightBody, aircraft_profile_id: profile.id, route: 'edited' }), 200);
  assertSnapshot(saved, profile);
  assert.strictEqual(saved.flight_details, 'edited');
  saved = await expect(await api('PUT', `/api/flights/${selected.id}`, flightBody), 200);
  assertSnapshot(saved, profile);
  assert.strictEqual(saved.aircraft_profile_id, profile.id, 'omitted association preserves snapshot');
  const changedProfile = (await expect(await api('GET', '/api/aircraft-profiles'), 200)).find(p => p.id === profile.id);
  const duplicate = await expect(await api('POST', '/api/flights', { ...detail, aircraft_profile_id: profile.id }), 201);
  assertSnapshot(duplicate, changedProfile);
  saved = await expect(await api('PUT', `/api/flights/${selected.id}`, { ...flightBody, aircraft_profile_id: second.id }), 200);
  assertSnapshot(saved, second);
  assert.strictEqual(saved.aircraft_profile_id, second.id);
  await expect(await api('PUT', `/api/aircraft-profiles/${second.id}`, { archived: true }), 200);
  assertSnapshot(await expect(await api('GET', `/api/flights/${selected.id}`), 200), second);
  saved = await expect(await api('PUT', `/api/flights/${selected.id}`, { ...flightBody, aircraft_profile_id: second.id }), 200);
  assertSnapshot(saved, second);
  await expect(await api('POST', '/api/flights', { ...flightBody, aircraft_profile_id: second.id }), 400);
  await expect(await api('PUT', `/api/flights/${duplicate.id}`, { ...flightBody, aircraft_profile_id: second.id }), 400);
  saved = await expect(await api('PUT', `/api/flights/${selected.id}`, { ...flightBody, aircraft_profile_id: null }), 200);
  assert.strictEqual(saved.aircraft_profile_id, null);
  assertSnapshot(saved, flightBody);
  const manual = await expect(await api('POST', '/api/flights', flightBody), 201);
  assert.strictEqual(manual.aircraft_profile_id, null);
  assert.strictEqual(manual.engine_model, 'Manual 2B1');
  const { engine_model: omittedModel, powerplant_type: omittedPowerplant, helicopter_class: omittedClass, ...legacyBody } = flightBody;
  for (const field of ['powerplant_type', 'helicopter_class']) {
    assert.strictEqual((await expect(await api('PUT', `/api/flights/${manual.id}`, legacyBody), 200))[field], flightBody[field]);
    assert.strictEqual((await expect(await api('PUT', `/api/aircraft-profiles/${profile.id}`, { nickname: 'Legacy update' }), 200))[field], changedProfile[field]);
    for (const invalid of [null, [], {}, true, 42, 'turbine', 'Unknown', 'Light/Medium']) {
      await expect(await api('POST', '/api/aircraft-profiles', { registration: 'C-BAD', aircraft_type: 'Bad', [field]: invalid }), 400);
      await expect(await api('PUT', `/api/aircraft-profiles/${profile.id}`, { [field]: invalid }), 400);
      await expect(await api('POST', '/api/flights', { ...flightBody, [field]: invalid }), 400);
      await expect(await api('PUT', `/api/flights/${manual.id}`, { ...flightBody, [field]: invalid }), 400);
    }
  }
  const legacyCreate = await expect(await api('POST', '/api/flights', legacyBody), 201);
  assert.strictEqual(legacyCreate.engine_model, '');
  assert.strictEqual(legacyCreate.powerplant_type, '');
  assert.strictEqual(legacyCreate.helicopter_class, '');
  const manualDuplicate = await expect(await api('POST', '/api/flights', { ...detail, aircraft_profile_id: null }), 201);
  assertSnapshot(manualDuplicate, profile);
  for (const helicopter_class of ['Light', 'Intermediate', 'Medium', 'Heavy', '']) {
    const powerplant_type = helicopter_class ? 'Turbine' : '';
    const updatedProfile = await expect(await api('PUT', `/api/aircraft-profiles/${profile.id}`, { helicopter_class, powerplant_type }), 200);
    const updatedManual = await expect(await api('PUT', `/api/flights/${manual.id}`, { ...legacyBody, helicopter_class, powerplant_type }), 200);
    assert.strictEqual(updatedProfile.helicopter_class, helicopter_class);
    assert.strictEqual(updatedProfile.powerplant_type, powerplant_type);
    assert.strictEqual(updatedManual.helicopter_class, helicopter_class);
    assert.strictEqual(updatedManual.powerplant_type, powerplant_type);
    assertSnapshot(await expect(await api('GET', `/api/flights/${manualDuplicate.id}`), 200), profile);
  }
  assert.strictEqual((await expect(await api('PUT', `/api/flights/${manual.id}`, legacyBody), 200)).engine_model, 'Manual 2B1');
  assert.strictEqual((await expect(await api('PUT', `/api/flights/${manual.id}`, { ...legacyBody, engine_model: ' 2B ' }), 200)).engine_model, '2B');
  for (const invalid of [null, [], {}, true, 42, 'x'.repeat(101), 'bad\nmodel']) {
    await expect(await api('POST', '/api/flights', { ...flightBody, engine_model: invalid }), 400);
    await expect(await api('PUT', `/api/flights/${manual.id}`, { ...flightBody, engine_model: invalid }), 400);
    await expect(await api('PUT', `/api/aircraft-profiles/${profile.id}`, { engine_model: invalid }), 400);
  }
  assert.strictEqual((await expect(await api('PUT', `/api/flights/${manual.id}`, { ...legacyBody, engine_model: '  ' }), 200)).engine_model, '');
  for (const id of ['1', 0, -1, {}, [], true, 1.5, 999999]) {
    await expect(await api('POST', '/api/flights', { ...flightBody, aircraft_profile_id: id }), 400);
    await expect(await api('PUT', `/api/flights/${manual.id}`, { ...flightBody, aircraft_profile_id: id }), 400);
  }
  // Use only this suite's throwaway DB for isolation/rollback fixtures.
  const Database = require('better-sqlite3');
  const db = new Database(dbPath);
  try {
    db.prepare("UPDATE aircraft_profiles SET last_used_at = '2000-01-01T00:00:00Z' WHERE id = ?").run(profile.id);
    await expect(await api('GET', '/api/aircraft-profiles'), 200);
    await expect(await api('GET', `/api/flights/${duplicate.id}`), 200);
    await expect(await api('POST', '/api/flights', { date: todayStr, aircraft_profile_id: profile.id }), 400);
    assert.strictEqual(db.prepare('SELECT last_used_at FROM aircraft_profiles WHERE id = ?').get(profile.id).last_used_at, '2000-01-01T00:00:00Z');
    const countBefore = db.prepare('SELECT COUNT(*) n FROM flights').get().n;
    const oldFlight = db.prepare('SELECT * FROM flights WHERE id = ?').get(duplicate.id);
    db.exec(`CREATE TRIGGER fail_profile_usage BEFORE UPDATE OF last_used_at ON aircraft_profiles
      BEGIN SELECT RAISE(ABORT, 'intentional usage failure'); END;`);
    await expect(await api('POST', '/api/flights', { ...flightBody, aircraft_profile_id: profile.id }), 500);
    await expect(await api('PUT', `/api/flights/${duplicate.id}`, { ...flightBody, day_pic: 3, aircraft_profile_id: profile.id }), 500);
    assert.strictEqual(db.prepare('SELECT COUNT(*) n FROM flights').get().n, countBefore);
    assert.deepStrictEqual(db.prepare('SELECT * FROM flights WHERE id = ?').get(duplicate.id), oldFlight);
    db.exec('DROP TRIGGER fail_profile_usage');
    const orderProfiles = [];
    for (const data of [
      { registration: 'C-AAAA', aircraft_type: 'Sort' },
      { registration: 'C-BBBB', aircraft_type: 'Sort' },
      { registration: 'C-DDDD', aircraft_type: 'Sort', is_default: true },
      { registration: 'C-YYYY', aircraft_type: 'Sort', favourite: true }
    ]) {
      orderProfiles.push(await expect(await api('POST', '/api/aircraft-profiles', data), 201));
    }
    db.prepare("UPDATE aircraft_profiles SET last_used_at = '2020-01-01T00:00:00Z' WHERE id = ?").run(orderProfiles[1].id);
    db.prepare("UPDATE aircraft_profiles SET last_used_at = '2025-01-01T00:00:00Z' WHERE id = ?").run(orderProfiles[3].id);
    const ordered = await expect(await api('GET', '/api/aircraft-profiles'), 200);
    assert.deepStrictEqual(ordered.map(p => p.id), [orderProfiles[2].id, orderProfiles[3].id, profile.id, orderProfiles[1].id, orderProfiles[0].id]);
    await expect(await api('POST', '/api/aircraft-profiles', { registration: 'c-zzzz', aircraft_type: 'Reserved' }), 409);
    db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run('other', require('bcrypt').hashSync('other-password', 4));
  } finally { db.close(); }
  await expect(await api('POST', '/api/auth/logout'), 200);
  for (const [method, url, body] of [
    ['GET', '/api/aircraft-profiles'], ['POST', '/api/aircraft-profiles', {}],
    ['PUT', `/api/aircraft-profiles/${profile.id}`, {}], ['POST', '/api/flights', flightBody]
  ]) await expect(await api(method, url, body), 401);
  await expect(await api('POST', '/api/auth/login', { username: 'other', password: 'other-password' }), 200);
  assert.deepStrictEqual(await expect(await api('GET', '/api/aircraft-profiles?include_archived=true'), 200), []);
  await expect(await api('PUT', `/api/aircraft-profiles/${profile.id}`, { favourite: false }), 404);
  await expect(await api('POST', '/api/flights', { ...flightBody, aircraft_profile_id: profile.id }), 400);
  const otherFlight = await expect(await api('POST', '/api/flights', flightBody), 201);
  await expect(await api('PUT', `/api/flights/${otherFlight.id}`, { ...flightBody, aircraft_profile_id: profile.id }), 400);
  await expect(await api('PUT', `/api/flights/${duplicate.id}`, { ...flightBody, aircraft_profile_id: profile.id }), 404);
  await expect(await api('GET', `/api/flights/${duplicate.id}`), 404);
  const otherProfile = await expect(await api('POST', '/api/aircraft-profiles', {
    registration: changedProfile.registration.toLowerCase(), aircraft_type: 'Other', is_default: true
  }), 201);
  assert.strictEqual(otherProfile.registration, changedProfile.registration);
  console.log('Aircraft profile management, snapshots, auth/isolation and rollback tests passed');
};
