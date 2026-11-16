const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = path.join(__dirname, '../src/public/js/aircraft-profiles.js');
function helpers() {
    const context = { window: {} };
    vm.runInNewContext(fs.existsSync(source) ? fs.readFileSync(source, 'utf8') : '', context);
    return context.window.AircraftProfiles || {};
}
test('profile grouping uses server favourites/recent dates, active only, searchable labels', () => {
    const { groupedProfiles, profileLabel } = helpers();
    assert.equal(typeof groupedProfiles, 'function', 'grouping helper exists');
    const profiles = [
        { id: 1, registration: 'C-AAA', aircraft_type: 'R44', engine_model: '2B1', favourite: true },
        { id: 2, registration: 'C-BBB', aircraft_type: 'H125', last_used_at: '2026-01-01' },
        { id: 3, registration: 'C-CCC', aircraft_type: 'R22', archived: true },
        { id: 4, registration: 'C-DDD', aircraft_type: 'H125', last_used_at: '2026-02-01', nickname: '<script>', operator: 'Rescue' },
        { id: 5, registration: 'C-EEE', aircraft_type: 'B206' }
    ];
    const groups = groupedProfiles(profiles, '');
    assert.equal(JSON.stringify(groups.map(group => [group.label, group.profiles.map(p => p.id)])), JSON.stringify([['Favourites', [1]], ['Recently used', [4, 2]], ['Other aircraft', [5]]]));
    assert.equal(groupedProfiles(profiles, 'rescue')[0].profiles[0].id, 4);
    assert.match(profileLabel(profiles[0]), /C-AAA.*R44.*2B1/);
    assert.equal(groupedProfiles(profiles, '2b1')[0].profiles[0].id, 1);
});

test('saved flight policy retains edit snapshots and detaches unsafe duplicate associations', () => {
    const { savedSelection, chooseProfile } = helpers();
    assert.equal(typeof savedSelection, 'function', 'saved flight policy exists');
    const flight = { aircraft_profile_id: 7, registration: 'C-OLD', aircraft_type: 'R44', aircraft_category: 'Helicopter', engine_type: 'Single Engine' };
    const same = { ...flight, id: 7, archived: false };
    for (const profiles of [null, [], [{ ...same, registration: 'C-NEW' }], [{ ...same, archived: true }]]) {
        const edit = savedSelection(flight, 'edit', profiles);
        assert.equal(edit.id, 7);
        assert.equal(edit.details.registration, 'C-OLD');
        assert.equal(edit.saved, true);
        const duplicate = savedSelection(flight, 'duplicate', profiles);
        assert.equal(duplicate.id, null);
        assert.equal(duplicate.details.registration, 'C-OLD');
    }
    for (const field of ['registration', 'aircraft_type', 'aircraft_category', 'engine_type', 'engine_model', 'powerplant_type', 'helicopter_class']) {
        assert.equal(savedSelection(flight, 'duplicate', [{ ...same, [field]: 'changed' }]).id, null);
    }
    assert.equal(savedSelection(flight, 'duplicate', [same]).id, 7);
    assert.equal(savedSelection({ ...flight, aircraft_profile_id: null }, 'edit', [same]).id, null);
    const state = savedSelection(flight, 'edit', [same]);
    const manual = chooseProfile(state, null);
    assert.equal(manual.id, null);
    assert.equal(manual.details.registration, 'C-OLD');
    const selected = chooseProfile(state, { ...same, id: 9, registration: 'C-NEW' });
    assert.equal(selected.id, 9);
    assert.equal(selected.details.registration, 'C-NEW');
    assert.equal(selected.saved, false);
});

