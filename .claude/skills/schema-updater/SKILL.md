---
name: schema-updater
description: Update database schema and regenerate GraphQL and TypeScript types. Use this skill when the user requests to apply database migrations, update schemas, regenerate types after Prisma schema changes, or when explicitly asked to "update the schema" or "run migrations".
---

# Schema Updater

## Overview

This skill handles the complete workflow for updating the database schema and regenerating all downstream type definitions. Use this when Prisma schema changes need to be applied to the database, backend GraphQL schema, and frontend TypeScript types.

## When to Use This Skill

Trigger this skill when:
- User requests to "update the database schema"
- User asks to "run migrations" or "apply migrations"
- User says "I updated the Prisma schema, apply the changes"
- User requests to "regenerate schemas" or "update types"
- After making changes to `apps/backend/prisma/schema.prisma`

## Workflow

The schema update process consists of three sequential steps that must be executed in order:

### 1. Apply Prisma Migrations

Run Prisma migrations from the backend directory to update the database schema:

```bash
cd apps/backend && npx prisma migrate dev
```

**What this does:**
- Applies pending migrations to the PostgreSQL database
- Generates a new migration file if schema changes are detected
- Regenerates Prisma Client with updated types

**Expected output:**
- Migration file applied successfully
- "Your database is now in sync with your schema"
- Prisma Client generated

### 2. Restart Backend Service

Restart the backend service to regenerate the GraphQL schema:

```bash
cd apps/backend && docker-compose restart backend
```

**What this does:**
- Restarts the backend Docker container
- GraphQL schema is regenerated from the updated Prisma models
- Backend service becomes available with new schema

**Expected output:**
- "Container ourchat_backend Restarting"
- "Container ourchat_backend Started"

### 3. Regenerate Frontend Types

Run GraphQL codegen to update frontend TypeScript types:

```bash
pnpm codegen
```

**What this does:**
- Fetches the updated GraphQL schema from the backend
- Generates TypeScript types and typed document nodes
- Updates files in `src/lib/graphql/generated/`

**Expected output:**
- "Parse Configuration [COMPLETED]"
- "Generate outputs [COMPLETED]"
- "Generate to ./src/lib/graphql/generated/ [COMPLETED]"

## Task Management

When executing this workflow:

1. Create a todo list with three items:
   - Run Prisma migrations
   - Restart backend to regenerate GraphQL schema
   - Regenerate frontend schema definitions

2. Mark each task as `in_progress` before starting it

3. Mark each task as `completed` immediately after successful execution

4. If any step fails, keep it as `in_progress` and investigate the error before proceeding

## Error Handling

**Common issues:**

- **Prisma schema not found**: Ensure running from `apps/backend` directory where `prisma/schema.prisma` exists
- **Database connection error**: Verify PostgreSQL is running via `docker-compose ps`
- **Backend restart fails**: Check `docker-compose.yml` exists in `apps/backend/`
- **Codegen fails**: Ensure backend is running and GraphQL endpoint is accessible at `http://localhost:4000/graphql`

## Architecture Context

This project uses a monorepo structure:
- **Backend**: `apps/backend/` - NestJS + Prisma + GraphQL
- **Frontend**: `src/` - Next.js + Apollo Client
- **Database**: PostgreSQL running in Docker

The data flow is: Prisma Schema → Database → Prisma Client → GraphQL Schema → Frontend Types
