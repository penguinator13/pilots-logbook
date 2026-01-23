// Settings page functionality (Aircraft + Custom Fields + Tags)
// Note: checkAuth, setupNavigation, logout, escapeHtml, formatDate, loadAircraftTypes are provided by common.js

let aircraftToDelete = null;
let customFieldToDelete = null;
let tagToDelete = null;
let aircraftToEdit = null;
let customFieldToEdit = null;

document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    checkAuth();

    // Set up navigation
    setupNavigation();

    // Set up tabs
    setupTabs();

    // Set up forms
    setupForms();

    // Load data
    loadAircraftList();
    loadCustomFields();
    loadTags();
    loadDashboardSettings();

    // Load aircraft for prime logbook form using common.js helper
    const primeAircraftSelect = document.getElementById('primeAircraftType');
    loadAircraftTypes(primeAircraftSelect).then(() => {
        // Load custom fields for prime form after aircraft loads
        loadPrimeCustomFields();
    });

    // Set up prime logbook real-time calculation
    setupPrimeBreakdownCalculation();
});

function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.getAttribute('data-tab');

            // Remove active class from all buttons and contents
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // Add active class to clicked button and corresponding content
            button.classList.add('active');
            document.getElementById(`${tabName}-tab`).classList.add('active');
        });
    });
}

function setupForms() {
    // Aircraft form
    const aircraftForm = document.getElementById('addAircraftForm');
    aircraftForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await addAircraft();
    });

    // Custom fields form
    const customFieldForm = document.getElementById('addCustomFieldForm');
    customFieldForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await addCustomField();
    });

    // Field name auto-generation
    const fieldLabel = document.getElementById('fieldLabel');
    const fieldName = document.getElementById('fieldName');

    fieldLabel.addEventListener('input', () => {
        // Auto-generate field name from label
        const generatedName = fieldLabel.value
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, '_') + '_hours';
        fieldName.value = generatedName;
    });

    // Tags form
    const tagForm = document.getElementById('addTagForm');
    tagForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await addTag();
    });

    // Prime logbook form
    const primeForm = document.getElementById('primeLogbookForm');
    primeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await submitPrimeEntry();
    });

    // Prime clear button
    const primeClearBtn = document.getElementById('primeClearBtn');
    primeClearBtn.addEventListener('click', () => {
        document.getElementById('primeLogbookForm').reset();
    });
}

// ==================== AIRCRAFT MANAGEMENT ====================

async function loadAircraftList() {
    const loading = document.getElementById('aircraftLoading');
    const errorAlert = document.getElementById('errorAlert');
    const aircraftContainer = document.getElementById('aircraftContainer');
    const aircraftList = document.getElementById('aircraftList');
    const noAircraft = document.getElementById('noAircraft');

    // Show loading
    loading.classList.remove('hidden');
    aircraftContainer.classList.add('hidden');

    try {
        const response = await fetch('/api/aircraft');
        if (!response.ok) {
            throw new Error('Failed to load aircraft');
        }

        const aircraft = await response.json();

        // Hide loading, show content
        loading.classList.add('hidden');
        aircraftContainer.classList.remove('hidden');

        if (aircraft.length === 0) {
            aircraftList.innerHTML = '';
            noAircraft.classList.remove('hidden');
        } else {
            noAircraft.classList.add('hidden');
            displayAircraft(aircraft);
        }

    } catch (error) {
        console.error('Load aircraft error:', error);
        loading.classList.add('hidden');
        errorAlert.textContent = 'Failed to load aircraft types. Please try again.';
        errorAlert.classList.remove('hidden');
    }
}

function displayAircraft(aircraft) {
    const aircraftList = document.getElementById('aircraftList');

    const html = aircraft.map(item => {
        // Escape name for use in onclick attribute (escape quotes and backslashes)
        const safeName = item.name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        return `
        <div class="aircraft-item">
            <div>
                <div class="aircraft-name">${escapeHtml(item.name)}</div>
                <div class="aircraft-meta">Added ${formatDate(item.created_at)}</div>
            </div>
            <div class="btn-group-inline">
                <button class="btn btn-small btn-secondary" onclick="editAircraft(${item.id}, '${safeName}')">Edit</button>
                <button class="btn btn-small btn-danger" onclick="confirmDeleteAircraft(${item.id}, '${safeName}')">Delete</button>
            </div>
        </div>
    `;
    }).join('');

    aircraftList.innerHTML = html;
}

