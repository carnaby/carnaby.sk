# Multi-stage Dockerfile for carnaby.sk
# Optimized for Synology NAS deployment with persistent SQLite database

# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app

# Copy package files (explicit copy for both files)
COPY package.json package-lock.json ./

# Install production dependencies only
# Using npm ci for reproducible builds with exact versions from package-lock.json
RUN npm ci --omit=dev && npm cache clean --force

# Stage 2: Runner
FROM node:20-alpine AS runner
WORKDIR /app

# Set to production
ENV NODE_ENV=production

# Create non-root user for security (UID/GID will be overridden by docker-compose)
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application files
COPY --chown=appuser:nodejs . .

# Create data directory for database (will be mounted as volume)
RUN mkdir -p /app/data && \
    chown -R appuser:nodejs /app/data

# Create backups directory (will be mounted to Google Drive sync folder)
RUN mkdir -p /app/backups && \
    chown -R appuser:nodejs /app/backups

# Create cache directory with world-write permissions (so user 1026 can write)
RUN mkdir -p /app/public/cache && \
    chmod 777 /app/public/cache

# Minify CSS at build time
RUN node -e "require('./services/css-minifier').minifyCSS()"

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application (migrations run automatically in server.js)
CMD ["node", "server.js"]