class Element {
    constructor(value = '') { this.value = value; this.children = []; this.listeners = {}; this.disabled = false; this.textContent = ''; this.classList = { add() {}, remove() {}, toggle() {} }; }
    appendChild(child) { this.children.push(child); return child; }
    replaceChildren(...children) { this.children = children; }
    addEventListener(name, fn) { this.listeners[name] = fn; }
    dispatch(name) { return this.listeners[name]?.({ target: this }); }
    setAttribute() {}
    get options() { return this.children.flatMap(child => child.label ? child.children : [child]); }
}
function pickerEnvironment(profiles, mode = 'add', fail = false, typesReady = Promise.resolve()) {
    const ids = Object.fromEntries(['flightForm', 'aircraftProfile', 'profileSearch', 'profileStatus', 'profileRetry', 'aircraft_type', 'registration', 'engine_model', 'powerplant_type', 'helicopter_class'].map(id => [id, new Element()]));
    const radios = [new Element('Helicopter'), new Element('Aeroplane'), new Element('Simulator'), new Element('Single Engine'), new Element('Multi Engine')];
    radios[0].checked = radios[3].checked = true;
    ids.flightForm.elements = [];
    const document = { getElementById: id => ids[id], createElement: () => new Element(), querySelectorAll: selector => selector.includes('aircraft_category') && selector.includes('engine_type') ? radios : selector.includes('aircraft_category') ? radios.slice(0, 3) : radios.slice(3) };
    const context = { window: {}, document, fetch: async () => { if (fail) throw new Error('offline'); return { ok: true, json: async () => profiles }; } };
    vm.runInNewContext(fs.readFileSync(source, 'utf8'), context);
    const controller = path.join(__dirname, '../src/public/js/flight-aircraft-profiles.js');
    vm.runInNewContext(fs.existsSync(controller) ? fs.readFileSync(controller, 'utf8') : '', context);
    assert.equal(typeof context.window.FlightAircraftProfiles, 'function', 'flight profile controller exists');
    return { picker: new context.window.FlightAircraftProfiles(mode, typesReady), ids, radios, context, document, setFailure: value => { fail = value; } };
}
test('native flight picker autofills and locks profile fields; Manual keeps their displayed values', async () => {
    const profile = { id: 8, registration: 'C-TEST', aircraft_type: 'H125', aircraft_category: 'Helicopter', engine_type: 'Multi Engine', engine_model: '2B1', powerplant_type: 'Turbine', helicopter_class: 'Intermediate', is_default: true };
    const { picker, ids, radios } = pickerEnvironment([profile]);
    await picker.ready;
    assert.equal(picker.id, 8);
    assert.equal(ids.registration.value, 'C-TEST');
    assert.equal(ids.engine_model.value, '2B1');
    assert.equal(ids.powerplant_type.value, 'Turbine');
    assert.equal(ids.helicopter_class.value, 'Intermediate');
    assert.equal(ids.powerplant_type.disabled, picker.id !== null);
    assert.equal(ids.helicopter_class.disabled, picker.id !== null);
    assert.equal(ids.engine_model.readOnly, picker.id !== null);
    assert.equal(ids.aircraft_type.value, 'H125');
    assert.equal(ids.aircraft_type.disabled, true);
    assert.equal(radios[4].checked, true);
    assert.equal(radios[0].disabled, true);
    ids.aircraftProfile.value = '';
    ids.aircraftProfile.dispatch('change');
    assert.equal(picker.id, null);
    assert.equal(ids.registration.value, 'C-TEST');
    assert.equal(ids.engine_model.value, '2B1');
    assert.equal(ids.powerplant_type.value, 'Turbine');
    assert.equal(ids.helicopter_class.value, 'Intermediate');
    assert.equal(ids.powerplant_type.disabled, picker.id !== null);
    assert.equal(ids.helicopter_class.disabled, picker.id !== null);
    assert.equal(ids.engine_model.readOnly, picker.id !== null);
    assert.equal(ids.aircraft_type.disabled, false);
    assert.equal(radios[0].disabled, false);
});

test('both flight pages load native profile controls and save integer/null association through existing form', () => {
    for (const page of ['add-flight.html', 'edit-flight.html']) {
        const html = fs.readFileSync(path.join(__dirname, '../src/public', page), 'utf8');
        assert.match(html, /<select[^>]*id="aircraftProfile"/, `${page} has native profile select`);
        assert.match(html, /id="profileSearch"/);
        for (const field of ['powerplant_type', 'helicopter_class']) assert.match(html, new RegExp(`<select[^>]*id="${field}"`));
        assert.match(html, /<input[^>]*id="engine_model"[^>]*maxlength="100"/);
        assert.match(html, /flight-aircraft-profiles\.js/);
    }
    const form = fs.readFileSync(path.join(__dirname, '../src/public/js/flight-form.js'), 'utf8');
    assert.match(form, /aircraft_profile_id:\s*flightProfilePicker\.id/);
    assert.match(form, /await flightProfilePicker\.restore\(flight\)/);
    assert.match(form, /engine_model:\s*document\.getElementById\('engine_model'\)\.value\.trim\(\)/);
});

