/**
 * Admin Page JavaScript
 * Handles admin page functionality and user info display
 */

// Load user info on page load
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('/admin/api/check');
        const data = await response.json();

        if (data.isAdmin && data.user) {
            // Display user info
            document.getElementById('adminEmail').textContent = data.user.email;
            document.getElementById('adminRole').textContent = data.user.role;
        } else {
            // Not admin - redirect to home
            window.location.href = '/';
        }
    } catch (error) {
        console.error('Failed to load admin info:', error);
        // Redirect to home on error
        window.location.href = '/';
    }
});
