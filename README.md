# OurChat - Private Family Collaboration Platform

A privacy-first family collaboration platform with end-to-end encryption, real-time messaging, photo sharing, and family calendar management.

## Tech Stack

- **Frontend:** Next.js 15.5, React 19.2, TypeScript 5.9, TailwindCSS 3.4
- **Backend:** Supabase (PostgreSQL, Realtime, Storage, Auth)
- **Deployment:** Vercel (Next.js), Supabase Cloud
- **E2EE:** Web Crypto API (AES-256-GCM)
- **Translation:** Groq API (Llama 3.1 70B)
- **Package Manager:** pnpm 10.x

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 20.x or higher
- **pnpm** 9.x or higher (`npm install -g pnpm`)
- **Docker Desktop** (for local Supabase)
- **Git**

## Development Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd ourchat
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Configure Colima Docker Socket (macOS with Colima only)

If you're using Colima instead of Docker Desktop, you need to set the `DOCKER_HOST` environment variable:

**Option 1: Using direnv (recommended)**
```bash
# Install direnv if not already installed
brew install direnv

# Add direnv hook to your shell (once per machine)
# For bash: echo 'eval "$(direnv hook bash)"' >> ~/.bashrc
# For zsh: echo 'eval "$(direnv hook zsh)"' >> ~/.zshrc

# Allow the .envrc file in the project directory
cd ourchat
direnv allow

# Now DOCKER_HOST will be automatically set when you cd into the project
```

**Option 2: Manual export (alternative)**
```bash
export DOCKER_HOST=unix:///Users/$USER/.colima/default/docker.sock
```

### 4. Start Supabase Local Development

This command starts a local Supabase instance using Docker Compose (may take 5-10 minutes on first run):

```bash
pnpm dlx supabase start
```

After completion, you'll see output like:

```
Started supabase local development setup.

         API URL: http://localhost:54321
     GraphQL URL: http://localhost:54321/graphql/v1
          DB URL: postgresql://postgres:postgres@localhost:54322/postgres
      Studio URL: http://localhost:54323
    Inbucket URL: http://localhost:54324
      JWT secret: your-super-secret-jwt-token-with-at-least-32-characters-long
        anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Save these values!** You'll need them for the next step.

### 5. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with the values from Supabase start:

```bash
# Supabase Configuration (from supabase start output)
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key-from-supabase-start>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key-from-supabase-start>

# Groq API (for LLM translation) - Get from https://console.groq.com
NEXT_PUBLIC_GROQ_API_KEY=gsk_your-groq-api-key-here

# Google OAuth (for Calendar integration) - Get from https://console.cloud.google.com
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# NextAuth (generate a secret: openssl rand -base64 32)
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret-here

# Environment
NODE_ENV=development
```

### 6. Apply Database Migrations

```bash
pnpm dlx supabase db reset
```

This creates all tables, indexes, and RLS policies defined in `supabase/migrations/`.

### 7. Start Next.js Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
ourchat/
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
pnpm test                    # Run unit tests (Vitest)
pnpm test:ui                 # Run tests with UI
pnpm test:coverage           # Run tests with coverage

# Supabase
pnpm dlx supabase start      # Start local Supabase
pnpm dlx supabase stop       # Stop local Supabase
pnpm dlx supabase status     # Check Supabase status
pnpm dlx supabase db reset   # Reset database (apply migrations)
pnpm dlx supabase db diff    # Generate migration from changes
pnpm dlx supabase migration new <name>  # Create new migration
```

## Development Workflow

### Hybrid Approach

This project uses a **hybrid development approach**:

- **Next.js on host** (runs on your machine for fast hot reload)
- **Supabase in Docker** (isolated, production-like environment)

### Database Migrations

1. **Create a new migration:**
   ```bash
   pnpm dlx supabase migration new add_user_preferences
   ```

2. **Edit the migration** in `supabase/migrations/`

3. **Apply the migration:**
   ```bash
   pnpm dlx supabase db reset
   ```

### Adding shadcn/ui Components

```bash
pnpm dlx shadcn@latest add button
pnpm dlx shadcn@latest add dialog
pnpm dlx shadcn@latest add input
# etc.
```

## Architecture Overview

### End-to-End Encryption

- **Model:** Shared Family Key (AES-256-GCM)
- **Key Distribution:** Invite code contains encrypted key
- **Storage:** Client-side IndexedDB
- **Security:** Zero-knowledge (server cannot decrypt)

### Real-Time Messaging

- **Protocol:** Supabase Realtime (WebSocket)
- **Channels:** Per-channel subscriptions
- **Flow:** Encrypt → Send → Store → Broadcast → Decrypt

### Translation

- **Provider:** Groq API (Llama 3.1 70B)
- **Languages:** 20+ supported (auto-detect source)
- **Privacy:** Client-direct API calls (preserves E2EE)

## Useful Links

- **Supabase Studio:** http://localhost:54323 (when running locally)
- **Architecture Docs:** `/docs/solution-architecture.md`
- **PRD:** `/docs/PRD.md`
- **Tech Specs:** `/docs/tech-spec-epic-*.md`

## Troubleshooting

### Supabase won't start

```bash
# Stop all containers
pnpm dlx supabase stop

# Remove volumes and restart
docker-compose down -v
pnpm dlx supabase start
```

### Port conflicts

If ports 54321-54324 are in use, edit `supabase/config.toml` to change ports.

### TypeScript errors after schema changes

```bash
# Regenerate Supabase types
pnpm dlx supabase gen types typescript --local > src/types/database.ts
```

### Hot reload not working

```bash
# Restart Next.js dev server
pnpm dev
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
