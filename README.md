# OurChat - Private Family Collaboration Platform

A privacy-first family collaboration platform with end-to-end encryption, real-time messaging, photo sharing, and family calendar management.

## Tech Stack

- **Frontend:** Next.js 16.0, React 19, TypeScript 5.9, TailwindCSS 3.4
- **Backend:** NestJS 10.x, GraphQL (Apollo Server), TypeORM
- **Database:** PostgreSQL (Docker local, Neon cloud)
- **Deployment:** Cloudflare Pages (frontend), Render (backend)
- **CI/CD:** GitHub Actions (automated testing & deployment)
- **E2EE:** Web Crypto API (AES-256-GCM)
- **Translation:** Groq API (Llama 3.1 70B)
- **Package Manager:** pnpm 9.x

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 20.x or higher
- **pnpm** 9.x or higher (`npm install -g pnpm`)
- **Docker Desktop** or **Colima** (for local PostgreSQL + backend)
- **Git**

## Development Setup

### 1. Clone the Repository

```bash
git clone git@github.com:daodejing/chamo.git
cd chamo
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Configure Colima Docker Socket (macOS with Colima only)

If you're using Colima instead of Docker Desktop, the `.envrc` file is already configured:

```bash
# Install direnv if not already installed
brew install direnv

# Add direnv hook to your shell (once per machine)
# For bash: echo 'eval "$(direnv hook bash)"' >> ~/.bashrc
# For zsh: echo 'eval "$(direnv hook zsh)"' >> ~/.zshrc

# Allow the .envrc file in the project directory
cd chamo
direnv allow
```

### 4. Start Local Development Stack

Start PostgreSQL and NestJS backend using Docker Compose:

```bash
docker-compose up -d
```

This starts:
- **PostgreSQL** on port 3306 (MySQL protocol for compatibility)
- **NestJS Backend** on port 4000 with GraphQL endpoint
- **GraphQL Playground** at http://localhost:4000/graphql

### 5. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```bash
# GraphQL Backend
NEXT_PUBLIC_GRAPHQL_HTTP_URL=http://localhost:4000/graphql
NEXT_PUBLIC_GRAPHQL_WS_URL=ws://localhost:4000/graphql

# Groq API (for LLM translation) - Get from https://console.groq.com
NEXT_PUBLIC_GROQ_API_KEY=gsk_your-groq-api-key-here

# Environment
NODE_ENV=development
```

### 6. Apply Database Migrations

```bash
cd apps/backend
pnpm prisma migrate dev
cd ../..
```

This creates all tables and indexes defined in Prisma schema.

### 7. Start Next.js Development Server

```bash
pnpm dev
```

Open [http://localhost:3002](http://localhost:3002) in your browser.

## CI/CD Pipeline

This project includes automated CI/CD workflows powered by GitHub Actions:

### Continuous Integration (`.github/workflows/ci.yml`)
Runs on every push and pull request:
- ✅ Frontend unit tests
- ✅ Backend unit tests
- ✅ Integration tests
- ✅ E2E Playwright tests
- ✅ Build verification
- ✅ ESLint checks

### Staging Deployment (`.github/workflows/deploy-staging.yml`)
Automatically deploys to staging on every push to `main`:
- 🚀 Frontend → Cloudflare Pages
- 🚀 Backend → Render
- ✅ Database migrations (Prisma)
- ✅ Health checks

### Health Monitoring (`.github/workflows/health-check.yml`)
Runs every 15 minutes to monitor staging environment:
- 🏥 Frontend availability check
- 🏥 Backend health endpoint check
- 🏥 GraphQL endpoint check
- 🚨 Creates GitHub Issues on failures

See [.env.staging.template](.env.staging.template) for deployment setup instructions.

## Project Structure

```
chamo/
├── src/
│   ├── app/                 # Next.js 15 App Router
│   │   ├── (auth)/          # Auth pages (login)
│   │   ├── (dashboard)/     # Main app (chat, settings)
│   │   ├── api/             # API routes
│   │   ├── globals.css      # Global styles
│   │   ├── layout.tsx       # Root layout
│   │   └── page.tsx         # Home page (redirects)
│   ├── components/          # React components
│   │   ├── ui/              # shadcn/ui components
│   │   ├── chat/            # Chat-related components
│   │   ├── photos/          # Photo-related components
│   │   ├── calendar/        # Calendar components
│   │   └── settings/        # Settings components
│   ├── lib/                 # Business logic & utilities
│   │   ├── supabase/        # Supabase clients
│   │   ├── e2ee/            # Encryption functions
│   │   ├── groq/            # Translation client
│   │   ├── google/          # Google Calendar OAuth
│   │   ├── utils/           # Utilities
│   │   └── hooks/           # Custom hooks
│   └── types/               # TypeScript types
├── supabase/
│   ├── migrations/          # SQL migrations
│   └── config.toml          # Supabase config
├── public/                  # Static assets
├── docs/                    # Project documentation
└── frontend-proto/          # UI prototype (reference)
```

## Available Scripts

```bash
# Development
pnpm dev                     # Start Next.js dev server
pnpm build                   # Build for production
pnpm start                   # Start production server
pnpm lint                    # Run ESLint
pnpm type-check              # Run TypeScript type checking
pnpm format                  # Format code with Prettier

