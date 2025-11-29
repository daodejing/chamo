---
name: manage-local-dev-env
description: Manage the OurChat local development environment. This skill should be used when the user asks to start, stop, restart, or check status of the local dev environment, development servers, or individual services like frontend, backend, database, or API.
---

# Manage Local Dev Env

## Overview

Manage the OurChat local development environment including starting, stopping, and restarting backend docker services and the Next.js frontend dev server.

## Quick Reference

```bash
# Start all services
bash .claude/skills/manage-local-dev-env/scripts/manage-dev.sh start

# Restart specific component
bash .claude/skills/manage-local-dev-env/scripts/manage-dev.sh restart frontend
bash .claude/skills/manage-local-dev-env/scripts/manage-dev.sh restart backend
bash .claude/skills/manage-local-dev-env/scripts/manage-dev.sh restart api

# Stop all services
bash .claude/skills/manage-local-dev-env/scripts/manage-dev.sh stop

# Check status
bash .claude/skills/manage-local-dev-env/scripts/manage-dev.sh status
```

## Script Usage

```
manage-dev.sh <action> [component]

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
```

## Services

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:3002 | Next.js dev server |
| Backend GraphQL | http://localhost:4000 | GraphQL API |
| PostgreSQL | localhost:5432 | Primary database |
| MySQL | localhost:3306 | Legacy database |
| MinIO | localhost:9000-9001 | Object storage |
| SEO API | localhost:3000 | SEO service |

## Logs

- Frontend logs: `/tmp/ourchat-frontend.log`
- View frontend logs live: `tail -f /tmp/ourchat-frontend.log`
- Backend logs: `docker-compose -f apps/backend/docker-compose.yml logs -f`
- Single service logs: `docker-compose -f apps/backend/docker-compose.yml logs -f <service>`

## Manual Commands

If the script is unavailable:

```bash
# Start backend
docker-compose -f apps/backend/docker-compose.yml up -d

# Start frontend with log redirection
pnpm dev > /tmp/ourchat-frontend.log 2>&1 &

# Restart single docker service
docker-compose -f apps/backend/docker-compose.yml restart backend

# Stop frontend
pkill -f "next dev"

# Stop backend (never use -v flag - will delete data)
docker-compose -f apps/backend/docker-compose.yml stop
```
