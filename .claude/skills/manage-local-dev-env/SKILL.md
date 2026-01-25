---
name: manage-local-dev-env
description: Manage the OurChat local development environment. This skill should be used when the user asks to start, stop, restart, or check status of the local dev environment, development servers, or individual services like frontend, backend, database, or API.
---

# Manage Local Dev Env

## Overview

Manage the OurChat local development and test environments. All services run via Docker Compose from the project root `docker-compose.yml`.

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

# Reset database (delete all data)
bash .claude/skills/manage-local-dev-env/scripts/reset-db.sh           # Dev DB (interactive)
bash .claude/skills/manage-local-dev-env/scripts/reset-db.sh -y        # Dev DB (skip confirmation)
bash .claude/skills/manage-local-dev-env/scripts/reset-db.sh --env test -y  # Test DB
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
  frontend  Next.js dev server (Docker)
  backend   Backend services (postgres, mailhog, api)
  postgres  PostgreSQL database
  mailhog   MailHog email server
  api       Backend GraphQL API

Options:
  --env dev   Development environment (default)
  --env test  Test environment for E2E/Playwright testing
```

### reset-db.sh

```
reset-db.sh [--env dev|test] [-y|--yes]

Options:
  --env dev|test  Environment to reset (default: dev)
  -y, --yes       Skip confirmation prompt

This script will:
  - Drop and recreate the database
  - Run all Prisma migrations
  - Clear all MailHog emails
```

## Environments

### Development Environment (default)

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:3002 | Next.js dev server (Docker) |
| Backend GraphQL | http://localhost:4000/graphql | GraphQL API |
| PostgreSQL | localhost:5432 | Primary database |
| MailHog Web UI | http://localhost:8025 | Email capture interface |

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

All services run in Docker, so logs are accessed via docker-compose:

```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f frontend
docker-compose logs -f backend
docker-compose logs -f postgres

# Test environment logs
docker-compose --profile test logs -f frontend-test
docker-compose --profile test logs -f backend-test
```

## Manual Commands

If the script is unavailable, use docker-compose directly:

### Development Environment
```bash
# Start all dev services
docker-compose up -d postgres mailhog backend frontend

# Stop all services (never use -v flag - will delete data)
docker-compose stop

# View status
docker-compose ps
```

### Test Environment
```bash
# Start all test services
docker-compose --profile test up -d

# Stop test services
docker-compose --profile test stop

# View status
docker-compose --profile test ps
```