async function addAircraft() {
    const addBtn = document.getElementById('addAircraftBtn');
    const successAlert = document.getElementById('successAlert');
    const errorAlert = document.getElementById('errorAlert');
    const aircraftNameInput = document.getElementById('aircraftName');

    // Clear previous messages
    successAlert.classList.add('hidden');
    errorAlert.classList.add('hidden');

    const name = aircraftNameInput.value.trim();

    if (!name) {
        errorAlert.textContent = 'Please enter an aircraft type';
        errorAlert.classList.remove('hidden');
        return;
    }

    // Disable button
    addBtn.disabled = true;
    addBtn.textContent = 'Adding...';

    try {
        const response = await fetch('/api/aircraft', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name }),
        });

        const data = await response.json();

        if (response.ok) {
            // Success
            successAlert.textContent = `Aircraft type "${name}" added successfully!`;
            successAlert.classList.remove('hidden');

            // Clear form
            aircraftNameInput.value = '';

            // Reload aircraft list
            await loadAircraftList();

            // Hide success message after 3 seconds
            setTimeout(() => {
                successAlert.classList.add('hidden');
            }, 3000);
        } else {
            throw new Error(data.error || 'Failed to add aircraft type');
        }

    } catch (error) {
        console.error('Add aircraft error:', error);
        errorAlert.textContent = error.message || 'Failed to add aircraft type. Please try again.';
        errorAlert.classList.remove('hidden');
    } finally {
        addBtn.disabled = false;
        addBtn.textContent = 'Add Aircraft';
    }
}

function confirmDeleteAircraft(id, name) {
    console.log('confirmDeleteAircraft called with id:', id, 'name:', name);
    aircraftToDelete = id;
    const modal = document.getElementById('deleteAircraftModal');
    console.log('Modal element:', modal);
    modal.classList.remove('hidden');
    modal.style.display = 'flex';

    const confirmBtn = document.getElementById('confirmDeleteAircraftBtn');
    const cancelBtn = document.getElementById('cancelDeleteAircraftBtn');

    confirmBtn.onclick = async () => {
        await deleteAircraft();
    };

    cancelBtn.onclick = () => {
        closeDeleteAircraftModal();
    };
}

function closeDeleteAircraftModal() {
    const modal = document.getElementById('deleteAircraftModal');
    modal.style.display = 'none';
    aircraftToDelete = null;
}

