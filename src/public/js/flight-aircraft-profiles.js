// Native search + select: profile fields remain snapshots, never live-linked history.
window.FlightAircraftProfiles = class FlightAircraftProfiles {
    constructor(mode, typesReady = Promise.resolve()) {
        this.typesReady = typesReady;
        this.mode = mode;
        this.state = { id: null, saved: false };
        this.profiles = [];
        this.dirty = false;
        this.failed = false;
        this.select = document.getElementById('aircraftProfile');
        this.search = document.getElementById('profileSearch');
        this.status = document.getElementById('profileStatus');
        this.retry = document.getElementById('profileRetry');
        const form = document.getElementById('flightForm');
        form.addEventListener('input', () => { this.dirty = true; });
        form.addEventListener('change', () => { this.dirty = true; });
        this.search.addEventListener('input', () => { this.dirty = true; this.renderOptions(); });
        this.select.addEventListener('change', () => {
            this.dirty = true;
            if (this.select.value === 'saved') {
                this.state = { ...this.savedState };
                this.setDetails(this.state.details);
            } else {
                const profile = this.profiles.find(p => String(p.id) === this.select.value && !p.archived);
                this.state = window.AircraftProfiles.chooseProfile(this.state, profile || null);
                if (profile) this.setDetails(profile);
            }
            this.renderOptions();
            this.updateStatus();
        });
        this.retry.addEventListener('click', () => { this.ready = this.load(typesReady); });
        this.ready = this.load(typesReady);
    }
    get id() { return this.state.id; }
    option(value, label) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        return option;
    }
    async load(typesReady) {
        this.status.textContent = 'Loading aircraft profiles… Manual entry is always available.';
        this.retry.classList.add('hidden');
        try {
            const response = await fetch('/api/aircraft-profiles?include_archived=true');
            if (!response.ok) throw new Error('Profiles unavailable');
            const profiles = await response.json();
            if (!Array.isArray(profiles)) throw new Error('Invalid profiles');
            await typesReady;
            this.profiles = profiles;
            this.failed = false;
            // Browser-restored text/hours can predate our input listeners; it is not a fresh blank form.
            const hasOtherData = Array.from(document.getElementById('flightForm').elements || []).some(field =>
                !['date', 'radio', 'hidden', 'submit', 'button', 'select-one', 'search'].includes(field.type) &&
                field.value && !(field.type === 'number' && Number(field.value) === 0));
            const blank = !hasOtherData && !document.getElementById('aircraft_type').value && !document.getElementById('registration').value &&
                !Array.from(document.querySelectorAll('input[name="aircraft_category"], input[name="engine_type"]')).some(input => input.checked && !['Helicopter', 'Single Engine'].includes(input.value));
            const profile = window.AircraftProfiles.defaultProfile(profiles, { mode: this.mode, dirty: this.dirty, blank });
            if (profile) {
                this.state = window.AircraftProfiles.chooseProfile(this.state, profile);
                this.setDetails(profile);
            }
        } catch (error) {
            this.failed = true;
            this.retry.classList.remove('hidden');
        }
        this.renderOptions();
        this.updateStatus();
    }
    async restore(flight) {
        await Promise.all([this.ready, this.typesReady]);
        this.state = window.AircraftProfiles.savedSelection(flight, this.mode, this.failed ? null : this.profiles);
        this.savedState = { ...this.state };
        this.setDetails(flight);
        this.renderOptions();
        this.updateStatus();
    }
    setDetails(details) {
        const type = document.getElementById('aircraft_type');
        if (!Array.from(type.options).some(option => option.value === details.aircraft_type)) {
            type.appendChild(this.option(details.aircraft_type, details.aircraft_type));
        }
        type.value = details.aircraft_type;
        document.getElementById('registration').value = details.registration || '';
        for (const name of ['aircraft_category', 'engine_type']) {
            document.querySelectorAll(`input[name="${name}"]`).forEach(input => { input.checked = input.value === details[name]; });
        }
    }
    renderOptions() {
        this.select.replaceChildren(this.option('', 'Manual entry — keep displayed details'));
        if (this.savedState?.id) {
            this.select.appendChild(this.option('saved', `Saved flight details — ${this.savedState.details.registration || 'No registration'} · ${this.savedState.details.aircraft_type}`));
        }
        const savedId = this.mode === 'edit' ? this.savedState?.id : null;
        const groups = window.AircraftProfiles.groupedProfiles(this.profiles.filter(p => p.id !== savedId), this.search.value);
        const visible = new Set();
        for (const group of groups) {
            const optgroup = document.createElement('optgroup');
            optgroup.label = group.label;
            for (const profile of group.profiles) {
                visible.add(profile.id);
                optgroup.appendChild(this.option(String(profile.id), window.AircraftProfiles.profileLabel(profile)));
            }
            this.select.appendChild(optgroup);
        }
        // A search must not silently change an already-selected association.
        if (this.id && !this.state.saved && !visible.has(this.id)) {
            const selected = this.profiles.find(p => p.id === this.id);
            if (selected) this.select.appendChild(this.option(String(this.id), `Selected: ${window.AircraftProfiles.profileLabel(selected)}`));
        }
        this.select.value = this.state.saved && this.id ? 'saved' : this.id ? String(this.id) : '';
    }
    updateStatus() {
        const locked = this.id !== null;
        document.getElementById('aircraft_type').disabled = locked;
        document.getElementById('registration').readOnly = locked;
        document.querySelectorAll('input[name="aircraft_category"], input[name="engine_type"]').forEach(input => { input.disabled = locked; });
        let message = this.state.saved
            ? 'Saved flight details are shown, not the current profile. Select a different profile to replace them, or Manual entry to edit them.'
            : locked ? 'Aircraft details filled from this profile. Select Manual entry to edit these values.'
            : 'Manual entry. Your displayed details are kept; select a profile to fill aircraft details.';
        if (this.mode === 'duplicate' && this.state.saved && !this.id) message = 'Saved flight details kept as Manual entry: the original profile is changed, archived, unavailable or unlinked. No aircraft details have been substituted.';
        if (this.failed) message += ' Profiles could not be loaded. Any saved flight association is retained when editing. Retry to choose another profile.';
        else if (!this.profiles.some(p => !p.archived)) message += ' No active profiles yet. Add one in Settings → Aircraft Profiles.';
        else if (this.search.value && !window.AircraftProfiles.groupedProfiles(this.profiles, this.search.value).length) message += ' No profiles match your search.';
        this.status.textContent = message;
    }
};
