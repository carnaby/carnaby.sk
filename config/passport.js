// Load environment variables from .env file
require('dotenv').config();

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

// Initialize passport with database connection
// This function is called from server.js after database is ready
function initializePassport(db) {
    // Serialize user to session (store only user ID)
    passport.serializeUser((user, done) => {
        done(null, user.id);
    });

    // Deserialize user from session (fetch full user from DB)
    passport.deserializeUser((id, done) => {
        try {
            const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
            done(null, user);
        } catch (error) {
            done(error, null);
        }
    });

    // Google OAuth Strategy
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            // Check if user exists
            let user = db.prepare('SELECT * FROM users WHERE google_id = ?').get(profile.id);

            if (user) {
                // Update last login
                db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
                console.log(`✅ User logged in: ${user.email}`);
            } else {
                // Create new user (JIT provisioning)
                const result = db.prepare(`
                    INSERT INTO users (google_id, email, display_name, avatar_url)
                    VALUES (?, ?, ?, ?)
                `).run(
                    profile.id,
                    profile.emails[0].value,
                    profile.displayName,
                    profile.photos[0]?.value || null
                );

                user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
                console.log(`✅ New user created: ${user.email}`);
            }

            done(null, user);
        } catch (error) {
            console.error('❌ OAuth error:', error);
            done(error, null);
        }
    }));

    return passport;
}

module.exports = initializePassport;