function settingsEnvironment(initial = [], reference = false) {
    const names = ['aircraftProfileForm', 'profileEditorTitle', 'profileRegistration', 'profileType', 'profileCategory', 'profileEngine', 'profileEngineModel', 'profilePowerplant', 'profileHelicopterClass', 'profileNickname', 'profileOperator', 'profileFavourite', 'profileDefault', 'profileSaveBtn', 'profileCancelBtn', 'profileShowArchived', 'profileList', 'profileSettingsStatus', 'profileSettingsRetry', 'profileTypeOptions'];
    if (reference) names.push('referenceSearch', 'referenceAll', 'referenceSearchBtn', 'referenceResults', 'referenceApply', 'referenceClear', 'referenceStatus', 'referenceSource');
    const ids = Object.fromEntries(names.map(id => [id, new Element()]));
    ids.aircraftProfileForm.reset = () => { names.filter(id => /^profile(Registration|Type|EngineModel|Powerplant|HelicopterClass|Nickname|Operator)$/.test(id)).forEach(id => { ids[id].value = ''; }); ids.profileCategory.value = 'Helicopter'; ids.profileEngine.value = 'Single Engine'; ids.profileFavourite.checked = ids.profileDefault.checked = false; };
    ids.profileRegistration.focus = () => {};
    ids.aircraftProfileForm.scrollIntoView = () => {};
    ids.aircraftProfileForm.querySelectorAll = () => names.filter(id => /^profile(Registration|Type|Category|Engine|EngineModel|Powerplant|HelicopterClass|Nickname|Operator|Favourite|Default)$/.test(id)).map(id => ids[id]);
    let writeGate;
    let profiles = initial.map(p => ({ ...p }));
    const calls = [];
    const document = { getElementById: id => ids[id], createElement: () => new Element(), addEventListener() {} };
    const context = { window: {}, document, fetch: async (url, options = {}) => {
        calls.push({ url, ...options });
        if (url === '/api/aircraft') return { ok: true, json: async () => [] };
        if (options.method) {
            if (writeGate) await writeGate;
            const payload = JSON.parse(options.body);
            const id = options.method === 'POST' ? 11 : Number(url.split('/').pop());
            if (options.method === 'POST') profiles.push({ id, ...payload });
            else profiles = profiles.map(p => p.id === id ? { ...p, ...payload } : payload.is_default ? { ...p, is_default: false } : p);
            return { ok: true, json: async () => ({ id, ...payload }) };
        }
        return { ok: true, json: async () => profiles };
    } };
    vm.runInNewContext(fs.readFileSync(source, 'utf8'), context);
    if (reference) vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/public/js/aircraft-reference.js'), 'utf8'), context);
    const script = path.join(__dirname, '../src/public/js/aircraft-profile-settings.js');
    vm.runInNewContext(fs.existsSync(script) ? fs.readFileSync(script, 'utf8') : '', context);
    assert.equal(typeof context.window.AircraftProfileSettings, 'function', 'settings controller exists');
    return { settings: new context.window.AircraftProfileSettings(), ids, calls, delayWrites: gate => { writeGate = gate; } };
}
test('profile settings adds explicit server-backed flags, reloads saved data and edits without history rewrite', async () => {
    const { settings, ids, calls } = settingsEnvironment();
    await settings.ready;
    ids.profileRegistration.value = 'C-TEST'; ids.profileType.value = 'H125';
    ids.profileCategory.value = 'Helicopter'; ids.profileEngine.value = 'Multi Engine';
    ids.profileEngineModel.value = ' 2B / 2B1 ';
    ids.profilePowerplant.value = 'Turbine'; ids.profileHelicopterClass.value = 'Intermediate';
    ids.profileNickname.value = '<img onerror=alert(1)>'; ids.profileOperator.value = 'Rescue';
    ids.profileFavourite.checked = ids.profileDefault.checked = true;
    await settings.save();
    const written = calls.find(call => call.method === 'POST');
    assert.ok(written);
    const body = JSON.parse(written.body);
    assert.equal(body.favourite, true); assert.equal(body.is_default, true); assert.equal(body.archived, false);
    assert.equal(body.engine_model, '2B / 2B1');
    assert.equal(body.powerplant_type, 'Turbine'); assert.equal(body.helicopter_class, 'Intermediate');
    assert.equal(body.nickname, '<img onerror=alert(1)>');
    assert.ok(calls.slice(calls.indexOf(written) + 1).some(call => !call.method && call.url.includes('include_archived=true')), 'read back after save');
    settings.edit(settings.profiles[0]);
    assert.equal(ids.profilePowerplant.value, 'Turbine'); assert.equal(ids.profileHelicopterClass.value, 'Intermediate');
    ids.profileOperator.value = 'Training';
    await settings.save();
    assert.equal(JSON.parse(calls.find(call => call.method === 'PUT').body).operator, 'Training');
    assert.equal(settings.profiles[0].operator, 'Training');
    assert.match(ids.profileSettingsStatus.textContent, /saved/i);
});

