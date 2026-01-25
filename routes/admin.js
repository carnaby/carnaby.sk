const express = require('express');
const path = require('path');

module.exports = (pool) => {
    const router = express.Router();
    const { isAdmin } = require('../middleware/admin');

    /**
     * Admin Routes
     * All routes in this file require admin access
     */

    // Admin page
    router.get('/', isAdmin, (req, res) => {
        res.sendFile(path.join(__dirname, '..', 'admin.html'));
    });

    // Posts management page
    router.get('/posts', isAdmin, (req, res) => {
        res.sendFile(path.join(__dirname, '..', 'admin-posts.html'));
    });

    // New post page
    router.get('/posts/new', isAdmin, (req, res) => {
        res.sendFile(path.join(__dirname, '..', 'admin-post-editor.html'));
    });

    // Edit post page
    router.get('/posts/:id/edit', isAdmin, (req, res) => {
        res.sendFile(path.join(__dirname, '..', 'admin-post-editor.html'));
    });

    // Users management page
    router.get('/users', isAdmin, (req, res) => {
        res.sendFile(path.join(__dirname, '..', 'admin-users.html'));
    });

    // API: Check if current user is admin
    router.get('/api/check', (req, res) => {
        res.json({
            isAdmin: req.isAuthenticated() && req.user && req.user.role === 'admin',
            user: req.isAuthenticated() ? {
                email: req.user.email,
                displayName: req.user.display_name,
                role: req.user.role
            } : null
        });
    });

    // API: Get all users
    router.get('/api/users', isAdmin, async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT id, email, display_name, avatar_url, role, created_at, last_login 
                FROM users 
                ORDER BY created_at DESC
            `);

            res.json({
                success: true,
                data: result.rows
            });
        } catch (error) {
            console.error('Error fetching users:', error);
            res.status(500).json({ success: false, error: 'Database error' });
        }
    });

    return router;
};
