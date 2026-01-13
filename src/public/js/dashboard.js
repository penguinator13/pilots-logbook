// Dashboard functionality

document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    checkAuth();

    // Set up navigation
    setupNavigation();

    // Load dashboard data
    loadDashboard();
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

async function loadDashboard() {
    const loading = document.getElementById('loading');
    const errorAlert = document.getElementById('errorAlert');
    const statsContainer = document.getElementById('statsContainer');

    try {
        // Fetch summary stats
        const statsResponse = await fetch('/api/flights/stats/summary');
        if (!statsResponse.ok) {
            throw new Error('Failed to load statistics');
        }
        const stats = await statsResponse.json();

        // Fetch recent flights
        const flightsResponse = await fetch('/api/flights?limit=10');
        if (!flightsResponse.ok) {
            throw new Error('Failed to load recent flights');
        }
        const flightsData = await flightsResponse.json();

        // Hide loading, show content
        loading.classList.add('hidden');
        statsContainer.classList.remove('hidden');

        // Display statistics
        displayStats(stats);
        displayAircraftBreakdown(stats.byAircraft);
        displayRecentFlights(flightsData.flights);

    } catch (error) {
        console.error('Dashboard load error:', error);
        loading.classList.add('hidden');
        errorAlert.textContent = 'Failed to load dashboard data. Please try again.';
        errorAlert.classList.remove('hidden');
    }
}

function displayStats(stats) {
    document.getElementById('totalHours').textContent = stats.totalHours.toFixed(1);
    document.getElementById('totalFlights').textContent = stats.totalFlights;
    document.getElementById('dayHours').textContent = stats.totalDayHours.toFixed(1);
    document.getElementById('nightHours').textContent = stats.totalNightHours.toFixed(1);
    document.getElementById('dualHours').textContent = stats.totalDualHours.toFixed(1);
    document.getElementById('picHours').textContent = stats.totalPicHours.toFixed(1);
}

function displayAircraftBreakdown(aircraftData) {
    const container = document.getElementById('aircraftBreakdown');

    if (!aircraftData || aircraftData.length === 0) {
        container.innerHTML = '<p class="text-muted">No aircraft data available</p>';
        return;
    }

    // Sort by hours (descending)
    const sorted = aircraftData.sort((a, b) => b.hours - a.hours);

    const html = sorted.map(item => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; border-bottom: 1px solid var(--border);">
            <div>
                <span style="font-weight: 600; color: var(--text-primary);">${escapeHtml(item.aircraft_type)}</span>
                <span style="font-size: 0.875rem; color: var(--text-secondary); margin-left: 0.5rem;">
                    ${item.flights} flight${item.flights !== 1 ? 's' : ''}
                </span>
            </div>
            <div style="font-weight: 700; color: var(--primary-color);">
                ${item.hours.toFixed(1)} hrs
            </div>
        </div>
    `).join('');

    container.innerHTML = html;
}

function displayRecentFlights(flights) {
    const container = document.getElementById('recentFlightsContainer');

    if (!flights || flights.length === 0) {
        container.innerHTML = '<p class="text-muted">No flights recorded yet</p>';
        return;
    }

    const html = `
        <ul class="recent-flights-list">
            ${flights.map(flight => `
                <li class="recent-flight-item">
                    <div class="flight-info">
                        <div class="flight-date">${formatDate(flight.date)}</div>
                        <div class="flight-details">
                            ${escapeHtml(flight.aircraft_type)}
                            ${flight.registration ? ` - ${escapeHtml(flight.registration)}` : ''}
                            ${flight.route ? ` - ${escapeHtml(truncate(flight.route, 50))}` : ''}
                        </div>
                    </div>
                    <div class="flight-hours">${flight.flight_time.toFixed(1)} hrs</div>
                </li>
            `).join('')}
        </ul>
    `;

    container.innerHTML = html;
}

// Utility functions
function formatDate(dateString) {
    const date = new Date(dateString);
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
