// Load environment variables from .env file
require('dotenv').config();

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

// Initialize passport with database pool
// This function is called from server.js after database is ready
function initializePassport(pool) {
    // Serialize user to session (store only user ID)
    passport.serializeUser((user, done) => {
        done(null, user.id);
    });

    // Deserialize user from session (fetch full user from DB)
    passport.deserializeUser(async (id, done) => {
        try {
            const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
            done(null, result.rows[0]);
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
            let result = await pool.query('SELECT * FROM users WHERE google_id = $1', [profile.id]);
            let user = result.rows[0];

            if (user) {
                // Update last login
                await pool.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
                console.log(`✅ User logged in: ${user.email}`);
            } else {
                // Create new user (JIT provisioning)
                // Set role to 'admin' for dodusik@gmail.com, otherwise 'user'
                const role = profile.emails[0].value === 'dodusik@gmail.com' ? 'admin' : 'user';

                result = await pool.query(`
                    INSERT INTO users (google_id, email, display_name, avatar_url, role)
                    VALUES ($1, $2, $3, $4, $5)
                    RETURNING *
                `, [
                    profile.id,
                    profile.emails[0].value,
                    profile.displayName,
                    profile.photos[0]?.value || null,
                    role
                ]);

                user = result.rows[0];
                console.log(`✅ New user created: ${user.email} (role: ${user.role})`);
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