test('settings archive clears default, restore stays non-default and active/all listing is keyboard actionable', async () => {
    const profile = { id: 5, registration: 'C-TEST', aircraft_type: 'R44', aircraft_category: 'Helicopter', engine_type: 'Single Engine', favourite: false, is_default: true, archived: false };
    const { settings, ids, calls } = settingsEnvironment([profile]);
    await settings.ready;
    assert.equal(typeof settings.changeFlags, 'function', 'profile flag actions exist');
    await settings.changeFlags(profile, { archived: true, is_default: false });
    assert.equal(settings.profiles[0].archived, true);
    assert.equal(settings.profiles[0].is_default, false);
    assert.equal(ids.profileList.children.length, 1);
    assert.match(ids.profileList.children[0].textContent, /No aircraft profiles/);
    ids.profileShowArchived.checked = true;
    settings.render();
    const actions = ids.profileList.children[0].children[2].children;
    assert.ok(actions.some(button => button.textContent === 'Restore'));
    const restore = actions.find(button => button.textContent === 'Restore');
    await restore.dispatch('click');
    assert.equal(settings.profiles[0].archived, false);
    assert.equal(settings.profiles[0].is_default, false);
    assert.equal(JSON.parse(calls.filter(call => call.method === 'PUT')[1].body).is_default, false);
    const html = fs.readFileSync(path.join(__dirname, '../src/public/settings.html'), 'utf8');
    assert.match(html, /data-tab="aircraft-profiles"/);
    assert.match(html, /id="aircraftProfileForm"/);
    assert.match(html, /id="profileEngineModel"[^>]*maxlength="100"/);
    assert.match(html, /aircraft-profile-settings\.js/);
});

test('profile settings optional text remains API-valid empty strings', async () => {
    const { settings, ids, calls } = settingsEnvironment();
    await settings.ready;
    ids.profileRegistration.value = 'C-EMPTY'; ids.profileType.value = 'R44';
    ids.profileCategory.value = 'Helicopter'; ids.profileEngine.value = 'Single Engine';
    await settings.save();
    const payload = JSON.parse(calls.find(call => call.method === 'POST').body);
    assert.equal(payload.nickname, '');
    assert.equal(payload.operator, '');
    assert.equal(payload.engine_model, '');
    assert.equal(payload.powerplant_type, ''); assert.equal(payload.helicopter_class, '');
});

test('profile fetch failure still waits for type catalogue so historical snapshots cannot be erased by its late response', async () => {
    let resolveTypes;
    const typesReady = new Promise(resolve => { resolveTypes = resolve; });
    const { picker, ids } = pickerEnvironment([], 'edit', true, typesReady);
    const flight = { aircraft_profile_id: 6, registration: 'C-OLD', aircraft_type: 'Historic Type', aircraft_category: 'Helicopter', engine_type: 'Single Engine' };
    let restored = false;
    const restoring = picker.restore(flight).then(() => { restored = true; });
    await new Promise(resolve => setImmediate(resolve));
    const restoredBeforeTypes = restored;
    resolveTypes();
    await restoring;
    assert.equal(restoredBeforeTypes, false, 'must wait even when profiles API fails');
    assert.equal(picker.id, 6);
    assert.equal(ids.aircraft_type.value, 'Historic Type');
    assert.equal(ids.aircraft_type.disabled, true);
    assert.match(ids.profileStatus.textContent, /could not be loaded/);
});

