# Commit 14: Admin Dashboard & PostgreSQL Migration (Work In Progress)

**Date:** 2026-01-24
**Status:** In Progress / Uncommitted
**Complexity:** High (Database migration, Admin UI, RBAC)

## Context
Continuing from the Google OAuth implementation, the project has evolved to include a comprehensive Administration Dashboard for managing content (posts/videos) and a major infrastructure shift from SQLite to PostgreSQL to support more robust data handling and analytics.

## Key Changes

### 1. Database Migration: SQLite → PostgreSQL
**Why?**
The project migrated from SQLite to PostgreSQL without losing data.
- **Scalability**: PostgreSQL handles concurrent writes better than SQLite.
- **Architecture**: Unified database for both the Web App and Umami Analytics.
- **Consistency**: Uses `connect-pg-simple` for session storage.

**Technical Details:**
- `package.json`: Added `pg`, `connect-pg-simple`.
- `server.js`: Replaced `better-sqlite3` with `pg.Pool`.
- `docker-compose.yml`: Added `postgres:15-alpine` service.

### 2. Admin Dashboard
A new private section for content management, accessible only to users with `role = 'admin'`.

**Features:**
- **Post Management**: CRUD operations for blog posts/videos.
- **Categories**: Assign categories to posts.
- **Media Handling**:
    - Automatic YouTube thumbnail download.
    - Custom thumbnail upload.
- **Markdown Editor**: Integrated editor for post content.

**New Files:**
- `admin.html` / `admin.js`: Dashboard entry point.
- `admin-posts.html`: Post listing and management interface.
- `admin-post-editor.html`: Editor interface.
- `routes/admin.js`: Backend routes for admin actions.

### 3. Role-Based Access Control (RBAC)
- **Database**: Added `role` column to `users` table.
- **Middleware**: Endpoints protected by `req.user.role === 'admin'` check.
- **Frontend**: Admin menu item visible only to admin users.

### 4. Database Migrations System
Updated migration system to work with PostgreSQL.
- `migrations/003_add_user_roles.sql`: Adds roles.
- `migrations/004_create_categories.sql`: Enhanced category management.
- `migrations/005_create_posts.sql`: New schema for posts/videos.

## Next Steps
- Finalize UI polish for the Admin section.
- Complete testing of the PostgreSQL deployment.
- Commit and deploy via CI/CD.
