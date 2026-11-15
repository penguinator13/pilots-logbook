// Profile management is separate from the legacy Aircraft Types editor.
window.AircraftProfileSettings = class AircraftProfileSettings {
    constructor() {
        this.profiles = [];
        this.editing = null;
        this.busy = false;
        this.form = this.el('aircraftProfileForm');
        this.form.addEventListener('submit', event => { event.preventDefault(); this.save(); });
        this.el('profileCancelBtn').addEventListener('click', () => this.reset());
        this.el('profileShowArchived').addEventListener('change', () => this.render());
        this.el('profileSettingsRetry').addEventListener('click', () => { this.ready = this.load(); });
        this.ready = this.load();
        this.loadTypes();
    }
    el(id) { return document.getElementById(id); }
    message(text, error = false) {
        this.el('profileSettingsStatus').textContent = text;
        this.el('profileSettingsStatus').classList.toggle('profile-error', error);
    }
    async loadTypes() {
        try {
            const response = await fetch('/api/aircraft');
            if (!response.ok) return;
            const types = await response.json();
            this.el('profileTypeOptions').replaceChildren();
            for (const type of types) {
                const option = document.createElement('option');
                option.value = type.name;
                this.el('profileTypeOptions').appendChild(option);
            }
        } catch (error) { /* Suggestions only; free text type entry stays available. */ }
    }
    async load(throwOnError = false) {
        try {
            const response = await fetch('/api/aircraft-profiles?include_archived=true');
            if (!response.ok) throw new Error('Aircraft profiles could not be loaded.');
            const profiles = await response.json();
            if (!Array.isArray(profiles)) throw new Error('Invalid aircraft profiles response.');
            this.profiles = profiles;
            this.render();
            this.el('profileSettingsRetry').classList.add('hidden');
            this.message('Aircraft profiles loaded. Changes here never rewrite saved flight details.');
            return profiles;
        } catch (error) {
            this.message(`${error.message || 'Profiles unavailable.'} Your form and previously loaded profiles have been kept. Retry to refresh.`, true);
            this.el('profileSettingsRetry').classList.remove('hidden');
            if (throwOnError) throw error;
            return null;
        }
    }
    reset() {
        this.editing = null;
        this.form.reset();
        this.el('profileDefault').disabled = false;
        this.el('profileEditorTitle').textContent = 'Add Aircraft Profile';
        this.el('profileSaveBtn').textContent = 'Add Profile';
        this.el('profileCancelBtn').classList.add('hidden');
    }
    edit(profile) {
        if (this.busy) return;
        this.editing = profile;
        const fields = { profileRegistration: 'registration', profileType: 'aircraft_type', profileCategory: 'aircraft_category', profileEngine: 'engine_type', profileNickname: 'nickname', profileOperator: 'operator' };
        Object.entries(fields).forEach(([id, key]) => { this.el(id).value = profile[key] || ''; });
        this.el('profileFavourite').checked = !!profile.favourite;
        this.el('profileDefault').checked = !!profile.is_default;
        this.el('profileDefault').disabled = !!profile.archived;
        this.el('profileEditorTitle').textContent = profile.archived ? 'Edit Archived Aircraft Profile' : 'Edit Aircraft Profile';
        this.el('profileSaveBtn').textContent = 'Save Profile';
        this.el('profileCancelBtn').classList.remove('hidden');
        this.form.scrollIntoView({ block: 'start', behavior: 'smooth' });
        this.el('profileRegistration').focus();
    }
    async write(id, payload) {
        const response = await fetch(id ? `/api/aircraft-profiles/${id}` : '/api/aircraft-profiles', {
            method: id ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Profile could not be saved.');
        // Confirm the exact target using canonical GET, not an optimistic local update.
        const profiles = await this.load(true);
        const target = profiles.find(p => p.id === (id || result.id));
        if (!target || !Object.entries(payload).every(([key, value]) => (target[key] ?? null) === value)) {
            throw new Error('The server did not confirm these profile changes. Refresh and check before retrying.');
        }
        return target;
    }
    async save() {
        if (this.busy) return;
        const payload = {
            registration: this.el('profileRegistration').value.trim().toUpperCase(),
            aircraft_type: this.el('profileType').value.trim(),
            aircraft_category: this.el('profileCategory').value,
            engine_type: this.el('profileEngine').value,
            nickname: this.el('profileNickname').value.trim(),
            operator: this.el('profileOperator').value.trim(),
            favourite: !!this.el('profileFavourite').checked,
            is_default: !this.editing?.archived && !!this.el('profileDefault').checked,
            archived: !!this.editing?.archived
        };
        if (!payload.registration || !payload.aircraft_type) {
            this.message('Registration and aircraft type are required.', true);
            return;
        }
        this.setBusy(true);
        try {
            await this.write(this.editing?.id || null, payload);
            this.reset();
            this.message('Aircraft profile saved. Existing flight details have not changed.');
        } catch (error) {
            this.message(`${error.message || 'Network error.'} Your form is kept. If the save reached the server, refresh profiles before retrying.`, true);
        } finally { this.setBusy(false); }
    }
    async changeFlags(profile, flags) {
        if (this.busy) return;
        this.setBusy(true);
        try {
            const target = await this.write(profile.id, flags);
            const edited = this.profiles.find(p => p.id === this.editing?.id);
            if (edited) {
                // Sync only flags affected by this action; keep unrelated draft fields.
                if (edited.id === target.id) {
                    this.editing = { ...this.editing, ...flags };
                    if ('favourite' in flags) this.el('profileFavourite').checked = !!edited.favourite;
                    if ('archived' in flags) this.editing.archived = edited.archived;
                }
                if ('is_default' in flags || (edited.id === target.id && 'archived' in flags)) {
                    this.editing.is_default = edited.is_default;
                    this.el('profileDefault').checked = !!edited.is_default;
                }
                this.el('profileDefault').disabled = !!edited.archived;
            }
            this.message('Aircraft profile updated. Existing flight details have not changed.');
        } catch (error) {
            this.message(`${error.message || 'Network error.'} Refresh profiles to confirm the server state before retrying.`, true);
            this.el('profileSettingsRetry').classList.remove('hidden');
        } finally { this.setBusy(false); }
    }
    setBusy(busy) {
        this.busy = busy;
        if (busy) {
            this.disabledFields = Array.from(this.form.querySelectorAll('input, select, textarea'), field => [field, field.disabled]);
            this.disabledFields.push([this.el('profileShowArchived'), this.el('profileShowArchived').disabled]);
            this.disabledFields.forEach(([field]) => { field.disabled = true; });
        } else {
            this.disabledFields?.forEach(([field, disabled]) => { field.disabled = disabled; });
            this.el('profileDefault').disabled = !!this.editing?.archived;
        }
        this.form.setAttribute('aria-busy', String(busy));
        this.el('profileSaveBtn').disabled = busy;
        this.el('profileCancelBtn').disabled = busy;
        this.el('profileSettingsRetry').disabled = busy;
        // Rebuild action buttons with disabled state to prevent overlapping changes.
        this.render();
    }
    button(label, profile, action) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn btn-secondary';
        button.textContent = label;
        button.disabled = this.busy;
        button.setAttribute('aria-label', `${label}: ${profile.registration}`);
        button.addEventListener('click', action);
        return button;
    }
    render() {
        const list = this.el('profileList');
        list.replaceChildren();
        const profiles = this.profiles.filter(p => this.el('profileShowArchived').checked || !p.archived)
            .slice().sort((a, b) => Number(a.archived) - Number(b.archived) || a.registration.localeCompare(b.registration));
        if (!profiles.length) {
            const empty = document.createElement('p');
            empty.className = 'text-muted';
            empty.textContent = 'No aircraft profiles in this view. Add a profile above, or include archived profiles to restore one.';
            list.appendChild(empty);
        }
        for (const profile of profiles) {
            const item = document.createElement('article');
            item.className = 'profile-list-item';
            const title = document.createElement('h3');
            title.textContent = window.AircraftProfiles.profileLabel(profile);
            const detail = document.createElement('p');
            detail.className = 'text-muted';
            detail.textContent = `${profile.aircraft_category} · ${profile.engine_type} · ${profile.archived ? 'Archived' : 'Active'}${profile.favourite ? ' · Favourite' : ''}${profile.last_used_at ? ` · Last used ${new Date(profile.last_used_at).toLocaleDateString()}` : ''}`;
            const actions = document.createElement('div');
            actions.className = 'profile-actions';
            actions.appendChild(this.button('Edit', profile, () => this.edit(profile)));
            actions.appendChild(this.button(profile.favourite ? 'Unfavourite' : 'Favourite', profile, () => this.changeFlags(profile, { favourite: !profile.favourite })));
            if (!profile.archived) {
                actions.appendChild(this.button(profile.is_default ? 'Clear Default' : 'Set Default', profile, () => this.changeFlags(profile, { is_default: !profile.is_default })));
            }
            actions.appendChild(this.button(profile.archived ? 'Restore' : 'Archive', profile, () => this.changeFlags(profile, { archived: !profile.archived, is_default: false })));
            item.appendChild(title);
            item.appendChild(detail);
            item.appendChild(actions);
            list.appendChild(item);
        }
    }
};
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('aircraftProfileForm')) new window.AircraftProfileSettings();
});
