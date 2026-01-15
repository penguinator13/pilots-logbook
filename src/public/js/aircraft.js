// Aircraft management functionality

let aircraftToDelete = null;

document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    checkAuth();

    // Set up navigation
    setupNavigation();

    // Set up form
    setupForm();

    // Load aircraft
    loadAircraft();
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

function setupForm() {
    const form = document.getElementById('addAircraftForm');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await addAircraft();
    });
}

async function loadAircraft() {
    const loading = document.getElementById('loading');
    const errorAlert = document.getElementById('errorAlert');
    const aircraftContainer = document.getElementById('aircraftContainer');
    const aircraftList = document.getElementById('aircraftList');
    const noAircraft = document.getElementById('noAircraft');

    // Show loading
    loading.classList.remove('hidden');
    aircraftContainer.classList.add('hidden');
    errorAlert.classList.add('hidden');

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

    const html = aircraft.map(item => `
        <div class="aircraft-item">
            <div>
                <div class="aircraft-name">${escapeHtml(item.name)}</div>
                <div class="aircraft-meta">Added ${formatDate(item.created_at)}</div>
            </div>
            <button class="btn btn-small btn-danger" onclick="confirmDelete(${item.id}, '${escapeHtml(item.name)}')">Delete</button>
        </div>
    `).join('');

    aircraftList.innerHTML = html;
}

async function addAircraft() {
    const addBtn = document.getElementById('addBtn');
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

function confirmDelete(id, name) {
    aircraftToDelete = id;
    const modal = document.getElementById('deleteModal');
    modal.style.display = 'flex';

    // Update modal text
    const modalText = modal.querySelector('p');
    modalText.textContent = `Are you sure you want to delete "${name}"? This cannot be undone.`;

    const confirmBtn = document.getElementById('confirmDeleteBtn');
    const cancelBtn = document.getElementById('cancelDeleteBtn');

    confirmBtn.onclick = async () => {
        await deleteAircraft();
    };

    cancelBtn.onclick = () => {
        closeDeleteModal();
    };
}

function closeDeleteModal() {
    const modal = document.getElementById('deleteModal');
    modal.style.display = 'none';
    aircraftToDelete = null;
}

async function deleteAircraft() {
    const confirmBtn = document.getElementById('confirmDeleteBtn');
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
        closeDeleteModal();

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
        closeDeleteModal();
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
