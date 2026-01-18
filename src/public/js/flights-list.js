// Flights list functionality
// Note: checkAuth, setupNavigation, logout, escapeHtml, formatDate, truncate, downloadBlob are provided by common.js

let currentPage = 1;
let totalPages = 1;
let currentFilter = '';
let flightToDelete = null;

document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    checkAuth();

    // Set up navigation
    setupNavigation();

    // Load aircraft types for filter (custom version to preserve "All Aircraft" option)
    loadAircraftTypesForFilter();

    // Set up filters
    setupFilters();

    // Set up pagination
    setupPagination();

    // Set up export
    setupExport();

    // Load flights
    loadFlights();
});

async function loadAircraftTypesForFilter() {
    const select = document.getElementById('aircraftFilter');

    try {
        // Fetch aircraft from API
        const response = await fetch('/api/aircraft');
        const aircraft = response.ok ? await response.json() : [];
        const aircraftNames = aircraft.map(a => a.name);

        // Sort alphabetically
        aircraftNames.sort();

        // Add aircraft options (preserving "All Aircraft" option)
        aircraftNames.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading aircraft types:', error);
        // Show empty filter (just "All Aircraft" option remains)
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
            downloadBlob(blob, `flights_${new Date().toISOString().split('T')[0]}.csv`);

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
            downloadBlob(blob, `logbook-summary_${new Date().toISOString().split('T')[0]}.txt`);

            exportSummaryBtn.disabled = false;
            exportSummaryBtn.textContent = 'Export Summary';
        } catch (error) {
            console.error('Summary export error:', error);
            alert('Failed to export summary');
            exportSummaryBtn.disabled = false;
            exportSummaryBtn.textContent = 'Export Summary';
        }
    });

    // PDF export button
    const exportPdfBtn = document.getElementById('exportPdfBtn');
    if (exportPdfBtn) {
        exportPdfBtn.addEventListener('click', async () => {
            await showPdfExportModal();
        });
    }
}

// PDF Export Modal functionality
async function showPdfExportModal() {
    const modal = document.getElementById('pdfModal');
    const customFieldsList = document.getElementById('pdfCustomFieldsList');
    const noFieldsMsg = document.getElementById('noCustomFieldsMsg');
    const confirmBtn = document.getElementById('confirmPdfExportBtn');
    const cancelBtn = document.getElementById('cancelPdfExportBtn');

    try {
        // Fetch user's custom fields
        const response = await fetch('/api/custom-fields');
        const customFields = response.ok ? await response.json() : [];

        // Build checkbox list
        if (customFields.length > 0) {
            noFieldsMsg.style.display = 'none';
            customFieldsList.innerHTML = customFields.map(cf => `
                <label class="checkbox-label" style="display: block; margin-bottom: 0.5rem; cursor: pointer;">
                    <input type="checkbox" name="pdfCustomField" value="${cf.id}" style="margin-right: 0.5rem;">
                    ${escapeHtml(cf.field_label)}
                </label>
            `).join('');

            // Add event listener to limit to 3 selections
            const checkboxes = customFieldsList.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(cb => {
                cb.addEventListener('change', () => {
                    const checked = customFieldsList.querySelectorAll('input[type="checkbox"]:checked');
                    if (checked.length > 3) {
                        cb.checked = false;
                        alert('You can select up to 3 custom fields.');
                    }
                });
            });
        } else {
            noFieldsMsg.style.display = 'block';
            customFieldsList.querySelectorAll('label').forEach(el => el.remove());
        }

        // Show modal
        modal.classList.remove('hidden');
        modal.style.display = 'flex';

        // Handle confirm button
        confirmBtn.onclick = async () => {
            const selectedFields = [];
            customFieldsList.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
                selectedFields.push(cb.value);
            });

            // Close modal
            closePdfModal();

            // Export PDF
            await exportToPdf(selectedFields);
        };

        // Handle cancel button
        cancelBtn.onclick = () => {
            closePdfModal();
        };

    } catch (error) {
        console.error('Error loading custom fields:', error);
        // If error, just proceed to export without custom fields
        closePdfModal();
        await exportToPdf([]);
    }
}

function closePdfModal() {
    const modal = document.getElementById('pdfModal');
    modal.classList.add('hidden');
    modal.style.display = 'none';
}

async function exportToPdf(fieldIds) {
    const exportPdfBtn = document.getElementById('exportPdfBtn');

    try {
        exportPdfBtn.disabled = true;
        exportPdfBtn.textContent = 'Generating PDF...';

        // Build URL with custom field IDs
        let url = '/api/flights/export/pdf';
        if (fieldIds.length > 0) {
            url += `?fields=${fieldIds.join(',')}`;
        }

        const response = await fetch(url);
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Export failed');
        }

        const blob = await response.blob();
        downloadBlob(blob, `logbook_${new Date().toISOString().split('T')[0]}.pdf`);

        exportPdfBtn.disabled = false;
        exportPdfBtn.textContent = 'Export to PDF';
    } catch (error) {
        console.error('PDF export error:', error);
        alert('Failed to export PDF: ' + error.message);
        exportPdfBtn.disabled = false;
        exportPdfBtn.textContent = 'Export to PDF';
    }
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
            <td class="table-actions">
                <button class="btn btn-small btn-secondary" onclick="duplicateFlight(${flight.id})" title="Duplicate">Dup</button>
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

function duplicateFlight(id) {
    window.location.href = `/add-flight.html?duplicate=${id}`;
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

// Utility functions (formatDate, escapeHtml, truncate, downloadBlob) are provided by common.js
