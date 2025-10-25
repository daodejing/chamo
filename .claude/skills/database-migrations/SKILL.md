# Database Migrations Skill

## When to Use
Use this skill when making changes to the Prisma database schema that require migrations.

## Project Structure Context

**IMPORTANT: This is a monorepo with the backend in a subdirectory:**

```
/Users/usr0101345/projects/ourchat/              # Project root
├── apps/
│   └── backend/                                  # Backend application
│       ├── docker-compose.yml                    # Backend docker-compose file (HERE!)
│       ├── prisma/
│       │   ├── schema.prisma                     # Database schema
│       │   └── migrations/                       # Migration files
│       └── src/
└── src/                                          # Frontend (Next.js at root)
```

**Key Locations:**
- Backend docker-compose: `apps/backend/docker-compose.yml` (NOT at project root)
- Prisma schema: `apps/backend/prisma/schema.prisma`
- Migrations: `apps/backend/prisma/migrations/`

**Always cd to backend directory for docker-compose and Prisma commands:**
```bash
cd apps/backend  # or absolute: cd /Users/usr0101345/projects/ourchat/apps/backend
```

## Overview
This project uses Prisma ORM with MySQL. Database migrations must be handled carefully to avoid data loss and ensure the backend server picks up schema changes.

## Step-by-Step Migration Process

### 1. Update Prisma Schema
Edit the schema file:
```bash
apps/backend/prisma/schema.prisma
```

### 2. Create Migration (Non-Interactive Environment)
Since Claude Code runs in a non-interactive environment, Prisma's interactive `migrate dev` won't work. Use this approach instead:

**Create migration directory and SQL manually:**
```bash
cd apps/backend

# Create timestamped migration directory
mkdir -p prisma/migrations/$(date +%Y%m%d%H%M%S)_descriptive_name

# Write migration SQL to migration.sql file
# Example: prisma/migrations/20251025183615_remove_field/migration.sql
```

### 3. Apply Migration
```bash
cd apps/backend
npx prisma migrate deploy
```

### 4. Generate Prisma Client
After applying migration, regenerate TypeScript types:
```bash
cd apps/backend
npx prisma generate
```

### 5. Restart Backend Server
**IMPORTANT: Must cd to backend directory where docker-compose.yml is located:**
```bash
cd apps/backend
docker-compose restart backend
```

### 6. Regenerate Frontend GraphQL Types
If GraphQL schema changed, regenerate frontend types from PROJECT ROOT:
```bash
cd /Users/usr0101345/projects/ourchat  # Return to project root
pnpm codegen
```

## Common Migration Examples

### Remove a Field
```sql
-- migration.sql
ALTER TABLE `users` DROP COLUMN `fieldName`;
```

### Add an Optional Field
```sql
-- migration.sql
ALTER TABLE `users` ADD COLUMN `newField` VARCHAR(255) NULL;
```

### Add a Required Field (with default)
```sql
-- migration.sql
ALTER TABLE `users` ADD COLUMN `newField` VARCHAR(255) NOT NULL DEFAULT 'default_value';
```

### Make Field Optional
```sql
-- migration.sql
ALTER TABLE `users` MODIFY COLUMN `fieldName` VARCHAR(255) NULL;
```

## Troubleshooting

### "Environment is non-interactive" Error
This is expected in Claude Code. Use the manual migration approach above.

### Backend Not Reflecting Schema Changes
1. Verify migration was applied: `npx prisma migrate status`
2. Regenerate client: `npx prisma generate`
3. **Restart backend from correct directory**: `cd apps/backend && docker-compose restart backend`

### Frontend GraphQL Errors
After backend schema changes affecting GraphQL:
1. Ensure backend is running with new schema
2. Run `pnpm codegen` from project root
3. Check generated types in `src/lib/graphql/generated/graphql.ts`

### "no configuration file provided: not found"
You're trying to run docker-compose from the wrong directory. The docker-compose.yml is in `apps/backend/`, not the project root.

## Complete Workflow Checklist
```bash
# 1. Edit schema
# Edit: apps/backend/prisma/schema.prisma

# 2. Create migration
cd apps/backend
mkdir -p prisma/migrations/$(date +%Y%m%d%H%M%S)_descriptive_name
# Write migration SQL to migration.sql

# 3. Apply migration
npx prisma migrate deploy

# 4. Generate Prisma client
npx prisma generate

# 5. Restart backend
docker-compose restart backend

# 6. Regenerate frontend types (if needed)
cd /Users/usr0101345/projects/ourchat
pnpm codegen

# 7. Run tests
pnpm test:e2e
```

## Important Notes
- Always cd to `apps/backend` for Prisma and docker-compose commands
- Always cd to project root for `pnpm codegen`
- Never edit migration files after they've been applied
- Keep migration SQL files for version control
- Use descriptive migration names (e.g., `remove_encrypted_family_key`)