async function deleteAircraft() {
    const confirmBtn = document.getElementById('confirmDeleteAircraftBtn');
    const errorAlert = document.getElementById('errorAlert');
    const successAlert = document.getElementById('successAlert');

    try {
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Deleting...';

        const response = await fetch(`/api/aircraft/${aircraftToDelete}`, {
            method: 'DELETE',
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to delete aircraft type');
        }

        // Close modal
        closeDeleteAircraftModal();

        // Show success message
        successAlert.textContent = 'Aircraft type deleted successfully';
        successAlert.classList.remove('hidden');
        setTimeout(() => {
            successAlert.classList.add('hidden');
        }, 3000);

        // Reload aircraft list
        await loadAircraftList();

    } catch (error) {
        console.error('Delete error:', error);
        closeDeleteAircraftModal();
        errorAlert.textContent = error.message || 'Failed to delete aircraft type. Please try again.';
        errorAlert.classList.remove('hidden');
        setTimeout(() => {
            errorAlert.classList.add('hidden');
        }, 5000);
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Delete';
    }
}

function editAircraft(id, name) {
    aircraftToEdit = id;
    const modal = document.getElementById('editAircraftModal');
    document.getElementById('editAircraftName').value = name;
    modal.classList.remove('hidden');
    modal.style.display = 'flex';

    const form = document.getElementById('editAircraftForm');
    form.onsubmit = async (e) => {
        e.preventDefault();
        await saveAircraftEdit();
    };

    document.getElementById('cancelEditAircraftBtn').onclick = () => {
        closeEditAircraftModal();
    };
}

function closeEditAircraftModal() {
    const modal = document.getElementById('editAircraftModal');
    modal.style.display = 'none';
    aircraftToEdit = null;
}

async function saveAircraftEdit() {
    const newName = document.getElementById('editAircraftName').value.trim();
    const successAlert = document.getElementById('successAlert');
    const errorAlert = document.getElementById('errorAlert');

    if (!newName) {
        alert('Aircraft name is required');
        return;
    }

    try {
        const response = await fetch(`/api/aircraft/${aircraftToEdit}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newName }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to update aircraft');
        }

        closeEditAircraftModal();

        const flightsUpdated = data.flights_updated || 0;
        const message = flightsUpdated > 0
            ? `Aircraft type updated successfully. ${flightsUpdated} flight(s) were updated.`
            : 'Aircraft type updated successfully.';

        successAlert.textContent = message;
        successAlert.classList.remove('hidden');
        setTimeout(() => successAlert.classList.add('hidden'), 4000);

        await loadAircraftList();

    } catch (error) {
        console.error('Edit aircraft error:', error);
        errorAlert.textContent = error.message;
        errorAlert.classList.remove('hidden');
        setTimeout(() => errorAlert.classList.add('hidden'), 5000);
    }
}

// ==================== CUSTOM FIELDS MANAGEMENT ====================

async function loadCustomFields() {
    const loading = document.getElementById('customFieldsLoading');
    const errorAlert = document.getElementById('errorAlert');
    const customFieldsContainer = document.getElementById('customFieldsContainer');
    const customFieldsList = document.getElementById('customFieldsList');
    const noCustomFields = document.getElementById('noCustomFields');

    // Show loading
    loading.classList.remove('hidden');
    customFieldsContainer.classList.add('hidden');

    try {
        const response = await fetch('/api/custom-fields');
        if (!response.ok) {
            throw new Error('Failed to load custom fields');
        }

        const customFields = await response.json();

        // Hide loading, show content
        loading.classList.add('hidden');
        customFieldsContainer.classList.remove('hidden');

        if (customFields.length === 0) {
            customFieldsList.innerHTML = '';
            noCustomFields.classList.remove('hidden');
        } else {
            noCustomFields.classList.add('hidden');
            displayCustomFields(customFields);
        }

    } catch (error) {
        console.error('Load custom fields error:', error);
        loading.classList.add('hidden');
        // Don't show error if endpoint doesn't exist yet
        if (!error.message.includes('404')) {
            errorAlert.textContent = 'Failed to load custom fields. Please try again.';
            errorAlert.classList.remove('hidden');
        }
    }
}

function displayCustomFields(customFields) {
    const customFieldsList = document.getElementById('customFieldsList');

    const html = customFields.map(item => {
        const safeLabel = item.field_label.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        return `
        <div class="custom-field-item">
            <div>
                <div class="field-name">${escapeHtml(item.field_label)}</div>
                <div class="field-meta">Field name: ${escapeHtml(item.field_name)} • Added ${formatDate(item.created_at)}</div>
            </div>
            <div class="btn-group-inline">
                <button class="btn btn-small btn-secondary" onclick="editCustomField(${item.id}, '${safeLabel}')">Edit</button>
                <button class="btn btn-small btn-danger" onclick="confirmDeleteCustomField(${item.id}, '${safeLabel}')">Delete</button>
            </div>
        </div>
    `;
    }).join('');

    customFieldsList.innerHTML = html;
}

async function addCustomField() {
    const addBtn = document.getElementById('addCustomFieldBtn');
    const successAlert = document.getElementById('successAlert');
    const errorAlert = document.getElementById('errorAlert');
    const fieldLabelInput = document.getElementById('fieldLabel');
    const fieldNameInput = document.getElementById('fieldName');

    // Clear previous messages
    successAlert.classList.add('hidden');
    errorAlert.classList.add('hidden');

    const fieldLabel = fieldLabelInput.value.trim();
    const fieldName = fieldNameInput.value.trim();

    if (!fieldLabel || !fieldName) {
        errorAlert.textContent = 'Please fill in all fields';
        errorAlert.classList.remove('hidden');
        return;
    }

    // Validate field name format
    if (!/^[a-z_]+_hours$/.test(fieldName)) {
        errorAlert.textContent = 'Field name must be lowercase letters and underscores only, ending with _hours';
        errorAlert.classList.remove('hidden');
        return;
    }

    // Disable button
    addBtn.disabled = true;
    addBtn.textContent = 'Adding...';

    try {
        const response = await fetch('/api/custom-fields', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ field_label: fieldLabel, field_name: fieldName }),
        });

        const data = await response.json();

        if (response.ok) {
            // Success
            successAlert.textContent = `Custom field "${fieldLabel}" added successfully!`;
            successAlert.classList.remove('hidden');

            // Clear form
            fieldLabelInput.value = '';
            fieldNameInput.value = '';

            // Reload custom fields list
            await loadCustomFields();

            // Hide success message after 3 seconds
            setTimeout(() => {
                successAlert.classList.add('hidden');
            }, 3000);
        } else {
            throw new Error(data.error || 'Failed to add custom field');
        }

    } catch (error) {
        console.error('Add custom field error:', error);
        errorAlert.textContent = error.message || 'Failed to add custom field. Please try again.';
        errorAlert.classList.remove('hidden');
    } finally {
        addBtn.disabled = false;
        addBtn.textContent = 'Add Custom Field';
    }
}

function confirmDeleteCustomField(id, label) {
    customFieldToDelete = id;
    const modal = document.getElementById('deleteCustomFieldModal');
    modal.style.display = 'flex';

    const confirmBtn = document.getElementById('confirmDeleteCustomFieldBtn');
    const cancelBtn = document.getElementById('cancelDeleteCustomFieldBtn');

    confirmBtn.onclick = async () => {
        await deleteCustomField();
    };

    cancelBtn.onclick = () => {
        closeDeleteCustomFieldModal();
    };
}

function closeDeleteCustomFieldModal() {
    const modal = document.getElementById('deleteCustomFieldModal');
    modal.style.display = 'none';
    customFieldToDelete = null;
}

async function deleteCustomField() {
    const confirmBtn = document.getElementById('confirmDeleteCustomFieldBtn');
    const errorAlert = document.getElementById('errorAlert');
    const successAlert = document.getElementById('successAlert');

    try {
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Deleting...';

        const response = await fetch(`/api/custom-fields/${customFieldToDelete}`, {
            method: 'DELETE',
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to delete custom field');
        }

        // Close modal
        closeDeleteCustomFieldModal();

        // Show success message
        successAlert.textContent = 'Custom field deleted successfully';
        successAlert.classList.remove('hidden');
        setTimeout(() => {
            successAlert.classList.add('hidden');
        }, 3000);

        // Reload custom fields list
        await loadCustomFields();

    } catch (error) {
        console.error('Delete error:', error);
        closeDeleteCustomFieldModal();
        errorAlert.textContent = error.message || 'Failed to delete custom field. Please try again.';
        errorAlert.classList.remove('hidden');
        setTimeout(() => {
            errorAlert.classList.add('hidden');
        }, 5000);
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Delete';
    }
}

function editCustomField(id, label) {
    customFieldToEdit = id;
    const modal = document.getElementById('editCustomFieldModal');
    document.getElementById('editFieldLabel').value = label;
    modal.classList.remove('hidden');
    modal.style.display = 'flex';

    const form = document.getElementById('editCustomFieldForm');
    form.onsubmit = async (e) => {
        e.preventDefault();
        await saveCustomFieldEdit();
    };

    document.getElementById('cancelEditCustomFieldBtn').onclick = () => {
        closeEditCustomFieldModal();
    };
}

function closeEditCustomFieldModal() {
    const modal = document.getElementById('editCustomFieldModal');
    modal.style.display = 'none';
    customFieldToEdit = null;
}

async function saveCustomFieldEdit() {
    const newLabel = document.getElementById('editFieldLabel').value.trim();
    const successAlert = document.getElementById('successAlert');
    const errorAlert = document.getElementById('errorAlert');

    if (!newLabel) {
        alert('Field label is required');
        return;
    }

    try {
        const response = await fetch(`/api/custom-fields/${customFieldToEdit}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ field_label: newLabel }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to update custom field');
        }

        closeEditCustomFieldModal();

        successAlert.textContent = 'Custom field updated successfully.';
        successAlert.classList.remove('hidden');
        setTimeout(() => successAlert.classList.add('hidden'), 3000);

        await loadCustomFields();

    } catch (error) {
        console.error('Edit custom field error:', error);
        errorAlert.textContent = error.message;
        errorAlert.classList.remove('hidden');
        setTimeout(() => errorAlert.classList.add('hidden'), 5000);
    }
}

