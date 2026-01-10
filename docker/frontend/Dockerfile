# =============================================================================
# OurChat Frontend - Production Dockerfile
# Multi-stage build: Node.js build → Nginx serve
# =============================================================================

# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ ./packages/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages

# Copy source files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY src/ ./src/
COPY public/ ./public/
COPY scripts/ ./scripts/
COPY next.config.js ./
COPY tsconfig.json ./
COPY tailwind.config.ts ./
COPY postcss.config.mjs ./
COPY components.json ./

# Build arguments for environment variables
ARG NEXT_PUBLIC_GRAPHQL_HTTP_URL
ARG NEXT_PUBLIC_GRAPHQL_WS_URL

# Set environment variables for build
ENV NEXT_PUBLIC_GRAPHQL_HTTP_URL=${NEXT_PUBLIC_GRAPHQL_HTTP_URL:-http://api.ourchat.localhost/graphql}
ENV NEXT_PUBLIC_GRAPHQL_WS_URL=${NEXT_PUBLIC_GRAPHQL_WS_URL:-ws://api.ourchat.localhost/graphql}
ENV NODE_ENV=production

# Build Next.js static export
RUN pnpm build

# Stage 3: Production - Nginx
FROM nginx:alpine AS production

# Copy custom nginx configuration
COPY docker/frontend/nginx.conf /etc/nginx/nginx.conf

# Copy static files from builder
COPY --from=builder /app/out /usr/share/nginx/html

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# Run nginx
CMD ["nginx", "-g", "daemon off;"]
