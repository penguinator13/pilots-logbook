// Reference data suggests a draft only. It never saves a profile or resolves an installed engine.
window.AircraftReference = class AircraftReference {
    constructor(settings) {
        this.settings = settings;
        this.rows = [];
        this.el('referenceSearchBtn').addEventListener('click', () => this.search());
        this.el('referenceSearch').addEventListener('input', () => this.clear());
        this.el('referenceAll').addEventListener('change', () => this.clear());
        this.el('referenceSearch').addEventListener('keydown', event => {
            if (event.key === 'Enter') { event.preventDefault(); return this.search(); }
        });
        this.el('referenceResults').addEventListener('change', () => {
            this.el('referenceApply').disabled = !this.rows[this.el('referenceResults').value];
        });
        this.el('referenceApply').addEventListener('click', () => this.apply());
        this.el('referenceClear').addEventListener('click', () => this.clear());
        for (const id of ['profileType', 'profileCategory', 'profileEngine', 'profileEngineModel']) {
            this.el(id).addEventListener('input', () => this.clear());
        }
        this.clear();
    }
    clear() {
        this.generation = (this.generation || 0) + 1;
        this.rows = [];
        this.el('referenceResults').replaceChildren();
        this.el('referenceResults').value = '';
        this.el('referenceApply').disabled = true;
        this.el('referenceStatus').textContent = 'No reference selected. Your draft is kept. Use Search for suggestions or continue manual entry.';
    }
    el(id) { return document.getElementById(id); }
    async search() {
        this.clear();
        const generation = this.generation;
        this.el('referenceStatus').textContent = 'Searching local reference…';
        try {
            const response = await fetch(`/api/aircraft-reference?q=${encodeURIComponent(this.el('referenceSearch').value.trim())}&category=${this.el('referenceAll').checked ? 'all' : 'helicopter'}`);
            const result = await response.json();
            if (generation !== this.generation) return;
            if (!response.ok || !Array.isArray(result.aircraft) || !result.source) throw new Error('Invalid reference');
            this.rows = result.aircraft;
            this.el('referenceStatus').textContent = result.total ? `${result.total} matches; showing ${this.rows.length}. Refine search if needed. Select an alias, then explicitly apply to the draft.` : 'No matches. Try another search or enter details manually.';
            const placeholder = document.createElement('option');
            placeholder.value = ''; placeholder.textContent = 'Choose a manufacturer / model alias…';
            this.el('referenceResults').replaceChildren(placeholder);
            this.rows.forEach((row, index) => {
                const option = document.createElement('option');
                option.value = String(index);
                option.textContent = `${row.icao} — ${row.manufacturer} — ${row.model}`;
                this.el('referenceResults').appendChild(option);
            });
            this.el('referenceSource').textContent = `${result.source.title} · ${result.source.edition || ''}`;
            this.el('referenceSource').href = result.source.url;
        } catch (error) {
            if (generation !== this.generation) return;
            this.clear();
            this.el('referenceStatus').textContent = 'Aircraft reference unavailable. Your manual draft is kept. Use Search to retry.';
        }
    }
    apply() {
        const row = this.rows[this.el('referenceResults').value];
        if (!row || this.settings.busy) return;
        this.el('profileType').value = row.model.length <= 50 ? row.model : row.icao;
        const category = { helicopter: 'Helicopter', 'fixed-wing': 'Aeroplane' }[row.category];
        if (category) this.el('profileCategory').value = category;
        const engine = row.engineCount === 1 ? 'Single Engine' : Number.isInteger(row.engineCount) && row.engineCount > 1 ? 'Multi Engine' : null;
        if (engine) this.el('profileEngine').value = engine;
        this.el('referenceStatus').textContent = `Applied ${row.icao} / ${row.manufacturer} / ${row.model} to draft only. ${row.model.length > 50 ? 'Model exceeds 50 characters: ICAO used as type. ' : ''}Category ${category ? 'updated' : 'unchanged (unsupported)'}; engine count ${engine ? 'updated' : 'unchanged (unknown)'}. Verify exact variant and installed engine manually; installed engine model was not changed. Save Profile separately.`;
        this.el('referenceApply').disabled = true;
    }
};
