const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
class Element {
  constructor(value = '') { this.value = value; this.children = []; this.listeners = {}; this.disabled = false; this.textContent = ''; }
  addEventListener(name, fn) { this.listeners[name] = fn; }
  dispatch(name) { return this.listeners[name]?.({ preventDefault() {}, key: name === 'keydown' ? 'Enter' : '' }); }
  replaceChildren(...children) { this.children = children; }
  appendChild(child) { this.children.push(child); }
  setAttribute(name, value) { this[name] = value; }
}
const row = { icao: 'TEST', manufacturer: 'TEST ONLY Maker', model: 'Test Rotor', category: 'helicopter', engineCount: 2, engineType: 'turbine' };
const data = { source: { title: 'FAA test fixture', url: 'https://www.faa.gov/test-fixture', edition: 'TEST ONLY' }, aircraft: [row, { ...row, manufacturer: 'Alias Maker', model: 'Alias Rotor' }], total: 2 };
function environment(fetcher = async () => ({ ok: true, json: async () => data })) {
  const names = ['referenceSearch', 'referenceAll', 'referenceSearchBtn', 'referenceResults', 'referenceApply', 'referenceClear', 'referenceStatus', 'referenceSource', 'profileType', 'profileCategory', 'profileEngine', 'profileEngineModel', 'profilePowerplant', 'profileHelicopterClass'];
  const ids = Object.fromEntries(names.map(name => [name, new Element()]));
  ids.profileCategory.value = 'Helicopter'; ids.profileEngine.value = 'Single Engine';
  const calls = [];
  const context = { window: {}, document: { getElementById: id => ids[id], createElement: () => new Element() }, fetch: async (...args) => { calls.push(args); return fetcher(...args); } };
  const file = path.join(__dirname, '../src/public/js/aircraft-reference.js');
  if (fs.existsSync(file)) vm.runInNewContext(fs.readFileSync(file, 'utf8'), context);
  assert.equal(typeof context.window.AircraftReference, 'function', 'reference controller exists');
  const settings = { busy: false };
  return { picker: new context.window.AircraftReference(settings), ids, calls, settings };
}
test('search and native alias selection only preview; explicit Apply prefills editable draft without exact engine inference or writes', async () => {
  const { picker, ids, calls } = environment();
  ids.profileEngineModel.value = 'Installed engine entered manually';
  ids.profileHelicopterClass.value = 'Intermediate';
  ids.referenceSearch.value = 'Test';
  await picker.search();
  assert.match(calls[0][0], /q=Test.*category=helicopter/);
  assert.equal(ids.profileType.value, '');
  assert.equal(ids.referenceResults.children.length, 3);
  ids.referenceResults.value = '1'; ids.referenceResults.dispatch('change');
  assert.equal(ids.profileType.value, '', 'selecting an alias is preview, not overwrite');
  ids.referenceApply.dispatch('click');
  assert.equal(ids.profileType.value, 'Alias Rotor');
  assert.equal(ids.profileEngine.value, 'Multi Engine');
  assert.equal(ids.profileCategory.value, 'Helicopter');
  assert.equal(ids.profilePowerplant.value, 'Turbine');
  assert.equal(ids.profileHelicopterClass.value, 'Intermediate');
  assert.equal(ids.profileEngineModel.value, 'Installed engine entered manually');
  assert.equal(ids.profileType.disabled, false);
  assert.equal(ids.referenceSource.href, data.source.url);
  assert.ok(calls.every(([, options]) => !options?.method), 'no create/update request');
});

test('clearing reference cancels selection without changing an existing exact model; manual editing remains possible', async () => {
  const { picker, ids } = environment();
  ids.profileType.value = 'Existing Exact Variant';
  await picker.search();
  ids.referenceResults.value = '0'; ids.referenceResults.dispatch('change');
  assert.equal(ids.profileType.value, 'Existing Exact Variant');
  ids.referenceClear.dispatch('click');
  ids.referenceApply.dispatch('click');
  assert.equal(ids.profileType.value, 'Existing Exact Variant');
  assert.equal(ids.referenceApply.disabled, true);
  await picker.search();
  ids.referenceResults.value = '0'; ids.referenceResults.dispatch('change');
  ids.profileType.value = 'Manual exact variant'; ids.profileType.dispatch('input');
  ids.referenceApply.dispatch('click');
  assert.equal(ids.profileType.value, 'Manual exact variant');
});

test('delayed and superseded searches cannot restore cancelled suggestions or overwrite browser-restored/manual fields', async () => {
  const pending = [];
  const { picker, ids } = environment(() => new Promise(resolve => pending.push(resolve)));
  const first = picker.search();
  ids.profileType.value = 'Browser restored exact variant';
  picker.clear();
  pending.shift()({ ok: true, json: async () => data });
  await first;
  assert.equal(ids.referenceResults.children.length, 0);
  assert.equal(ids.profileType.value, 'Browser restored exact variant');
  const older = picker.search();
  ids.referenceSearch.value = 'new';
  const newer = picker.search();
  pending[1]({ ok: true, json: async () => ({ ...data, aircraft: [], total: 0 }) });
  await newer;
  pending[0]({ ok: true, json: async () => data });
  await older;
  assert.equal(ids.referenceResults.children.length, 1);
  assert.match(ids.referenceStatus.textContent, /No matches/);
});

