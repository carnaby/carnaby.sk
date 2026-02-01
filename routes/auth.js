const express = require('express');
const passport = require('passport');
const router = express.Router();

// Initiate Google OAuth
router.get('/google',
    passport.authenticate('google', {
        scope: ['profile', 'email']
    })
);

// Google OAuth callback
router.get('/google/callback',
    passport.authenticate('google', {
        failureRedirect: '/?error=auth_failed'
    }),
    (req, res) => {
        // Successful authentication
        console.log(`✅ User authenticated: ${req.user.email}`);
        res.redirect('/');
    }
);

// Logout
router.get('/logout', (req, res) => {
    const userEmail = req.user?.email;
    req.logout((err) => {
        if (err) {
            console.error('❌ Logout error:', err);
            return res.status(500).json({ error: 'Logout failed' });
        }
        console.log(`✅ User logged out: ${userEmail}`);
        res.redirect('/');
    });
});

// Get current user (API endpoint for frontend)
router.get('/user', (req, res) => {
    if (req.isAuthenticated()) {
        res.json({
            authenticated: true,
            user: {
                id: req.user.id,
                email: req.user.email,
                displayName: req.user.display_name,
                avatarUrl: req.user.avatar_url,
                role: req.user.role
            }
        });
    } else {
        res.json({ authenticated: false });
    }
});

module.exports = router;