test('profile settings deep link opens the new tab and shared profile styles support native 44px targets in both appearances', () => {
    const settings = fs.readFileSync(path.join(__dirname, '../src/public/js/settings.js'), 'utf8');
    assert.match(settings, /window\.location\.hash/, 'profile management deep link is handled');
    const cssPath = path.join(__dirname, '../src/public/css/aircraft-profiles.css');
    assert.ok(fs.existsSync(cssPath), 'shared profile styles exist');
    const css = fs.readFileSync(cssPath, 'utf8');
    assert.match(css, /min-height:\s*44px/);
    assert.match(css, /focus-visible/);
    for (const page of ['settings.html', 'add-flight.html', 'edit-flight.html']) {
        assert.match(fs.readFileSync(path.join(__dirname, '../src/public', page), 'utf8'), /aircraft-profiles\.css/);
    }
});

test('flight picker does not apply delayed default after manual intent, editing, duplication or nonblank data', async () => {
    const profile = { id: 8, registration: 'C-TEST', aircraft_type: 'H125', aircraft_category: 'Helicopter', engine_type: 'Multi Engine', engine_model: '2B1', powerplant_type: 'Turbine', helicopter_class: 'Intermediate', is_default: true };
    for (const mode of ['edit', 'duplicate']) {
        const { picker } = pickerEnvironment([profile], mode);
        await picker.ready;
        assert.equal(picker.id, null);
    }
    for (const intent of ['manual', 'typed', 'powerplant_type', 'helicopter_class']) {
        let resolveTypes;
        const types = new Promise(resolve => { resolveTypes = resolve; });
        const { picker, ids } = pickerEnvironment([profile], 'add', false, types);
        if (intent === 'manual') ids.aircraftProfile.dispatch('change');
        else if (intent === 'typed') ids.registration.value = 'C-MANUAL';
        else ids[intent].value = intent === 'powerplant_type' ? 'Piston' : 'Heavy';
        resolveTypes();
        await picker.ready;
        assert.equal(picker.id, null);
        if (intent === 'typed') assert.equal(ids.registration.value, 'C-MANUAL');
    }
});

test('editing preserved snapshot survives API failure and search; selecting another profile is explicit', async () => {
    const flight = { aircraft_profile_id: 6, registration: 'C-OLD', aircraft_type: 'Historic Type', aircraft_category: 'Helicopter', engine_type: 'Single Engine' };
    const current = { id: 6, registration: 'C-NEW', aircraft_type: 'H125', aircraft_category: 'Helicopter', engine_type: 'Multi Engine' };
    const other = { ...current, id: 8, registration: 'C-OTHER' };
    const { picker, ids, setFailure } = pickerEnvironment([current, other], 'edit', true);
    await picker.restore(flight);
    assert.equal(picker.id, 6);
    assert.equal(ids.registration.value, 'C-OLD');
    setFailure(false);
    await ids.profileRetry.dispatch('click');
    await picker.ready;
    assert.equal(picker.id, 6);
    assert.equal(ids.registration.value, 'C-OLD');
    ids.profileSearch.value = 'no match'; ids.profileSearch.dispatch('input');
    assert.equal(picker.id, 6);
    ids.aircraftProfile.value = '8'; ids.aircraftProfile.dispatch('change');
    assert.equal(picker.id, 8);
    assert.equal(ids.registration.value, 'C-OTHER');
});

test('edit save rebases the saved-flight picker onto the newly stored snapshot', async () => {
    const form = fs.readFileSync(path.join(__dirname, '../src/public/js/flight-form.js'), 'utf8');
    assert.match(form, /await flightProfilePicker\.restore\(data\)/, 'successful update refreshes the saved-flight baseline');
});

test('browser-restored route or nonzero hours makes an add form nonblank even without input events', async () => {
    const profile = { id: 8, registration: 'C-TEST', aircraft_type: 'H125', aircraft_category: 'Helicopter', engine_type: 'Single Engine', is_default: true };
    for (const field of [{ type: 'textarea', value: 'Saved route' }, { type: 'number', value: '1.2' }]) {
        let release;
        const types = new Promise(resolve => { release = resolve; });
        const { picker, ids } = pickerEnvironment([profile], 'add', false, types);
        ids.flightForm.elements = [field];
        release();
        await picker.ready;
        assert.equal(picker.id, null);
    }
});