// ==================== TAGS MANAGEMENT ====================

async function loadTags() {
    const loading = document.getElementById('tagsLoading');
    const errorAlert = document.getElementById('errorAlert');
    const tagsContainer = document.getElementById('tagsContainer');
    const tagsList = document.getElementById('tagsList');
    const noTags = document.getElementById('noTags');

    // Show loading
    loading.classList.remove('hidden');
    tagsContainer.classList.add('hidden');

    try {
        const response = await fetch('/api/tags');
        if (!response.ok) {
            throw new Error('Failed to load tags');
        }

        const tags = await response.json();

        // Hide loading, show content
        loading.classList.add('hidden');
        tagsContainer.classList.remove('hidden');

        if (tags.length === 0) {
            tagsList.innerHTML = '';
            noTags.classList.remove('hidden');
        } else {
            noTags.classList.add('hidden');
            displayTags(tags);
        }

    } catch (error) {
        console.error('Load tags error:', error);
        loading.classList.add('hidden');
        errorAlert.textContent = 'Failed to load tags. Please try again.';
        errorAlert.classList.remove('hidden');
    }
}

function displayTags(tags) {
    const tagsList = document.getElementById('tagsList');

    const html = tags.map(tag => {
        const safeName = tag.name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        return `
        <div class="tag-item">
            <span class="tag-name">#${escapeHtml(tag.name)}</span>
            <button class="tag-delete" onclick="confirmDeleteTag(${tag.id}, '${safeName}')" title="Delete tag">&times;</button>
        </div>
    `;
    }).join('');

    tagsList.innerHTML = html;
}

