/**
 * Admin Middleware
 * Protects routes that require admin access
 */

function isAuthenticated(req, res, next) {
    if (!req.isAuthenticated()) {
        if (req.accepts('html')) {
            return res.redirect('/login');
        }
        return res.status(401).json({
            error: 'Not authenticated',
            message: 'Please log in to access this resource'
        });
    }
    next();
}

function isAdmin(req, res, next) {
    if (!req.isAuthenticated()) {
        if (req.accepts('html')) {
            return res.redirect('/login');
        }
        return res.status(401).json({
            error: 'Not authenticated',
            message: 'Please log in to access this resource'
        });
    }

    if (req.user.role !== 'admin') {
        if (req.accepts('html')) {
            return res.status(403).send('Forbidden: Admin access required');
        }
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
