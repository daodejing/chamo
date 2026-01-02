---
name: manage-local-dev-env
description: Manage the OurChat local development environment. This skill should be used when the user asks to start, stop, restart, or check status of the local dev environment, development servers, or individual services like frontend, backend, database, or API.
---

# Manage Local Dev Env

## Overview

Manage the OurChat local development and test environments including starting, stopping, and restarting backend docker services and the Next.js frontend dev server.

## Quick Reference

```bash
# Development Environment (default)
bash .claude/skills/manage-local-dev-env/scripts/manage-dev.sh start
bash .claude/skills/manage-local-dev-env/scripts/manage-dev.sh status
bash .claude/skills/manage-local-dev-env/scripts/manage-dev.sh stop

# Test Environment (for E2E/Playwright testing)
bash .claude/skills/manage-local-dev-env/scripts/manage-dev.sh start --env test
bash .claude/skills/manage-local-dev-env/scripts/manage-dev.sh status --env test
bash .claude/skills/manage-local-dev-env/scripts/manage-dev.sh stop --env test

# Restart specific components
bash .claude/skills/manage-local-dev-env/scripts/manage-dev.sh restart frontend
bash .claude/skills/manage-local-dev-env/scripts/manage-dev.sh restart backend --env test
bash .claude/skills/manage-local-dev-env/scripts/manage-dev.sh restart api
```

## Script Usage

```
manage-dev.sh <action> [component] [--env dev|test]

Actions:
  start    Start component(s)
  stop     Stop component(s)
  restart  Restart component(s)
  status   Show status of all components

Components:
  all       All services (default)
  frontend  Next.js dev server
  backend   All backend docker services
  mysql     MySQL database
  postgres  PostgreSQL database
  minio     MinIO object storage
  api       Backend GraphQL API

Options:
  --env dev   Development environment (default)
  --env test  Test environment for E2E/Playwright testing
```

## Environments

### Development Environment (default)

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:3002 | Next.js dev server |
| Backend GraphQL | http://localhost:4000/graphql | GraphQL API |
| PostgreSQL | localhost:5432 | Primary database |
| MySQL | localhost:3306 | Legacy database |
| MinIO | localhost:9000-9001 | Object storage |

### Test Environment (`--env test`)

Used for E2E testing with Playwright MCP dual browser testing.

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:3003 | Next.js dev server (E2E mode) |
| Backend GraphQL | http://localhost:4001/graphql | Test GraphQL API |
| PostgreSQL | localhost:5433 | Test database |
| MailHog Web UI | http://localhost:8025 | Email capture interface |
| MailHog SMTP | localhost:1025 | Email sending |

## Logs

### Development
- Frontend logs: `/tmp/ourchat-frontend.log`
- View frontend logs live: `tail -f /tmp/ourchat-frontend.log`
- Backend logs: `docker-compose -f apps/backend/docker-compose.yml logs -f`

### Test
- Frontend logs: `/tmp/ourchat-frontend-test.log`
- View frontend logs live: `tail -f /tmp/ourchat-frontend-test.log`
- Backend logs: `docker-compose -f apps/backend/docker-compose.yml --profile test logs -f backend-test`

## Manual Commands

If the script is unavailable:

### Development Environment
```bash
# Start backend
docker-compose -f apps/backend/docker-compose.yml up -d

# Start frontend with log redirection
pnpm dev > /tmp/ourchat-frontend.log 2>&1 &

# Stop frontend
pkill -f "next dev"

# Stop backend (never use -v flag - will delete data)
docker-compose -f apps/backend/docker-compose.yml stop
```

### Test Environment
```bash
# Start test backend (includes postgres-test, mailhog, backend-test)
docker-compose -f apps/backend/docker-compose.yml --profile test up -d

# Start test frontend
E2E_TEST=true \
NEXT_PUBLIC_GRAPHQL_HTTP_URL=http://localhost:4001/graphql \
NEXT_PUBLIC_GRAPHQL_WS_URL=ws://localhost:4001/graphql \
pnpm next dev --port 3003 > /tmp/ourchat-frontend-test.log 2>&1 &

# Stop test frontend
lsof -i :3003 -t | xargs kill -9

# Stop test backend
docker-compose -f apps/backend/docker-compose.yml --profile test stop
```