async function addTag() {
    const addBtn = document.getElementById('addTagBtn');
    const successAlert = document.getElementById('successAlert');
    const errorAlert = document.getElementById('errorAlert');
    const tagNameInput = document.getElementById('tagName');

    // Clear previous messages
    successAlert.classList.add('hidden');
    errorAlert.classList.add('hidden');

    const name = tagNameInput.value.trim();

    if (!name) {
        errorAlert.textContent = 'Please enter a tag name';
        errorAlert.classList.remove('hidden');
        return;
    }

    // Disable button
    addBtn.disabled = true;
    addBtn.textContent = 'Adding...';

    try {
        const response = await fetch('/api/tags', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name }),
        });

        const data = await response.json();

        if (response.ok) {
            // Success
            successAlert.textContent = `Tag "#${name}" added successfully!`;
            successAlert.classList.remove('hidden');

            // Clear form
            tagNameInput.value = '';

            // Reload tags list
            await loadTags();

            // Hide success message after 3 seconds
            setTimeout(() => {
                successAlert.classList.add('hidden');
            }, 3000);
        } else {
            throw new Error(data.error || 'Failed to add tag');
        }

    } catch (error) {
        console.error('Add tag error:', error);
        errorAlert.textContent = error.message || 'Failed to add tag. Please try again.';
        errorAlert.classList.remove('hidden');
    } finally {
        addBtn.disabled = false;
        addBtn.textContent = 'Add Tag';
    }
}

function confirmDeleteTag(id, name) {
    tagToDelete = id;
    const modal = document.getElementById('deleteTagModal');
    modal.classList.remove('hidden');
    modal.style.display = 'flex';

    const confirmBtn = document.getElementById('confirmDeleteTagBtn');
    const cancelBtn = document.getElementById('cancelDeleteTagBtn');

    confirmBtn.onclick = async () => {
        await deleteTag();
    };

    cancelBtn.onclick = () => {
        closeDeleteTagModal();
    };
}

function closeDeleteTagModal() {
    const modal = document.getElementById('deleteTagModal');
    modal.style.display = 'none';
    tagToDelete = null;
}

