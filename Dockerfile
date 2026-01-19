# Multi-stage Dockerfile for carnaby.sk
# Optimized for Synology NAS deployment

# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
# Using npm ci for reproducible builds with exact versions from package-lock.json
RUN npm ci --omit=dev && npm cache clean --force

# Stage 2: Builder (initialize database)
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package files and install all dependencies (including dev)
COPY package*.json ./
RUN npm ci

# Copy application files
COPY . .

# Initialize database with sample data
RUN node init-db.js

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app

# Set to production
ENV NODE_ENV=production

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application files
COPY --chown=appuser:nodejs . .

# Copy initialized database from builder
COPY --from=builder --chown=appuser:nodejs /app/videos.db ./videos.db

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
CMD ["node", "server.js"]
