// Shared, dependency-free aircraft profile policy. API metadata is canonical.
window.AircraftProfiles = (() => {
    function defaultProfile(profiles, state) {
        if (state.mode !== 'add' || state.dirty || !state.blank) return null;
        return profiles.find(profile => profile.is_default && !profile.archived) || null;
    }
    function profileLabel(profile) {
        return `${profile.registration} — ${profile.aircraft_type}${profile.nickname ? ` · ${profile.nickname}` : ''}${profile.operator ? ` · ${profile.operator}` : ''}${profile.is_default ? ' (default)' : ''}`;
    }
    function groupedProfiles(profiles, query = '') {
        const active = profiles.filter(profile => !profile.archived && profileLabel(profile).toLowerCase().includes(query.trim().toLowerCase()));
        const alphabetical = (a, b) => a.registration.localeCompare(b.registration);
        return [
            { label: 'Favourites', profiles: active.filter(p => p.favourite).sort(alphabetical) },
            { label: 'Recently used', profiles: active.filter(p => !p.favourite && p.last_used_at).sort((a, b) => String(b.last_used_at).localeCompare(String(a.last_used_at))) },
            { label: 'Other aircraft', profiles: active.filter(p => !p.favourite && !p.last_used_at).sort(alphabetical) }
        ].filter(group => group.profiles.length);
    }
    const detailFields = ['registration', 'aircraft_type', 'aircraft_category', 'engine_type'];
    function savedSelection(flight, mode, profiles) {
        let id = flight.aircraft_profile_id || null;
        const profile = (profiles || []).find(p => p.id === id && !p.archived);
        // POST derives authoritative fields: only retain a duplicate's link if every snapshot matches.
        if (mode === 'duplicate' && (!profile || !detailFields.every(key => profile[key] === flight[key]))) id = null;
        return { id, details: flight, saved: true };
    }
    function chooseProfile(state, profile) {
        return profile ? { id: profile.id, details: profile, saved: false } : { ...state, id: null, saved: false };
    }
    return { defaultProfile, profileLabel, groupedProfiles, savedSelection, chooseProfile, detailFields };
})();