async function deleteTag() {
    const confirmBtn = document.getElementById('confirmDeleteTagBtn');
    const errorAlert = document.getElementById('errorAlert');
    const successAlert = document.getElementById('successAlert');

    try {
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Deleting...';

        const response = await fetch(`/api/tags/${tagToDelete}`, {
            method: 'DELETE',
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to delete tag');
        }

        // Close modal
        closeDeleteTagModal();

        // Show success message
        successAlert.textContent = 'Tag deleted successfully';
        successAlert.classList.remove('hidden');
        setTimeout(() => {
            successAlert.classList.add('hidden');
        }, 3000);

        // Reload tags list
        await loadTags();

    } catch (error) {
        console.error('Delete error:', error);
        closeDeleteTagModal();
        errorAlert.textContent = error.message || 'Failed to delete tag. Please try again.';
        errorAlert.classList.remove('hidden');
        setTimeout(() => {
            errorAlert.classList.add('hidden');
        }, 5000);
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Delete';
    }
}

// ==================== PRIME LOGBOOK ====================
// loadAircraftTypes for prime logbook is now handled by common.js helper in DOMContentLoaded

async function loadPrimeCustomFields() {
    try {
        const response = await fetch('/api/custom-fields');
        if (response.ok) {
            const customFields = await response.json();
            renderPrimeCustomFields(customFields);
        }
    } catch (error) {
        console.error('Error loading custom fields for prime form:', error);
    }
}

function renderPrimeCustomFields(customFields) {
    const container = document.getElementById('primeCustomFieldsContainer');
    if (!customFields || customFields.length === 0) {
        container.innerHTML = '';
        return;
    }

    let html = '<div class="form-group"><label class="form-label">Custom Specialty Fields (Optional)</label></div>';

    for (let i = 0; i < customFields.length; i += 2) {
        html += '<div class="form-row">';

        const field1 = customFields[i];
        html += `
            <div class="form-group">
                <label for="prime_custom_${field1.field_name}" class="form-label">${escapeHtml(field1.field_label)}</label>
                <input type="number" id="prime_custom_${field1.field_name}" name="prime_custom_${field1.field_name}" class="form-input prime-custom-field-input" data-field-id="${field1.id}" step="any" min="0" value="0" placeholder="0.0">
            </div>
        `;

        if (i + 1 < customFields.length) {
            const field2 = customFields[i + 1];
            html += `
                <div class="form-group">
                    <label for="prime_custom_${field2.field_name}" class="form-label">${escapeHtml(field2.field_label)}</label>
                    <input type="number" id="prime_custom_${field2.field_name}" name="prime_custom_${field2.field_name}" class="form-input prime-custom-field-input" data-field-id="${field2.id}" step="any" min="0" value="0" placeholder="0.0">
                </div>
            `;
        }

        html += '</div>';
    }

    container.innerHTML = html;
}

async function submitPrimeEntry() {
    const primeBtn = document.getElementById('primeLogbookBtn');
    const submitText = document.getElementById('primeSubmitText');
    const successAlert = document.getElementById('successAlert');
    const errorAlert = document.getElementById('errorAlert');

    // Clear previous messages
    successAlert.classList.add('hidden');
    errorAlert.classList.add('hidden');

    // Disable button
    primeBtn.disabled = true;
    submitText.textContent = 'Creating...';

    try {
        // Collect breakdown field data
        const dayPic = parseFloat(document.getElementById('primeDayPic').value) || 0;
        const nightPic = parseFloat(document.getElementById('primeNightPic').value) || 0;
        const dayDual = parseFloat(document.getElementById('primeDayDual').value) || 0;
        const nightDual = parseFloat(document.getElementById('primeNightDual').value) || 0;
        const daySic = parseFloat(document.getElementById('primeDaySic').value) || 0;
        const nightSic = parseFloat(document.getElementById('primeNightSic').value) || 0;
        const dayCmndPractice = parseFloat(document.getElementById('primeDayCmndPractice').value) || 0;
        const nightCmndPractice = parseFloat(document.getElementById('primeNightCmndPractice').value) || 0;

        // Calculate totals from breakdown fields
        const totalHours = dayPic + nightPic + dayDual + nightDual + daySic + nightSic + dayCmndPractice + nightCmndPractice;
        const dayHours = dayPic + dayDual + daySic + dayCmndPractice;
        const nightHours = nightPic + nightDual + nightSic + nightCmndPractice;

        // Validate that total hours is > 0
        if (totalHours <= 0) {
            throw new Error('Please enter at least one flight time breakdown value');
        }

        const formData = {
            date: document.getElementById('primeDate').value,
            aircraft_category: document.querySelector('input[name="primeAircraftCategory"]:checked').value,
            engine_type: document.querySelector('input[name="primeEngineType"]:checked').value,
            aircraft_type: document.getElementById('primeAircraftType').value,
            registration: '',
            pic: '',
            copilot: '',
            route: '=== LOGBOOK PRIME ENTRY ===',
            flight_time: totalHours,
            day_hours: dayHours,
            night_hours: nightHours,
            day_pic: dayPic,
            night_pic: nightPic,
            day_dual: dayDual,
            night_dual: nightDual,
            day_sic: daySic,
            night_sic: nightSic,
            day_cmnd_practice: dayCmndPractice,
            night_cmnd_practice: nightCmndPractice,
            takeoffs_day: parseInt(document.getElementById('primeTakeoffsDay').value) || 0,
            takeoffs_night: parseInt(document.getElementById('primeTakeoffsNight').value) || 0,
            landings_day: parseInt(document.getElementById('primeLandingsDay').value) || 0,
            landings_night: parseInt(document.getElementById('primeLandingsNight').value) || 0,
        };

        // Collect custom field values
        const customFieldInputs = document.querySelectorAll('.prime-custom-field-input');
        const customFieldValues = [];
        customFieldInputs.forEach(input => {
            const fieldId = parseInt(input.getAttribute('data-field-id'));
            const value = parseFloat(input.value) || 0;
            if (value > 0) {
                customFieldValues.push({ field_id: fieldId, value: value });
            }
        });

        if (customFieldValues.length > 0) {
            formData.custom_fields = customFieldValues;
        }

        // Submit to flights API
        const response = await fetch('/api/flights', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData),
        });

        const data = await response.json();

        if (response.ok) {
            successAlert.textContent = `Prime entry created successfully for ${formData.aircraft_type} with ${totalHours.toFixed(1)} hours!`;
            successAlert.classList.remove('hidden');

            // Clear form
            document.getElementById('primeLogbookForm').reset();

            // Reset the total display
            document.getElementById('primeTotalDisplay').textContent = '0.0 hours';

            // Scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' });

            setTimeout(() => {
                successAlert.classList.add('hidden');
            }, 5000);
        } else {
            throw new Error(data.error || 'Failed to create prime entry');
        }

    } catch (error) {
        console.error('Prime entry error:', error);
        errorAlert.textContent = error.message || 'Failed to create prime entry. Please try again.';
        errorAlert.classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
        primeBtn.disabled = false;
        submitText.textContent = 'Create Prime Entry';
    }
}

