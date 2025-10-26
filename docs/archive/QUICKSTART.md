# Quick Start Guide - OurChat Development

Get your development environment running in 5 minutes!

## Prerequisites

✅ **Node.js 20+** installed
✅ **pnpm 9+** installed (`npm install -g pnpm`)
✅ **Docker Host** running (Docker Desktop or Colima)

**macOS with Colima:** If using Colima, set up the Docker socket:
```bash
# Install direnv (once per machine)
brew install direnv
echo 'eval "$(direnv hook zsh)"' >> ~/.zshrc  # or ~/.bashrc for bash
source ~/.zshrc  # or source ~/.bashrc

# Allow .envrc in project directory
cd ourchat
direnv allow
```

## 1. Install Dependencies

```bash
pnpm install
```

**Expected time:** 1-2 minutes

## 2. Start Supabase (Docker)

```bash
pnpm dlx supabase start
```

**Expected time:** 5-10 minutes (first run only - downloads Docker images)

**Important:** Save the output! You'll see:

```
API URL: http://localhost:54321
anon key: eyJhbGci...
service_role key: eyJhbGci...
```

## 3. Configure Environment

The `.env.local` file is already created with default local Supabase keys. If you started Supabase and got different keys, update `.env.local`:

```bash
# Update these if your Supabase keys are different:
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

## 4. Apply Database Migrations

```bash
pnpm dlx supabase db reset
```

This creates all tables, indexes, and RLS policies.

**Expected time:** 10-20 seconds

## 5. Start Next.js Dev Server

```bash
pnpm dev
```

**Expected time:** 5-10 seconds

## 6. Open in Browser

Navigate to: **http://localhost:3000**

You should see the app redirect to the login page.

## 7. Access Supabase Studio

Open Supabase Studio to view/manage your database:

**http://localhost:54323**

## Next Steps

### Add shadcn/ui Components (as needed)

```bash
pnpm dlx shadcn@latest add button
pnpm dlx shadcn@latest add dialog
pnpm dlx shadcn@latest add input
```

### Start Building!

Check the project structure in `README.md` and start implementing features according to the tech specs in `/docs`.

## Common Commands

```bash
# Development
pnpm dev                      # Start Next.js dev server
pnpm lint                     # Check code quality
pnpm type-check               # Check TypeScript types

# Supabase
pnpm dlx supabase status      # Check if running
pnpm dlx supabase stop        # Stop Supabase
pnpm dlx supabase db reset    # Reset database (apply migrations)

# Database Migrations
pnpm dlx supabase migration new <name>     # Create new migration
pnpm dlx supabase db diff                   # Generate migration from changes
```

## Troubleshooting

### Supabase won't start

```bash
# Check if Docker is running
docker ps

# Stop and restart Supabase
pnpm dlx supabase stop
pnpm dlx supabase start
```

### Port conflicts

If ports 3000, 54321-54324 are in use:

**Next.js (port 3000):**
```bash
pnpm dev -- -p 3001  # Use different port
```

**Supabase:** Edit `supabase/config.toml` to change ports.

### "Module not found" errors

```bash
# Clean install
rm -rf node_modules .next
pnpm install
```

## Development Workflow

1. **Check Supabase is running:**
   ```bash
   pnpm dlx supabase status
   ```

2. **Start Next.js:**
   ```bash
   pnpm dev
   ```

3. **Make changes** to code (hot reload enabled)

4. **View Supabase Studio:**
   http://localhost:54323

5. **When done:**
   ```bash
   # Stop Next.js: Ctrl+C
   # Stop Supabase:
   pnpm dlx supabase stop
   ```

## Reference Architecture

- **PRD:** `/docs/PRD.md`
- **Solution Architecture:** `/docs/solution-architecture.md`
- **Tech Specs:** `/docs/tech-spec-epic-*.md`
- **Prototype:** `/frontend-proto/` (reference UI)

## Ready to Build!

You now have:
- ✅ Next.js 15.5 with React 19.2
- ✅ Local Supabase (PostgreSQL + Realtime + Storage)
- ✅ Complete database schema with RLS
- ✅ TypeScript, TailwindCSS, shadcn/ui ready
- ✅ Hot reload enabled

Start implementing Epic 1 (User Onboarding & Authentication) from the tech specs! 🚀
