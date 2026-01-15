// Flights list functionality

let currentPage = 1;
let totalPages = 1;
let currentFilter = '';
let flightToDelete = null;

document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    checkAuth();

    // Set up navigation
    setupNavigation();

    // Load aircraft types for filter
    loadAircraftTypes();

    // Set up filters
    setupFilters();

    // Set up pagination
    setupPagination();

    // Set up export
    setupExport();

    // Load flights
    loadFlights();
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
    const select = document.getElementById('aircraftFilter');

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

        // Preserve "All Aircraft" option and add all aircraft
        const currentHTML = select.innerHTML;
        allAircraft.forEach(aircraft => {
            const option = document.createElement('option');
            option.value = aircraft;
            option.textContent = aircraft;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading aircraft types:', error);
        // Fall back to defaults only
        defaults.forEach(aircraft => {
            const option = document.createElement('option');
            option.value = aircraft;
            option.textContent = aircraft;
            select.appendChild(option);
        });
    }
}

function setupFilters() {
    const aircraftFilter = document.getElementById('aircraftFilter');
    aircraftFilter.addEventListener('change', () => {
        currentFilter = aircraftFilter.value;
        currentPage = 1;
        loadFlights();
    });
}

function setupPagination() {
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');

    prevBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            loadFlights();
        }
    });

    nextBtn.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            loadFlights();
        }
    });
}

function setupExport() {
    const exportBtn = document.getElementById('exportBtn');
    exportBtn.addEventListener('click', async () => {
        try {
            exportBtn.disabled = true;
            exportBtn.textContent = 'Exporting...';

            const url = currentFilter
                ? `/api/flights/export/csv?aircraft_type=${encodeURIComponent(currentFilter)}`
                : '/api/flights/export/csv';

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Export failed');
            }

            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `flights_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(downloadUrl);

            exportBtn.disabled = false;
            exportBtn.textContent = 'Export to CSV';
        } catch (error) {
            console.error('Export error:', error);
            alert('Failed to export flights');
            exportBtn.disabled = false;
            exportBtn.textContent = 'Export to CSV';
        }
    });

    // Summary export button
    const exportSummaryBtn = document.getElementById('exportSummaryBtn');
    exportSummaryBtn.addEventListener('click', async () => {
        try {
            exportSummaryBtn.disabled = true;
            exportSummaryBtn.textContent = 'Exporting...';

            const response = await fetch('/api/flights/export/summary');
            if (!response.ok) {
                throw new Error('Export failed');
            }

            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `logbook-summary_${new Date().toISOString().split('T')[0]}.txt`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(downloadUrl);

            exportSummaryBtn.disabled = false;
            exportSummaryBtn.textContent = 'Export Summary';
        } catch (error) {
            console.error('Summary export error:', error);
            alert('Failed to export summary');
            exportSummaryBtn.disabled = false;
            exportSummaryBtn.textContent = 'Export Summary';
        }
    });
}

async function loadFlights() {
    const loading = document.getElementById('loading');
    const errorAlert = document.getElementById('errorAlert');
    const flightsContainer = document.getElementById('flightsContainer');
    const noFlights = document.getElementById('noFlights');
    const tableBody = document.getElementById('flightsTableBody');

    // Show loading
    loading.classList.remove('hidden');
    flightsContainer.classList.add('hidden');
    errorAlert.classList.add('hidden');

    try {
        // Build URL with pagination and filter
        let url = `/api/flights?page=${currentPage}&limit=20`;
        if (currentFilter) {
            url += `&aircraft_type=${encodeURIComponent(currentFilter)}`;
        }

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Failed to load flights');
        }

        const data = await response.json();

        // Update pagination info
        totalPages = data.totalPages;
        currentPage = data.currentPage;
        updatePaginationUI();

        // Hide loading, show content
        loading.classList.add('hidden');
        flightsContainer.classList.remove('hidden');

        if (data.flights.length === 0) {
            tableBody.innerHTML = '';
            noFlights.classList.remove('hidden');
        } else {
            noFlights.classList.add('hidden');
            displayFlights(data.flights);
        }

    } catch (error) {
        console.error('Load flights error:', error);
        loading.classList.add('hidden');
        errorAlert.textContent = 'Failed to load flights. Please try again.';
        errorAlert.classList.remove('hidden');
    }
}

function displayFlights(flights) {
    const tableBody = document.getElementById('flightsTableBody');

    const html = flights.map(flight => `
        <tr>
            <td>${formatDate(flight.date)}</td>
            <td>${escapeHtml(flight.aircraft_type)}</td>
            <td class="registration-cell">${escapeHtml(flight.registration || '-')}</td>
            <td>${escapeHtml(truncate(flight.route || '-', 40))}</td>
            <td>${flight.flight_time.toFixed(1)} hrs</td>
            <td>${escapeHtml(flight.flight_type)}</td>
            <td class="table-actions">
                <button class="btn btn-small btn-secondary" onclick="editFlight(${flight.id})">Edit</button>
                <button class="btn btn-small btn-danger" onclick="confirmDelete(${flight.id})">Delete</button>
            </td>
        </tr>
    `).join('');

    tableBody.innerHTML = html;
}

function updatePaginationUI() {
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const pageInfo = document.getElementById('pageInfo');

    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage === totalPages || totalPages === 0;
    pageInfo.textContent = `Page ${currentPage} of ${totalPages || 1}`;
}

function editFlight(id) {
    window.location.href = `/edit-flight.html?id=${id}`;
}

function confirmDelete(id) {
    flightToDelete = id;
    const modal = document.getElementById('deleteModal');
    modal.classList.remove('hidden');
    modal.style.display = 'flex';

    const confirmBtn = document.getElementById('confirmDeleteBtn');
    const cancelBtn = document.getElementById('cancelDeleteBtn');

    confirmBtn.onclick = async () => {
        await deleteFlight();
    };

    cancelBtn.onclick = () => {
        closeDeleteModal();
    };
}

function closeDeleteModal() {
    const modal = document.getElementById('deleteModal');
    modal.classList.add('hidden');
    modal.style.display = 'none';
    flightToDelete = null;
}

async function deleteFlight() {
    const confirmBtn = document.getElementById('confirmDeleteBtn');
    const errorAlert = document.getElementById('errorAlert');
    const successAlert = document.getElementById('successAlert');

    try {
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Deleting...';

        const response = await fetch(`/api/flights/${flightToDelete}`, {
            method: 'DELETE',
        });

        if (!response.ok) {
            throw new Error('Failed to delete flight');
        }

        // Close modal
        closeDeleteModal();

        // Show success message
        successAlert.textContent = 'Flight deleted successfully';
        successAlert.classList.remove('hidden');
        setTimeout(() => {
            successAlert.classList.add('hidden');
        }, 3000);

        // Reload flights
        await loadFlights();

    } catch (error) {
        console.error('Delete error:', error);
        closeDeleteModal();
        errorAlert.textContent = 'Failed to delete flight. Please try again.';
        errorAlert.classList.remove('hidden');
        setTimeout(() => {
            errorAlert.classList.add('hidden');
        }, 3000);
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Delete';
    }
}

// Utility functions
function formatDate(dateString) {
    // Parse as local date to avoid timezone shift (dateString is YYYY-MM-DD)
    const [year, month, day] = dateString.split('-');
    const date = new Date(year, month - 1, day);
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

function truncate(text, maxLength) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}