// ==================== PRIME BREAKDOWN CALCULATION ====================

function setupPrimeBreakdownCalculation() {
    const breakdownInputs = document.querySelectorAll('.prime-breakdown-input');
    breakdownInputs.forEach(input => {
        input.addEventListener('input', calculatePrimeTotal);
    });
}

function calculatePrimeTotal() {
    const dayPic = parseFloat(document.getElementById('primeDayPic').value) || 0;
    const nightPic = parseFloat(document.getElementById('primeNightPic').value) || 0;
    const dayDual = parseFloat(document.getElementById('primeDayDual').value) || 0;
    const nightDual = parseFloat(document.getElementById('primeNightDual').value) || 0;
    const daySic = parseFloat(document.getElementById('primeDaySic').value) || 0;
    const nightSic = parseFloat(document.getElementById('primeNightSic').value) || 0;
    const dayCmndPractice = parseFloat(document.getElementById('primeDayCmndPractice').value) || 0;
    const nightCmndPractice = parseFloat(document.getElementById('primeNightCmndPractice').value) || 0;

    const total = dayPic + nightPic + dayDual + nightDual + daySic + nightSic + dayCmndPractice + nightCmndPractice;

    const display = document.getElementById('primeTotalDisplay');
    if (display) {
        display.textContent = `${total.toFixed(1)} hours`;
    }
}

// ==================== DASHBOARD SETTINGS ====================

let dashboardCustomFields = [];