test('row flag actions synchronize affected editor flags without discarding draft text or unrelated flags', async () => {
    const profile = { id: 1, registration: 'C-ONE', aircraft_type: 'R44', aircraft_category: 'Helicopter', engine_type: 'Single Engine', favourite: false, is_default: false, archived: false };
    const { settings, ids, calls } = settingsEnvironment([profile, { ...profile, id: 2, registration: 'C-TWO' }]);
    await settings.ready;
    settings.edit(settings.profiles[0]);
    ids.profileNickname.value = 'Unsaved nickname';
    ids.profileOperator.value = 'Unsaved operator';
    ids.profileEngineModel.value = 'Unsaved 2B1';
    ids.profileDefault.checked = true; // unrelated local draft flag
    await settings.changeFlags(settings.profiles[0], { favourite: true });
    assert.equal(ids.profileFavourite.checked, true);
    assert.equal(ids.profileDefault.checked, true, 'unrelated draft flag stays intact');
    for (const is_default of [true, false, true]) {
        await settings.changeFlags(settings.profiles[0], { is_default });
        assert.equal(ids.profileDefault.checked, is_default);
    }
    await settings.changeFlags(settings.profiles[1], { is_default: true });
    assert.equal(ids.profileDefault.checked, false, 'another default clears edited default via canonical readback');
    assert.equal(settings.editing.is_default, false);
    assert.equal(ids.profileNickname.value, 'Unsaved nickname');
    assert.equal(ids.profileOperator.value, 'Unsaved operator');
    assert.equal(ids.profileEngineModel.value, 'Unsaved 2B1');
    await settings.save();
    const payload = JSON.parse(calls.filter(call => call.method === 'PUT').at(-1).body);
    assert.equal(payload.favourite, true);
    assert.equal(payload.is_default, false);
    assert.equal(payload.nickname, 'Unsaved nickname');
});

test('settings freezes editor fields throughout delayed saves and restores archived default restrictions', async () => {
    for (const fail of [false, true]) {
        const profile = { id: 1, registration: 'C-ONE', aircraft_type: 'R44', aircraft_category: 'Helicopter', engine_type: 'Single Engine', favourite: false, is_default: false, archived: true };
        const { settings, ids, delayWrites } = settingsEnvironment([profile]);
        await settings.ready;
        settings.edit(settings.profiles[0]);
        let release, reject;
        delayWrites(new Promise((resolve, fail) => { release = resolve; reject = fail; }));
        const saving = settings.save();
        const fieldsFrozen = ids.aircraftProfileForm.querySelectorAll().every(field => field.disabled);
        const archivedFilterFrozen = ids.profileShowArchived.disabled;
        const retryFrozen = ids.profileSettingsRetry.disabled;
        if (fail) reject(new Error('offline')); else release();
        await saving;
        assert.equal(fieldsFrozen, true, 'all editor inputs/selects/checkboxes frozen during request');
        assert.equal(archivedFilterFrozen, true);
        assert.equal(retryFrozen, true);
        assert.equal(ids.profileRegistration.disabled, false);
        assert.equal(ids.profileShowArchived.disabled, false);
        assert.equal(ids.profileDefault.disabled, fail, 'failed archived edit stays restricted; successful reset permits new default');
        if (fail) assert.equal(ids.profileRegistration.value, 'C-ONE');
    }
});

