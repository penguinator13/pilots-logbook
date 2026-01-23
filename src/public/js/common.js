// Common shared utilities for the pilot's logbook application

/**
 * Check if user is authenticated, redirect to login if not
 */
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

/**
 * Set up navigation event listeners (mobile toggle and logout)
 */
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

/**
 * Log out the current user
 */
async function logout() {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/login.html';
    } catch (error) {
        console.error('Logout error:', error);
        window.location.href = '/login.html';
    }
}

/**
 * Escape HTML entities to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Format a date string for display
 * @param {string} dateString - Date string in YYYY-MM-DD or YYYY-MM-DD HH:MM:SS format
 * @returns {string} Formatted date string
 */
function formatDate(dateString) {
    if (!dateString) return 'Unknown';
    // Extract just the date portion (handles both YYYY-MM-DD and YYYY-MM-DD HH:MM:SS)
    const datePart = dateString.split(' ')[0];
    const parts = datePart.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
            const date = new Date(year, month, day);
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        }
    }
    // Handle other datetime formats
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Unknown';
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

/**
 * Truncate text to a maximum length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text with ellipsis if needed
 */
function truncate(text, maxLength) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

/**
 * Get today's date in YYYY-MM-DD format using local timezone
 * @returns {string} Today's date in YYYY-MM-DD format
 */
function getLocalDateString() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Download a blob as a file
 * @param {Blob} blob - The blob to download
 * @param {string} filename - The filename to use
 */
function downloadBlob(blob, filename) {
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(downloadUrl);
}

/**
 * Show a temporary alert message that auto-hides
 * @param {HTMLElement} alertElement - The alert element to show
 * @param {string} message - The message to display
 * @param {number} duration - Duration in ms before hiding (default 3000)
 */
function showTemporaryAlert(alertElement, message, duration = 3000) {
    alertElement.textContent = message;
    alertElement.classList.remove('hidden');
    setTimeout(() => {
        alertElement.classList.add('hidden');
    }, duration);
}

/**
 * Show a toast notification
 * @param {string} message - The message to display
 * @param {string} type - Type of toast: 'success', 'error', or 'warning' (default 'success')
 * @param {number} duration - Duration in ms before auto-dismiss (default 3000)
 */
function showToast(message, type = 'success', duration = 3000) {
    // Create container if it doesn't exist
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    // Remove after duration
    setTimeout(() => {
        toast.remove();
        // Remove container if empty
        if (container.children.length === 0) {
            container.remove();
        }
    }, duration);
}

/**
 * Load aircraft types from the API
 * @param {HTMLSelectElement} selectElement - The select element to populate
 * @param {string} placeholder - Optional placeholder text (default "Select aircraft type")
 * @returns {Promise<string[]>} Array of aircraft names
 */
async function loadAircraftTypes(selectElement, placeholder = 'Select aircraft type') {
    try {
        const response = await fetch('/api/aircraft');
        const aircraft = response.ok ? await response.json() : [];
        const aircraftNames = aircraft.map(a => a.name);

        // Sort alphabetically
        aircraftNames.sort();

        // Clear existing options and add placeholder
        selectElement.innerHTML = `<option value="">${placeholder}</option>`;

        // Add all aircraft
        aircraftNames.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            selectElement.appendChild(option);
        });

        return aircraftNames;
    } catch (error) {
        console.error('Error loading aircraft types:', error);
        selectElement.innerHTML = `<option value="">${placeholder}</option>`;
        return [];
    }
}