test('reference errors leave manual draft intact and announce retry through Search', async () => {
  for (const fetcher of [async () => { throw new Error('offline'); }, async () => ({ ok: false, json: async () => ({ error: 'unavailable' }) }), async () => ({ ok: true, json: async () => ({}) })]) {
    const { picker, ids } = environment(fetcher);
    ids.profileType.value = 'Existing exact model';
    await picker.search();
    assert.equal(ids.profileType.value, 'Existing exact model');
    assert.match(ids.referenceStatus.textContent, /unavailable.*manual.*Search/i);
    assert.equal(ids.referenceApply.disabled, true);
  }
});

test('all-aircraft selection maps only supported category and known engine count, never truncates long model or guesses exact engine', async () => {
  const longRow = { ...row, model: 'Long model '.repeat(8), category: 'glider', engineCount: null };
  const { picker, ids } = environment(async () => ({ ok: true, json: async () => ({ ...data, aircraft: [longRow], total: 1 }) }));
  ids.referenceAll.checked = true;
  ids.profileEngine.value = 'Single Engine';
  await picker.search();
  ids.referenceResults.value = '0'; ids.referenceResults.dispatch('change');
  ids.referenceApply.dispatch('click');
  assert.equal(ids.profileType.value, 'TEST', 'long model uses full ICAO rather than truncating');
  assert.equal(ids.profileCategory.value, 'Helicopter', 'unsupported category is not misclassified');
  assert.equal(ids.profileEngine.value, 'Single Engine', 'unknown count does not guess');
  assert.equal(ids.profileEngineModel.value, '');
  assert.match(ids.referenceStatus.textContent, /category.*unchanged.*engine count.*unchanged/i);
});

test('search query/filter changes cancel stale selection, Enter searches without submitting profile', async () => {
  const { picker, ids, calls } = environment();
  await picker.search();
  ids.referenceResults.value = '0'; ids.referenceResults.dispatch('change');
  ids.referenceSearch.value = 'Manual query'; ids.referenceSearch.dispatch('input');
  ids.referenceApply.dispatch('click');
  assert.equal(ids.profileType.value, '');
  ids.referenceAll.checked = true; ids.referenceAll.dispatch('change');
  await ids.referenceSearch.dispatch('keydown');
  assert.match(calls.at(-1)[0], /category=all/);
  assert.equal(ids.profileType.value, '');
});
test('Settings renders labelled native controls, separate explicit replace action and nearby FAA provenance in shared themed layout', () => {
  const html = fs.readFileSync(path.join(__dirname, '../src/public/settings.html'), 'utf8');
  for (const id of ['referenceSearch', 'referenceResults']) assert.match(html, new RegExp('for="' + id + '"'));
  assert.match(html, /<select[^>]*id="referenceResults"/);
  assert.match(html, /id="referenceStatus"[^>]*role="status"/);
  assert.match(html, /id="referenceApply"[^>]*>Replace type, category, engine count &amp; powerplant in draft/);
  assert.match(html, /id="referenceSource"[^>]*href="https:\/\/www.faa.gov/);
  assert.ok(html.indexOf('/js/aircraft-reference.js') < html.indexOf('/js/aircraft-profile-settings.js'));
  const css = fs.readFileSync(path.join(__dirname, '../src/public/css/aircraft-profiles.css'), 'utf8');
  assert.match(css, /\.aircraft-reference/);
});

test('Clear announces no selection after Apply and never changes the applied/manual draft', async () => {
  const { picker, ids } = environment();
  await picker.search();
  ids.referenceResults.value = '0'; ids.referenceResults.dispatch('change');
  ids.referenceApply.dispatch('click');
  ids.referenceClear.dispatch('click');
  assert.equal(ids.profileType.value, 'Test Rotor');
  assert.match(ids.referenceStatus.textContent, /No reference selected/);
});

test('Apply maps only explicit turbine/piston engine types and never wake category to helicopter class', async () => {
  for (const engineType of ['turbine', 'piston', 'jet', 'electric', 'rocket', 'unknown', '', null, undefined]) {
    for (const wakeCategory of ['Light', 'Medium', 'Heavy', 'Super', null]) {
      const fixture = { ...row, engineType, wakeCategory };
      const { picker, ids } = environment(async () => ({ ok: true, json: async () => ({ ...data, aircraft: [fixture], total: 1 }) }));
      ids.profilePowerplant.value = engineType === 'piston' ? 'Turbine' : 'Piston';
      ids.profileHelicopterClass.value = 'Intermediate';
      ids.profileEngineModel.value = 'Exact installed model';
      await picker.search();
      ids.referenceResults.value = '0';
      picker.apply();
      assert.equal(ids.profilePowerplant.value, engineType === 'turbine' ? 'Turbine' : 'Piston');
      assert.equal(ids.profileHelicopterClass.value, 'Intermediate');
      assert.equal(ids.profileEngineModel.value, 'Exact installed model');
      assert.match(ids.referenceStatus.textContent, /helicopter class.*manual/i);
    }
  }
});

test('manual powerplant/class input cancels stale reference suggestions', async () => {
  for (const name of ['profilePowerplant', 'profileHelicopterClass']) {
    const { picker, ids } = environment();
    await picker.search(); ids.referenceResults.value = '0';
    ids[name].value = name === 'profilePowerplant' ? 'Piston' : 'Heavy';
    ids[name].dispatch('input');
    picker.apply();
    assert.equal(ids.profileType.value, '');
    assert.equal(ids.referenceApply.disabled, true);
  }
});
