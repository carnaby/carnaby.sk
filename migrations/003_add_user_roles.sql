-- Add role column to users table
-- Enables role-based access control (admin vs user)

ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'user';

-- Create index for role lookups
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Set dodusik@gmail.com as admin
-- Note: This will only work if the user already exists
-- If user doesn't exist yet, they'll be set as admin on first login (see passport.js)
UPDATE users SET role = 'admin' WHERE email = 'dodusik@gmail.com';
