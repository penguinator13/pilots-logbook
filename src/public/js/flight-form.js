// Flight form functionality (for both add and edit)

let isEditMode = false;
let flightId = null;
let customFields = [];

document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    checkAuth();

    // Set up navigation
    setupNavigation();

    // Load aircraft types
    loadAircraftTypes();

    // Load custom fields
    loadCustomFields();

    // Determine if we're in edit mode
    const urlParams = new URLSearchParams(window.location.search);
    flightId = urlParams.get('id');
    isEditMode = !!flightId;

    if (isEditMode) {
        loadFlightData(flightId);
    } else {
        // Set default date to today
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('date').value = today;
        document.getElementById('date').max = today;
    }

    // Set up form
    setupForm();
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

async function loadAircraftTypes() {
    const select = document.getElementById('aircraft_type');

    // Default aircraft types
    const defaults = ['R22', 'R44', 'AS350B2', 'AS350B3', 'H125', 'B206', 'Bell 212'];

    try {
        // Fetch custom aircraft from API
        const response = await fetch('/api/aircraft');
        const customAircraft = response.ok ? await response.json() : [];

        // Combine defaults with custom aircraft
        const allAircraft = [...defaults, ...customAircraft.map(a => a.name)];

        // Sort alphabetically
        allAircraft.sort();

        // Clear existing options except the placeholder
        select.innerHTML = '<option value="">Select aircraft type</option>';

        // Add all aircraft
        allAircraft.forEach(aircraft => {
            const option = document.createElement('option');
            option.value = aircraft;
            option.textContent = aircraft;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading aircraft types:', error);
        // Fall back to defaults only
        select.innerHTML = '<option value="">Select aircraft type</option>';
        defaults.forEach(aircraft => {
            const option = document.createElement('option');
            option.value = aircraft;
            option.textContent = aircraft;
            select.appendChild(option);
        });
    }
}

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

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function loadFlightData(id) {
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
        document.getElementById('flightId').value = flight.id;
        document.getElementById('date').value = flight.date;
        document.getElementById('aircraft_type').value = flight.aircraft_type;
        document.getElementById('registration').value = flight.registration || '';
        document.getElementById('pic').value = flight.pic || '';
        document.getElementById('copilot').value = flight.copilot || '';
        document.getElementById('route').value = flight.route || '';
        document.getElementById('flight_time').value = flight.flight_time;
        document.getElementById('day_hours').value = flight.day_hours;
        document.getElementById('night_hours').value = flight.night_hours;

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

        // Set flight type radio button
        const flightTypeRadio = document.querySelector(`input[name="flight_type"][value="${flight.flight_type}"]`);
        if (flightTypeRadio) {
            flightTypeRadio.checked = true;
        }

        // Set special operations hours
        document.getElementById('longline_hours').value = flight.longline_hours || 0;
        document.getElementById('mountain_hours').value = flight.mountain_hours || 0;
        document.getElementById('instructor_hours').value = flight.instructor_hours || 0;
        document.getElementById('crosscountry_hours').value = flight.crosscountry_hours || 0;
        document.getElementById('night_vision_hours').value = flight.night_vision_hours || 0;
        document.getElementById('instrument_hours').value = flight.instrument_hours || 0;
        document.getElementById('simulated_instrument_hours').value = flight.simulated_instrument_hours || 0;
        document.getElementById('ground_instrument_hours').value = flight.ground_instrument_hours || 0;

        // Set takeoffs and landings
        document.getElementById('takeoffs_day').value = flight.takeoffs_day || 0;
        document.getElementById('takeoffs_night').value = flight.takeoffs_night || 0;
        document.getElementById('landings_day').value = flight.landings_day || 0;
        document.getElementById('landings_night').value = flight.landings_night || 0;

        // Set max date to today
        const today = new Date().toISOString().split('T')[0];
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

    } catch (error) {
        console.error('Load flight error:', error);
        loading.classList.add('hidden');
        errorAlert.textContent = 'Failed to load flight data. The flight may not exist.';
        errorAlert.classList.remove('hidden');
    }
}

function setupForm() {
    const form = document.getElementById('flightForm');
    const flightTimeInput = document.getElementById('flight_time');
    const dayHoursInput = document.getElementById('day_hours');
    const nightHoursInput = document.getElementById('night_hours');
    const timeWarning = document.getElementById('timeWarning');

    // Set max date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date').max = today;

    // Auto-calculate night hours when day hours changes
    const updateNightHours = () => {
        const flightTime = parseFloat(flightTimeInput.value) || 0;
        const dayHours = parseFloat(dayHoursInput.value) || 0;

        if (flightTime > 0) {
            const calculatedNightHours = Math.max(0, flightTime - dayHours);
            nightHoursInput.value = calculatedNightHours.toFixed(1);
        }

        validateHours();
    };

    // Auto-calculate day hours when night hours changes
    const updateDayHours = () => {
        const flightTime = parseFloat(flightTimeInput.value) || 0;
        const nightHours = parseFloat(nightHoursInput.value) || 0;

        if (flightTime > 0) {
            const calculatedDayHours = Math.max(0, flightTime - nightHours);
            dayHoursInput.value = calculatedDayHours.toFixed(1);
        }

        validateHours();
    };

    // Validate day/night hours sum
    const validateHours = () => {
        const flightTime = parseFloat(flightTimeInput.value) || 0;
        const dayHours = parseFloat(dayHoursInput.value) || 0;
        const nightHours = parseFloat(nightHoursInput.value) || 0;
        const sum = dayHours + nightHours;

        if (flightTime > 0 && Math.abs(sum - flightTime) > 0.01) {
            timeWarning.classList.remove('hidden');
        } else {
            timeWarning.classList.add('hidden');
        }
    };

    // When flight time changes, auto-populate day hours
    flightTimeInput.addEventListener('input', updateDayHours);

    // When night hours changes, recalculate day hours
    nightHoursInput.addEventListener('input', updateDayHours);

    // When day hours changes, recalculate night hours
    dayHoursInput.addEventListener('input', updateNightHours);

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
            route: document.getElementById('route').value || null,
            flight_time: parseFloat(document.getElementById('flight_time').value),
            day_hours: parseFloat(document.getElementById('day_hours').value) || 0,
            night_hours: parseFloat(document.getElementById('night_hours').value) || 0,
            flight_type: document.querySelector('input[name="flight_type"]:checked').value,
            longline_hours: parseFloat(document.getElementById('longline_hours').value) || 0,
            mountain_hours: parseFloat(document.getElementById('mountain_hours').value) || 0,
            instructor_hours: parseFloat(document.getElementById('instructor_hours').value) || 0,
            crosscountry_hours: parseFloat(document.getElementById('crosscountry_hours').value) || 0,
            night_vision_hours: parseFloat(document.getElementById('night_vision_hours').value) || 0,
            instrument_hours: parseFloat(document.getElementById('instrument_hours').value) || 0,
            simulated_instrument_hours: parseFloat(document.getElementById('simulated_instrument_hours').value) || 0,
            ground_instrument_hours: parseFloat(document.getElementById('ground_instrument_hours').value) || 0,
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

        // Make API request
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
            successAlert.textContent = isEditMode
                ? 'Flight updated successfully!'
                : 'Flight added successfully!';
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
