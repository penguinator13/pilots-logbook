// Login page functionality

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const errorAlert = document.getElementById('errorAlert');
    const submitBtn = document.getElementById('submitBtn');

    // Handle form submission
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Clear previous errors
        hideError();

        // Get form data
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;

        // Validate
        if (!username || !password) {
            showError('Please enter both username and password');
            return;
        }

        // Disable submit button
        submitBtn.disabled = true;
        submitBtn.textContent = 'Logging in...';

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json();

            if (response.ok) {
                // Login successful - redirect to dashboard
                window.location.href = '/dashboard.html';
            } else {
                // Login failed
                showError(data.error || 'Login failed. Please check your credentials.');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Login';
            }
        } catch (error) {
            console.error('Login error:', error);
            showError('Network error. Please try again.');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Login';
        }
    });

    // Helper functions
    function showError(message) {
        errorAlert.textContent = message;
        errorAlert.classList.remove('hidden');
    }

    function hideError() {
        errorAlert.classList.add('hidden');
        errorAlert.textContent = '';
    }
});
