# Multi-stage build for OpenAgent Framework

# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/*/package*.json ./packages/*/

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine

# Install security updates
RUN apk update && apk upgrade && \
    apk add --no-cache dumb-init && \
    rm -rf /var/cache/apk/*

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S openagent && \
    adduser -S openagent -u 1001 -G openagent

# Copy built files from builder
COPY --from=builder --chown=openagent:openagent /app/package*.json ./
COPY --from=builder --chown=openagent:openagent /app/node_modules ./node_modules
COPY --from=builder --chown=openagent:openagent /app/dist ./dist
COPY --from=builder --chown=openagent:openagent /app/prisma ./prisma

# Copy additional required files
COPY --from=builder --chown=openagent:openagent /app/packages ./packages

# Set environment variables
ENV NODE_ENV=production \
    PORT=3000 \
    LOG_LEVEL=info

# Switch to non-root user
USER openagent

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "dist/index.js"]