test('edit submission freezes manual/profile intent until delayed PUT and picker restore finish, restoring exact control states', async () => {
    for (const linked of [false, true]) {
        for (const fail of [false, true]) {
            const env = pickerEnvironment([], 'edit');
            const { picker, ids, radios, context, document } = env;
            const flight = { engine_model: '2B', powerplant_type: 'Piston', helicopter_class: 'Light', aircraft_profile_id: linked ? 6 : null, registration: 'C-OLD', aircraft_type: 'R44', aircraft_category: 'Helicopter', engine_type: 'Single Engine' };
            await picker.restore(flight);
            for (const id of ['submitBtn', 'submitText', 'successAlert', 'errorAlert', 'date', 'pic', 'copilot', 'departure', 'arrival', 'route', 'day_pic', 'night_pic', 'day_dual', 'night_dual', 'day_sic', 'night_sic', 'day_cmnd_practice', 'night_cmnd_practice', 'takeoffs_day', 'takeoffs_night', 'landings_day', 'landings_night']) ids[id] = new Element();
            ids.date.value = '2020-01-01';
            ids.route.disabled = true; // unrelated pre-existing restriction
            ids.pic.readOnly = true;
            const controls = [...Object.entries(ids).filter(([id]) => !['flightForm', 'submitText', 'successAlert', 'errorAlert', 'profileStatus'].includes(id)).map(([, element]) => element), ...radios];
            ids.flightForm.querySelectorAll = () => controls;
            document.addEventListener = () => {};
            document.querySelector = selector => (selector.includes('aircraft_category') ? radios.slice(0, 3) : radios.slice(3)).find(radio => radio.checked);
            const originalQuery = document.querySelectorAll;
            document.querySelectorAll = selector => selector === '.custom-field-input' ? [] : originalQuery(selector);
            context.window.scrollTo = () => {};
            context.console = { error() {} };
            context.showToast = () => {};
            vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/public/js/flight-form.js'), 'utf8'), context);
            context.testPicker = picker;
            vm.runInNewContext("isEditMode = true; flightId = '9'; flightProfilePicker = testPicker;", context);
            let respond, finishRestore;
            let submitted;
            context.fetch = (url, options) => { submitted = JSON.parse(options.body); return new Promise(resolve => { respond = resolve; }); };
            const restoring = new Promise(resolve => { finishRestore = resolve; });
            const originalRestore = picker.restore.bind(picker);
            picker.restore = async data => { await restoring; await originalRestore(data); };
            const before = controls.map(field => [field.disabled, field.readOnly]);
            const saving = context.submitForm();
            assert.equal(submitted.engine_model, '2B');
            assert.equal(submitted.powerplant_type, 'Piston'); assert.equal(submitted.helicopter_class, 'Light');
            const frozenDuringPut = controls.every(field => field.disabled);
            assert.equal(ids.engine_model.disabled, true);
            // Native user interactions cannot select Manual or enter a new registration while frozen.
            if (!ids.aircraftProfile.disabled) { ids.aircraftProfile.value = ''; ids.aircraftProfile.dispatch('change'); }
            if (!ids.registration.disabled && !ids.registration.readOnly) ids.registration.value = 'C-NEW';
            respond({ ok: !fail, json: async () => fail ? { error: 'offline' } : flight });
            await new Promise(resolve => setImmediate(resolve));
            const frozenDuringRestore = fail || (ids.flightForm.inert === true && ids.profileRetry.disabled);
            finishRestore();
            await saving;
            assert.equal(frozenDuringPut, true, 'all controls, including Manual selector and retry, disabled during PUT');
            assert.equal(frozenDuringRestore, true, 'form stays frozen through async picker rebase');
            assert.equal(ids.registration.value, 'C-OLD');
            assert.equal(ids.engine_model.value, '2B');
            assert.equal(ids.engine_model.readOnly, linked);
            assert.deepEqual(controls.map(field => [field.disabled, field.readOnly]), before);
            assert.equal(!!ids.flightForm.inert, false);
        }
    }
});

test('flight listing displays supplied engine models as escaped text and omits unknown models', () => {
    const table = new Element();
    const context = { document: { addEventListener() {}, getElementById: () => table },
        formatDate: value => value, truncate: value => value,
        escapeHtml: value => String(value).replaceAll('<', '&lt;').replaceAll('>', '&gt;') };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/public/js/flights-list.js'), 'utf8'), context);
    context.displayFlights([{ id: 1, aircraft_type: 'AS350B3', engine_model: '<2B1>', powerplant_type: 'Turbine', helicopter_class: 'Intermediate', flight_time: 1 }]);
    assert.match(table.innerHTML, /Engine model: &lt;2B1&gt;/);
    assert.match(table.innerHTML, /Powerplant: Turbine/);
    assert.match(table.innerHTML, /Helicopter class: Intermediate/);
    assert.doesNotMatch(table.innerHTML, /<2B1>/);
    context.displayFlights([{ id: 1, aircraft_type: 'AS350B3', engine_model: '', flight_time: 1 }]);
    assert.doesNotMatch(table.innerHTML, /Engine model:|Powerplant:|Helicopter class:/);
});