# Testing
pnpm test:e2e                # Run E2E tests (Playwright)
pnpm test:e2e:ui             # Run E2E tests with UI mode
pnpm test:e2e:debug          # Debug E2E tests

# Database (Prisma)
cd apps/backend
pnpm prisma migrate dev      # Create & apply migration
pnpm prisma migrate deploy   # Apply migrations (production)
pnpm prisma studio           # Open Prisma Studio GUI
pnpm prisma generate         # Regenerate Prisma Client

# Docker
docker-compose up -d         # Start backend + database
docker-compose down          # Stop all services
docker-compose logs -f       # View logs
```

## Development Workflow

### Monorepo Structure

This project uses **pnpm workspaces**:

- **Frontend** (`/src`) - Next.js application (runs on host)
- **Backend** (`/apps/backend`) - NestJS + GraphQL (runs in Docker)
- **Database** - PostgreSQL (runs in Docker)

### Database Migrations (Prisma)

1. **Create a new migration:**
   ```bash
   cd apps/backend
   pnpm prisma migrate dev --name add_user_preferences
   ```

2. **The migration is automatically applied** to your local database

3. **Regenerate types:**
   ```bash
   pnpm prisma generate
   ```

### Adding shadcn/ui Components

```bash
pnpm dlx shadcn@latest add button
pnpm dlx shadcn@latest add dialog
pnpm dlx shadcn@latest add input
# etc.
```

### Testing Strategy

**E2E Testing with Playwright:**

Playwright E2E tests run against the local development environment:

```bash
# Ensure backend is running
docker-compose up -d

# Run all E2E tests (auto-starts frontend on port 3003)
pnpm test:e2e

# Run specific test file
pnpm test:e2e tests/e2e/auth-onboarding.spec.ts

# Run specific browser
pnpm test:e2e --project=firefox
pnpm test:e2e --project=chromium

# Run in headed mode (see browser)
pnpm test:e2e --headed

# Debug mode (step through tests)
pnpm test:e2e:debug

# Run with specific grep pattern
pnpm test:e2e --grep "AC3"
```

**Test Harness:**
- Visit http://localhost:3002/test-e2ee to manually test E2EE functions

**Test Locations:**
- E2E tests: `tests/e2e/`

**Test Coverage:**
- Authentication & onboarding flows
- E2EE key sharing between family members
- Invite code generation and usage
- Message encryption/decryption
- Multi-user concurrent sessions
- Form validation and error handling

## Architecture Overview

### End-to-End Encryption

- **Model:** Shared Family Key (AES-256-GCM)
- **Key Distribution:** Invite code contains encrypted key
- **Storage:** Client-side IndexedDB
- **Security:** Zero-knowledge (server cannot decrypt)

### GraphQL API

- **Server:** NestJS + Apollo Server
- **Schema:** Code-first with TypeGraphQL decorators
- **Subscriptions:** WebSocket for real-time updates
- **Authentication:** JWT tokens in Authorization header

### Translation

- **Provider:** Groq API (Llama 3.1 70B)
- **Languages:** 20+ supported (auto-detect source)
- **Privacy:** Client-direct API calls (preserves E2EE)

## Useful Links

- **GraphQL Playground:** http://localhost:4000/graphql (when running locally)
- **Frontend:** http://localhost:3002
- **E2EE Test Harness:** http://localhost:3002/test-e2ee
- **Architecture Docs:** `/docs/architecture/`
- **PRD:** `/docs/PRD.md`
- **User Stories:** `/docs/stories/`
- **GitHub Repository:** https://github.com/daodejing/chamo

## Troubleshooting

### Backend won't start

```bash
# Stop all containers
docker-compose down

# Remove volumes and restart
docker-compose down -v
docker-compose up -d
```

### Port conflicts

If ports 3306 or 4000 are in use:
- Edit `docker-compose.yml` to change ports
- Update `NEXT_PUBLIC_GRAPHQL_HTTP_URL` in `.env.local`

### TypeScript errors after schema changes

```bash
# Regenerate Prisma types
cd apps/backend
pnpm prisma generate
```

### GraphQL schema changes not reflecting

```bash
# Restart backend
docker-compose restart backend

# Check backend logs
docker-compose logs -f backend
```

### Database connection issues

```bash
# Check if MySQL is running
docker-compose ps

# Check backend can connect
docker-compose logs backend | grep -i mysql
```

## Contributing

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Make changes and commit: `git commit -m "Add my feature"`
3. Push to branch: `git push origin feature/my-feature`
4. Create a Pull Request

## License

Private project - All rights reserved

## Support

For questions or issues, contact the development team.
