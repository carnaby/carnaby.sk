/**
 * Admin Middleware
 * Protects routes that require admin access
 */

function isAuthenticated(req, res, next) {
    if (!req.isAuthenticated()) {
        return res.status(401).json({
            error: 'Not authenticated',
            message: 'Please log in to access this resource'
        });
    }
    next();
}

function isAdmin(req, res, next) {
    if (!req.isAuthenticated()) {
        return res.status(401).json({
            error: 'Not authenticated',
            message: 'Please log in to access this resource'
        });
    }

    if (req.user.role !== 'admin') {
        return res.status(403).json({
            error: 'Forbidden',
            message: 'Admin access required'
        });
    }

    next();
}

module.exports = {
    isAuthenticated,
    isAdmin
};
