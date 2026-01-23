// Dashboard functionality
// Note: checkAuth, setupNavigation, logout, escapeHtml, formatDate, truncate are provided by common.js

document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    checkAuth();

    // Set up navigation
    setupNavigation();

    // Load dashboard data
    loadDashboard();
});

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

        // Initialize charts
        createHoursOverTimeChart(stats.cumulativeHours);
        createAircraftChart(stats.byAircraft);
        createMonthlyActivityChart(stats.monthlyActivity);

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
    document.getElementById('groundTimeHours').textContent = (stats.groundTimeHours || 0).toFixed(1);
}

function displayAircraftBreakdown(aircraftData) {
    const container = document.getElementById('aircraftBreakdown');

    if (!aircraftData || aircraftData.length === 0) {
        container.innerHTML = '<p class="text-muted">No aircraft data available</p>';
        return;
    }

    // Sort by hours (descending)
    const sorted = aircraftData.sort((a, b) => b.hours - a.hours);

    const html = sorted.map(item => {
        const isSimulator = item.aircraft_category === 'Simulator';
        const categoryLabel = isSimulator ? ' (Sim)' : '';
        return `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; border-bottom: 1px solid var(--border);">
            <div>
                <span style="font-weight: 600; color: var(--text-primary);">${escapeHtml(item.aircraft_type)}${categoryLabel}</span>
                <span style="font-size: 0.875rem; color: var(--text-secondary); margin-left: 0.5rem;">
                    ${item.flights} ${isSimulator ? 'session' : 'flight'}${item.flights !== 1 ? 's' : ''}
                </span>
            </div>
            <div style="font-weight: 700; color: ${isSimulator ? 'var(--text-secondary)' : 'var(--primary-color)'};">
                ${item.hours.toFixed(1)} hrs
            </div>
        </div>
    `;
    }).join('');

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

// Utility functions (formatDate, escapeHtml, truncate) are provided by common.js

// ==================== CHART FUNCTIONS ====================

/**
 * Get theme-aware colors for charts
 */
function getChartColors() {
    const style = getComputedStyle(document.documentElement);
    return {
        primary: style.getPropertyValue('--primary-color').trim() || '#2563eb',
        text: style.getPropertyValue('--text-secondary').trim() || '#64748b',
        textMuted: style.getPropertyValue('--text-muted').trim() || '#94a3b8',
        border: style.getPropertyValue('--border').trim() || '#e2e8f0',
        surface: style.getPropertyValue('--surface').trim() || '#ffffff'
    };
}

/**
 * Generate color palette for charts
 */
function generateChartPalette(count) {
    const baseColors = [
        '#2563eb', // blue
        '#16a34a', // green
        '#dc2626', // red
        '#f59e0b', // amber
        '#8b5cf6', // purple
        '#06b6d4', // cyan
        '#ec4899', // pink
        '#84cc16', // lime
        '#f97316', // orange
        '#6366f1'  // indigo
    ];
    const colors = [];
    for (let i = 0; i < count; i++) {
        colors.push(baseColors[i % baseColors.length]);
    }
    return colors;
}

/**
 * Create cumulative hours over time line chart
 */
function createHoursOverTimeChart(data) {
    const canvas = document.getElementById('hoursOverTimeChart');
    if (!canvas) return;

    if (!data || data.length === 0) {
        canvas.parentElement.innerHTML = '<h3>Hours Over Time</h3><div class="chart-empty">No flight data available</div>';
        return;
    }

    const colors = getChartColors();
    const labels = data.map(d => {
        const [year, month] = d.month.split('-');
        return new Date(year, month - 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    });
    const values = data.map(d => d.totalHours);

    new Chart(canvas, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Total Hours',
                data: values,
                borderColor: colors.primary,
                backgroundColor: colors.primary + '20',
                fill: true,
                tension: 0.3,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `${ctx.parsed.y.toFixed(1)} hours`
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: colors.border
                    },
                    ticks: {
                        color: colors.text
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: colors.border
                    },
                    ticks: {
                        color: colors.text,
                        callback: (val) => val + ' hrs'
                    }
                }
            }
        }
    });
}

/**
 * Create aircraft hours doughnut chart
 */
function createAircraftChart(data) {
    const canvas = document.getElementById('aircraftChart');
    if (!canvas) return;

    // Filter out simulator entries and zero-hour aircraft
    const filteredData = (data || []).filter(d => d.aircraft_category !== 'Simulator' && d.hours > 0);

    if (filteredData.length === 0) {
        canvas.parentElement.innerHTML = '<h3>Hours by Aircraft</h3><div class="chart-empty">No flight data available</div>';
        return;
    }

    const colors = getChartColors();
    const palette = generateChartPalette(filteredData.length);
    const labels = filteredData.map(d => d.aircraft_type);
    const values = filteredData.map(d => d.hours);

    new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: palette,
                borderColor: colors.surface,
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        color: colors.text,
                        padding: 12,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                            const pct = ((ctx.parsed / total) * 100).toFixed(1);
                            return `${ctx.label}: ${ctx.parsed.toFixed(1)} hrs (${pct}%)`;
                        }
                    }
                }
            }
        }
    });
}

/**
 * Create monthly activity bar chart
 */
function createMonthlyActivityChart(data) {
    const canvas = document.getElementById('monthlyChart');
    if (!canvas) return;

    if (!data || data.length === 0) {
        canvas.parentElement.innerHTML = '<h3>Monthly Activity</h3><div class="chart-empty">No flight data available</div>';
        return;
    }

    const colors = getChartColors();
    const labels = data.map(d => {
        const [year, month] = d.month.split('-');
        return new Date(year, month - 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    });
    const hoursData = data.map(d => d.hours);
    const flightsData = data.map(d => d.flights);

    new Chart(canvas, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Hours',
                data: hoursData,
                backgroundColor: colors.primary + 'cc',
                borderColor: colors.primary,
                borderWidth: 1,
                yAxisID: 'y'
            }, {
                label: 'Flights',
                data: flightsData,
                backgroundColor: '#16a34a' + 'cc',
                borderColor: '#16a34a',
                borderWidth: 1,
                yAxisID: 'y1'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: colors.text
                    }
                },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            if (ctx.datasetIndex === 0) {
                                return `Hours: ${ctx.parsed.y.toFixed(1)}`;
                            }
                            return `Flights: ${ctx.parsed.y}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: colors.border
                    },
                    ticks: {
                        color: colors.text
                    }
                },
                y: {
                    type: 'linear',
                    position: 'left',
                    beginAtZero: true,
                    grid: {
                        color: colors.border
                    },
                    ticks: {
                        color: colors.text,
                        callback: (val) => val + ' hrs'
                    },
                    title: {
                        display: true,
                        text: 'Hours',
                        color: colors.text
                    }
                },
                y1: {
                    type: 'linear',
                    position: 'right',
                    beginAtZero: true,
                    grid: {
                        drawOnChartArea: false
                    },
                    ticks: {
                        color: colors.text,
                        stepSize: 1
                    },
                    title: {
                        display: true,
                        text: 'Flights',
                        color: colors.text
                    }
                }
            }
        }
    });
}