test('default is eligible only on a fresh untouched blank add form', () => {
    const { defaultProfile } = helpers();
    assert.equal(typeof defaultProfile, 'function', 'default profile helper exists');
    const profiles = [{ id: 1, is_default: true, archived: true }, { id: 2, is_default: true, archived: false }];
    assert.equal(defaultProfile(profiles, { mode: 'add', dirty: false, blank: true }).id, 2);
    for (const state of [{ mode: 'edit', blank: true }, { mode: 'duplicate', blank: true }, { mode: 'add', dirty: true, blank: true }, { mode: 'add', blank: false }]) {
        assert.equal(defaultProfile(profiles, state), null);
    }
});

test('settings integrates reference and clears old selections on edit, cancel and pending save without changing exact models', async () => {
    const profile = { id: 1, registration: 'C-TEST', aircraft_type: 'Exact old variant', aircraft_category: 'Helicopter', engine_type: 'Single Engine', engine_model: 'Installed exact engine' };
    const { settings, ids } = settingsEnvironment([profile], true);
    await settings.ready;
    assert.ok(settings.reference, 'settings owns reference controller');
    const selectFixture = () => {
        settings.reference.rows = [{ icao: 'TEST', manufacturer: 'TEST ONLY', model: 'Generic alias', category: 'helicopter', engineCount: 2 }];
        ids.referenceResults.value = '0'; ids.referenceResults.dispatch('change');
    };
    selectFixture();
    settings.edit(profile);
    ids.referenceApply.dispatch('click');
    assert.equal(ids.profileType.value, 'Exact old variant');
    assert.equal(ids.profileEngineModel.value, 'Installed exact engine');
    selectFixture();
    settings.reset();
    ids.referenceApply.dispatch('click');
    assert.equal(ids.profileType.value, '');
    selectFixture();
    settings.setBusy(true);
    assert.equal(ids.referenceSearchBtn.disabled, true);
    assert.equal(ids.referenceApply.disabled, true);
    assert.equal(ids.referenceClear.disabled, true);
    ids.referenceApply.dispatch('click');
    assert.equal(ids.profileType.value, '');
    settings.setBusy(false);
    assert.equal(ids.referenceApply.disabled, true, 'old selection invalidated by save');
});

test('reference full-width inputs exclude checkboxes and all profile CSS clients use the fixed asset key', () => {
    const css = fs.readFileSync(path.join(__dirname, '../src/public/css/aircraft-profiles.css'), 'utf8');
    assert.doesNotMatch(css, /\.aircraft-reference\s+:is\(\s*input\s*,\s*select\s*\)/);
    assert.match(css, /\.aircraft-reference\s+:is\(input:not\(\[type="checkbox"\]\),\s*select\)/);
    for (const page of fs.readdirSync(path.join(__dirname, '../src/public')).filter(name => name.endsWith('.html'))) {
        const html = fs.readFileSync(path.join(__dirname, '../src/public', page), 'utf8');
        if (html.includes('/css/aircraft-profiles.css')) assert.match(html, /aircraft-profiles\.css\?v=1\.11\.0/);
    }
});

test('profile and flight optional dropdowns expose exactly the allowed blank and enum values', () => {
    for (const page of ['settings.html', 'add-flight.html', 'edit-flight.html']) {
        const html = fs.readFileSync(path.join(__dirname, '../src/public', page), 'utf8');
        for (const [field, values] of Object.entries({ powerplant_type: ['', 'Turbine', 'Piston'], helicopter_class: ['', 'Light', 'Intermediate', 'Medium', 'Heavy'] })) {
            const select = html.match(new RegExp(`<select[^>]*name="${field}"[^>]*>([\\s\\S]*?)</select>`));
            assert.ok(select, `${page}: ${field}`);
            assert.deepEqual([...select[1].matchAll(/<option value="([^"]*)"/g)].map(match => match[1]), values);
            assert.doesNotMatch(select[0], /required/);
        }
    }
});
