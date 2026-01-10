# =============================================================================
# OurChat Backend - Production Dockerfile
# Multi-stage build: Dependencies → Build → Production
# =============================================================================

# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app

# Install pnpm and build dependencies
RUN apk add --no-cache python3 make g++ && npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/ ./packages/

# Install all dependencies (including devDependencies for build)
RUN pnpm install --frozen-lockfile

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=deps /app/packages ./packages

# Copy source code
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/ ./apps/backend/

# Generate Prisma client
RUN cd apps/backend && pnpm prisma generate

# Build NestJS application
RUN cd apps/backend && pnpm build

# Stage 3: Production
FROM node:20-alpine AS production
WORKDIR /app

# Install pnpm and timezone support
RUN apk add --no-cache tzdata && npm install -g pnpm

# Set timezone
ENV TZ=Asia/Tokyo
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json ./apps/backend/

# Install production dependencies only (skip prepare script which needs husky)
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

# Copy built application
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist

# Copy Prisma client - need both the generated client AND the runtime
# The generated client (.prisma) references @prisma/client/runtime/library.js
# pnpm hoists packages in .pnpm directory, copy from there
COPY --from=builder /app/node_modules/.pnpm/@prisma+client@*/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/.pnpm/@prisma+client@*/node_modules/@prisma ./node_modules/@prisma

# Copy Prisma schema for migrations
COPY apps/backend/prisma ./apps/backend/prisma

# Set production environment
ENV NODE_ENV=production
ENV PORT=4000

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/health || exit 1

# Run the application
WORKDIR /app/apps/backend
CMD ["node", "dist/main.js"]
