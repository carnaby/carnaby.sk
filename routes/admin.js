const express = require('express');
const path = require('path');
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

module.exports = router;
