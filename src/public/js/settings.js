// Settings page functionality (Aircraft + Custom Fields + Tags)

let aircraftToDelete = null;
let customFieldToDelete = null;
let tagToDelete = null;

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
    loadAircraft();
    loadCustomFields();
    loadTags();

    // Load aircraft for prime logbook form
    loadPrimeAircraftTypes();

    // Set up prime logbook real-time calculation
    setupPrimeBreakdownCalculation();
});

async function checkAuth() {
    try {
        const response = await fetch('/api/auth/me');
        if (!response.ok) {
            window.location.href = '/login.html';
        }
    } catch (error) {
        console.error('Auth check error:', error);
        window.location.href = '/login.html';
    }
}

function setupNavigation() {
    // Mobile navigation toggle
    const navToggle = document.getElementById('navToggle');
    const navMenu = document.getElementById('navMenu');

    if (navToggle) {
        navToggle.addEventListener('click', () => {
            navMenu.classList.toggle('show');
        });
    }

    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await logout();
        });
    }
}

async function logout() {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/login.html';
    } catch (error) {
        console.error('Logout error:', error);
        window.location.href = '/login.html';
    }
}

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

async function loadAircraft() {
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
            <button class="btn btn-small btn-danger" onclick="confirmDeleteAircraft(${item.id}, '${safeName}')">Delete</button>
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
            await loadAircraft();

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
        await loadAircraft();

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

    const html = customFields.map(item => `
        <div class="custom-field-item">
            <div>
                <div class="field-name">${escapeHtml(item.field_label)}</div>
                <div class="field-meta">Field name: ${escapeHtml(item.field_name)} • Added ${formatDate(item.created_at)}</div>
            </div>
            <button class="btn btn-small btn-danger" onclick="confirmDeleteCustomField(${item.id}, '${escapeHtml(item.field_label)}')">Delete</button>
        </div>
    `).join('');

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

async function loadPrimeAircraftTypes() {
    const select = document.getElementById('primeAircraftType');

    try {
        const response = await fetch('/api/aircraft');
        const aircraft = response.ok ? await response.json() : [];
        const aircraftNames = aircraft.map(a => a.name);
        aircraftNames.sort();

        select.innerHTML = '<option value="">Select aircraft type</option>';
        aircraftNames.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            select.appendChild(option);
        });

        // Load custom fields for prime form
        await loadPrimeCustomFields();
    } catch (error) {
        console.error('Error loading aircraft types for prime form:', error);
    }
}

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

// ==================== UTILITY FUNCTIONS ====================

function formatDate(dateString) {
    if (!dateString) return 'Unknown';
    // Handle both YYYY-MM-DD and full datetime formats
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Unknown';
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Make delete functions available globally for onclick handlers
window.confirmDeleteAircraft = confirmDeleteAircraft;
window.confirmDeleteCustomField = confirmDeleteCustomField;
window.confirmDeleteTag = confirmDeleteTag;
