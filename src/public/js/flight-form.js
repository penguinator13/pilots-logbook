// Flight form functionality (for both add and edit)
// Note: checkAuth, setupNavigation, logout, escapeHtml, getLocalDateString, loadAircraftTypes are provided by common.js

let isEditMode = false;
let isDuplicateMode = false;
let flightId = null;
let customFields = [];

document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    checkAuth();

    // Set up navigation
    setupNavigation();

    // Load aircraft types using common.js helper
    const aircraftSelect = document.getElementById('aircraft_type');
    loadAircraftTypes(aircraftSelect);

    // Load custom fields
    loadCustomFields();

    // Load tags for quick insert
    loadTags();

    // Determine if we're in edit or duplicate mode
    const urlParams = new URLSearchParams(window.location.search);
    flightId = urlParams.get('id');
    const duplicateId = urlParams.get('duplicate');
    isEditMode = !!flightId;
    isDuplicateMode = !!duplicateId;

    if (isEditMode) {
        loadFlightData(flightId);
    } else if (isDuplicateMode) {
        loadFlightData(duplicateId, true); // true = duplicate mode
    } else {
        // Set default date to today
        const today = getLocalDateString();
        document.getElementById('date').value = today;
        document.getElementById('date').max = today;
    }

    // Set up form
    setupForm();
});

async function loadCustomFields() {
    try {
        const response = await fetch('/api/custom-fields');
        if (response.ok) {
            customFields = await response.json();
            renderCustomFields();
        }
    } catch (error) {
        console.error('Error loading custom fields:', error);
        // Fail silently - custom fields are optional
    }
}

function renderCustomFields() {
    const container = document.getElementById('customFieldsContainer');
    if (!customFields || customFields.length === 0) {
        container.innerHTML = '';
        return;
    }

    // Group custom fields into rows of 2
    let html = '<div class="form-group"><label class="form-label">Custom Fields</label></div>';

    for (let i = 0; i < customFields.length; i += 2) {
        html += '<div class="form-row">';

        // First field in the row
        const field1 = customFields[i];
        html += `
            <div class="form-group">
                <label for="custom_${field1.field_name}" class="form-label">${escapeHtml(field1.field_label)}</label>
                <input type="number" id="custom_${field1.field_name}" name="custom_${field1.field_name}" class="form-input custom-field-input" data-field-id="${field1.id}" step="any" min="0" value="0" placeholder="0.0">
            </div>
        `;

        // Second field in the row (if exists)
        if (i + 1 < customFields.length) {
            const field2 = customFields[i + 1];
            html += `
                <div class="form-group">
                    <label for="custom_${field2.field_name}" class="form-label">${escapeHtml(field2.field_label)}</label>
                    <input type="number" id="custom_${field2.field_name}" name="custom_${field2.field_name}" class="form-input custom-field-input" data-field-id="${field2.id}" step="any" min="0" value="0" placeholder="0.0">
                </div>
            `;
        }

        html += '</div>';
    }

    container.innerHTML = html;
}

// escapeHtml is provided by common.js

async function loadTags() {
    try {
        const response = await fetch('/api/tags');
        if (response.ok) {
            const tags = await response.json();
            renderTags(tags);
        }
    } catch (error) {
        console.error('Error loading tags:', error);
        // Fail silently - tags are optional
    }
}

function renderTags(tags) {
    const container = document.getElementById('tagsContainer');
    const buttonsContainer = document.getElementById('tagButtons');

    if (!tags || tags.length === 0) {
        container.classList.add('hidden');
        return;
    }

    // Show the tags container
    container.classList.remove('hidden');

    // Render tag buttons (display without hashtag)
    const html = tags.map(tag => `
        <button type="button" class="tag-button" onclick="insertTag('${escapeHtml(tag.name)}')">${escapeHtml(tag.name)}</button>
    `).join('');

    buttonsContainer.innerHTML = html;
}

function insertTag(tagName) {
    const routeField = document.getElementById('route');
    const currentValue = routeField.value;

    // Check if tag already exists in the field (as plain text)
    // Use word boundary check to avoid partial matches
    const tagRegex = new RegExp(`\\b${tagName}\\b`, 'i');
    if (tagRegex.test(currentValue)) {
        return; // Don't add duplicate tags
    }

    // Add tag to the end (with space if there's existing content)
    if (currentValue.trim()) {
        routeField.value = currentValue.trim() + ' ' + tagName;
    } else {
        routeField.value = tagName;
    }

    // Focus back on the field
    routeField.focus();
}

// Set "Self" for PIC or Co-pilot fields
function setSelf(fieldId) {
    const field = document.getElementById(fieldId);
    if (field) {
        field.value = 'Self';
        field.focus();
    }
}

// Make setSelf available globally for onclick handlers
window.setSelf = setSelf;

// Make insertTag available globally for onclick handlers
window.insertTag = insertTag;

