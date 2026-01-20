/**
 * Authentication Middleware
 * Protects routes that require authentication
 */

// Middleware to check if user is authenticated
function isAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).json({ error: 'Unauthorized' });
}

// Middleware to check if user is admin (example for future use)
function isAdmin(req, res, next) {
    if (req.isAuthenticated() && req.user.is_admin) {
        return next();
    }
    res.status(403).json({ error: 'Forbidden' });
}

module.exports = { isAuthenticated, isAdmin };