async function loadDashboardSettings() {
    const loading = document.getElementById('dashboardSettingsLoading');
    const content = document.getElementById('dashboardSettingsContent');

    // Check if elements exist (they might not if tab hasn't been rendered)
    if (!loading || !content) {
        console.warn('Dashboard settings elements not found');
        return;
    }

    // Show loading
    loading.classList.remove('hidden');
    content.classList.add('hidden');

    try {
        // Fetch preferences and custom fields in parallel
        const [prefsResponse, fieldsResponse] = await Promise.all([
            fetch('/api/preferences'),
            fetch('/api/custom-fields')
        ]);

        // Default preferences if API fails
        let prefs = {
            showHoursOverTime: true,
            showAircraftChart: true,
            showMonthlyActivity: true,
            hiddenCustomFields: []
        };

        if (prefsResponse.ok) {
            prefs = await prefsResponse.json();
        }

        dashboardCustomFields = fieldsResponse.ok ? await fieldsResponse.json() : [];

        // Set chart toggle states
        const hoursToggle = document.getElementById('showHoursOverTime');
        const aircraftToggle = document.getElementById('showAircraftChart');
        const monthlyToggle = document.getElementById('showMonthlyActivity');

        if (hoursToggle) hoursToggle.checked = prefs.showHoursOverTime !== false;
        if (aircraftToggle) aircraftToggle.checked = prefs.showAircraftChart !== false;
        if (monthlyToggle) monthlyToggle.checked = prefs.showMonthlyActivity !== false;

        // Render custom field toggles
        renderCustomFieldToggles(dashboardCustomFields, prefs.hiddenCustomFields || []);

        // Hide loading, show content
        loading.classList.add('hidden');
        content.classList.remove('hidden');

        // Set up save button (only once)
        const saveBtn = document.getElementById('saveDashboardSettings');
        if (saveBtn && !saveBtn.hasAttribute('data-listener-added')) {
            saveBtn.addEventListener('click', saveDashboardSettings);
            saveBtn.setAttribute('data-listener-added', 'true');
        }

    } catch (error) {
        console.error('Load dashboard settings error:', error);
    } finally {
        // Always hide loading and show content
        if (loading) loading.classList.add('hidden');
        if (content) content.classList.remove('hidden');
    }
}

function renderCustomFieldToggles(customFields, hiddenFieldIds) {
    const section = document.getElementById('customFieldTogglesSection');
    const container = document.getElementById('customFieldToggles');

    if (!customFields || customFields.length === 0) {
        section.classList.add('hidden');
        return;
    }

    section.classList.remove('hidden');

    const html = customFields.map(field => {
        const isHidden = hiddenFieldIds.includes(field.id);
        return `
            <label class="toggle-item">
                <input type="checkbox" class="custom-field-toggle" data-field-id="${field.id}" ${!isHidden ? 'checked' : ''}>
                <span>${escapeHtml(field.field_label)}</span>
            </label>
        `;
    }).join('');

    container.innerHTML = html;
}

async function saveDashboardSettings() {
    const saveBtn = document.getElementById('saveDashboardSettings');
    const successAlert = document.getElementById('successAlert');
    const errorAlert = document.getElementById('errorAlert');

    // Clear previous messages
    successAlert.classList.add('hidden');
    errorAlert.classList.add('hidden');

    // Disable button
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
        // Collect chart settings
        const showHoursOverTime = document.getElementById('showHoursOverTime').checked;
        const showAircraftChart = document.getElementById('showAircraftChart').checked;
        const showMonthlyActivity = document.getElementById('showMonthlyActivity').checked;

        // Collect hidden custom field IDs (unchecked = hidden)
        const hiddenCustomFields = [];
        document.querySelectorAll('.custom-field-toggle').forEach(toggle => {
            if (!toggle.checked) {
                hiddenCustomFields.push(parseInt(toggle.getAttribute('data-field-id')));
            }
        });

        const response = await fetch('/api/preferences', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                showHoursOverTime,
                showAircraftChart,
                showMonthlyActivity,
                hiddenCustomFields
            }),
        });

        const data = await response.json();

        if (response.ok) {
            successAlert.textContent = 'Dashboard settings saved successfully!';
            successAlert.classList.remove('hidden');

            setTimeout(() => {
                successAlert.classList.add('hidden');
            }, 3000);
        } else {
            throw new Error(data.error || 'Failed to save settings');
        }

    } catch (error) {
        console.error('Save dashboard settings error:', error);
        errorAlert.textContent = error.message || 'Failed to save settings. Please try again.';
        errorAlert.classList.remove('hidden');
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Settings';
    }
}

// ==================== UTILITY FUNCTIONS ====================
// formatDate, escapeHtml are provided by common.js

// Make functions available globally for onclick handlers
window.confirmDeleteAircraft = confirmDeleteAircraft;
window.confirmDeleteCustomField = confirmDeleteCustomField;
window.confirmDeleteTag = confirmDeleteTag;
window.editAircraft = editAircraft;
window.editCustomField = editCustomField;