async function loadFlightData(id, isDuplicate = false) {
    const loading = document.getElementById('loading');
    const errorAlert = document.getElementById('errorAlert');
    const form = document.getElementById('flightForm');

    try {
        const response = await fetch(`/api/flights/${id}`);
        if (!response.ok) {
            throw new Error('Flight not found');
        }

        const flight = await response.json();

        // Populate form fields
        if (!isDuplicate) {
            // Only set flightId for edit mode, not duplicate
            document.getElementById('flightId').value = flight.id;
            document.getElementById('date').value = flight.date;
        } else {
            // For duplicate mode, set today's date
            const today = getLocalDateString();
            document.getElementById('date').value = today;
        }
        document.getElementById('aircraft_type').value = flight.aircraft_type;
        document.getElementById('registration').value = flight.registration || '';
        document.getElementById('pic').value = flight.pic || '';
        document.getElementById('copilot').value = flight.copilot || '';
        document.getElementById('departure').value = flight.departure || '';
        document.getElementById('arrival').value = flight.arrival || '';
        document.getElementById('route').value = flight.route || '';

        // Populate new flight time breakdown fields
        document.getElementById('day_pic').value = flight.day_pic || 0;
        document.getElementById('night_pic').value = flight.night_pic || 0;
        document.getElementById('day_dual').value = flight.day_dual || 0;
        document.getElementById('night_dual').value = flight.night_dual || 0;
        document.getElementById('day_sic').value = flight.day_sic || 0;
        document.getElementById('night_sic').value = flight.night_sic || 0;
        document.getElementById('day_cmnd_practice').value = flight.day_cmnd_practice || 0;
        document.getElementById('night_cmnd_practice').value = flight.night_cmnd_practice || 0;

        // Set aircraft category radio button
        const aircraftCategory = flight.aircraft_category || 'Helicopter';
        const categoryRadio = document.querySelector(`input[name="aircraft_category"][value="${aircraftCategory}"]`);
        if (categoryRadio) {
            categoryRadio.checked = true;
        }

        // Set engine type radio button
        const engineType = flight.engine_type || 'Single Engine';
        const engineRadio = document.querySelector(`input[name="engine_type"][value="${engineType}"]`);
        if (engineRadio) {
            engineRadio.checked = true;
        }

        // Set takeoffs and landings
        document.getElementById('takeoffs_day').value = flight.takeoffs_day || 0;
        document.getElementById('takeoffs_night').value = flight.takeoffs_night || 0;
        document.getElementById('landings_day').value = flight.landings_day || 0;
        document.getElementById('landings_night').value = flight.landings_night || 0;

        // Set max date to today
        const today = getLocalDateString();
        document.getElementById('date').max = today;

        // Load custom field values if they exist
        if (flight.custom_fields && Array.isArray(flight.custom_fields)) {
            flight.custom_fields.forEach(cf => {
                const input = document.getElementById(`custom_${cf.field_name}`);
                if (input) {
                    input.value = cf.value || 0;
                }
            });
        }

        // Show form
        loading.classList.add('hidden');
        form.classList.remove('hidden');

        // After form is set up, recalculate total flight time
        // This needs to happen after setupForm() runs
        setTimeout(() => {
            const totalDisplay = document.getElementById('total_flight_time');
            if (totalDisplay) {
                const total = (
                    (parseFloat(document.getElementById('day_pic').value) || 0) +
                    (parseFloat(document.getElementById('night_pic').value) || 0) +
                    (parseFloat(document.getElementById('day_dual').value) || 0) +
                    (parseFloat(document.getElementById('night_dual').value) || 0) +
                    (parseFloat(document.getElementById('day_sic').value) || 0) +
                    (parseFloat(document.getElementById('night_sic').value) || 0) +
                    (parseFloat(document.getElementById('day_cmnd_practice').value) || 0) +
                    (parseFloat(document.getElementById('night_cmnd_practice').value) || 0)
                );
                totalDisplay.textContent = total.toFixed(1) + ' hours';
            }
        }, 100);

    } catch (error) {
        console.error('Load flight error:', error);
        loading.classList.add('hidden');
        errorAlert.textContent = 'Failed to load flight data. The flight may not exist.';
        errorAlert.classList.remove('hidden');
    }
}

function setupForm() {
    const form = document.getElementById('flightForm');

    // Set max date to today
    const today = getLocalDateString();
    document.getElementById('date').max = today;

    // Calculate total flight time from all component fields
    const calculateTotalFlightTime = () => {
        const dayPic = parseFloat(document.getElementById('day_pic').value) || 0;
        const nightPic = parseFloat(document.getElementById('night_pic').value) || 0;
        const dayDual = parseFloat(document.getElementById('day_dual').value) || 0;
        const nightDual = parseFloat(document.getElementById('night_dual').value) || 0;
        const daySic = parseFloat(document.getElementById('day_sic').value) || 0;
        const nightSic = parseFloat(document.getElementById('night_sic').value) || 0;
        const dayCmndPractice = parseFloat(document.getElementById('day_cmnd_practice').value) || 0;
        const nightCmndPractice = parseFloat(document.getElementById('night_cmnd_practice').value) || 0;

        const total = dayPic + nightPic + dayDual + nightDual + daySic + nightSic + dayCmndPractice + nightCmndPractice;

        const totalDisplay = document.getElementById('total_flight_time');
        totalDisplay.textContent = total.toFixed(1) + ' hours';

        return total;
    };

    // Add event listeners to all flight time inputs to recalculate total
    const flightTimeInputs = [
        'day_pic', 'night_pic', 'day_dual', 'night_dual',
        'day_sic', 'night_sic', 'day_cmnd_practice', 'night_cmnd_practice'
    ];

    flightTimeInputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) {
            input.addEventListener('input', calculateTotalFlightTime);
        }
    });

    // Calculate initial total
    calculateTotalFlightTime();

    // Handle form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await submitForm();
    });
}

async function submitForm() {
    const submitBtn = document.getElementById('submitBtn');
    const submitText = document.getElementById('submitText');
    const successAlert = document.getElementById('successAlert');
    const errorAlert = document.getElementById('errorAlert');

    // Clear previous messages
    successAlert.classList.add('hidden');
    errorAlert.classList.add('hidden');

    // Disable submit button
    submitBtn.disabled = true;
    submitText.textContent = isEditMode ? 'Updating...' : 'Adding...';

    try {
        // Collect form data
        const formData = {
            date: document.getElementById('date').value,
            aircraft_category: document.querySelector('input[name="aircraft_category"]:checked').value,
            engine_type: document.querySelector('input[name="engine_type"]:checked').value,
            aircraft_type: document.getElementById('aircraft_type').value,
            registration: document.getElementById('registration').value.toUpperCase() || null,
            pic: document.getElementById('pic').value || null,
            copilot: document.getElementById('copilot').value || null,
            departure: document.getElementById('departure').value.toUpperCase() || null,
            arrival: document.getElementById('arrival').value.toUpperCase() || null,
            route: document.getElementById('route').value || null,
            // New flight time breakdown fields
            day_pic: parseFloat(document.getElementById('day_pic').value) || 0,
            night_pic: parseFloat(document.getElementById('night_pic').value) || 0,
            day_dual: parseFloat(document.getElementById('day_dual').value) || 0,
            night_dual: parseFloat(document.getElementById('night_dual').value) || 0,
            day_sic: parseFloat(document.getElementById('day_sic').value) || 0,
            night_sic: parseFloat(document.getElementById('night_sic').value) || 0,
            day_cmnd_practice: parseFloat(document.getElementById('day_cmnd_practice').value) || 0,
            night_cmnd_practice: parseFloat(document.getElementById('night_cmnd_practice').value) || 0,
            takeoffs_day: parseInt(document.getElementById('takeoffs_day').value) || 0,
            takeoffs_night: parseInt(document.getElementById('takeoffs_night').value) || 0,
            landings_day: parseInt(document.getElementById('landings_day').value) || 0,
            landings_night: parseInt(document.getElementById('landings_night').value) || 0,
        };

        // Collect custom field values
        const customFieldInputs = document.querySelectorAll('.custom-field-input');
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

        // Validate date is not in future
        const flightDate = new Date(formData.date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (flightDate > today) {
            throw new Error('Flight date cannot be in the future');
        }

        // Make API request (duplicate mode uses POST like add mode)
        const url = isEditMode ? `/api/flights/${flightId}` : '/api/flights';
        const method = isEditMode ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData),
        });

        const data = await response.json();

        if (response.ok) {
            // Success
            let successMessage = 'Flight added successfully!';
            if (isEditMode) {
                successMessage = 'Flight updated successfully!';
            } else if (isDuplicateMode) {
                successMessage = 'Flight duplicated successfully!';
            }

            // Show toast notification
            showToast(successMessage, 'success');

            // Also show inline alert
            successAlert.textContent = successMessage;
            successAlert.classList.remove('hidden');

            // Scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' });

            if (isEditMode) {
                // Stay on page for edit
                submitBtn.disabled = false;
                submitText.textContent = 'Update Flight';
            } else {
                // Redirect to flights list after a short delay
                setTimeout(() => {
                    window.location.href = '/flights.html';
                }, 1500);
            }
        } else {
            throw new Error(data.error || 'Failed to save flight');
        }

    } catch (error) {
        console.error('Submit error:', error);
        errorAlert.textContent = error.message || 'Failed to save flight. Please try again.';
        errorAlert.classList.remove('hidden');
        submitBtn.disabled = false;
        submitText.textContent = isEditMode ? 'Update Flight' : 'Add Flight';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}
