# Chamo Staging Deployment Setup Guide

This guide walks you through setting up the complete staging environment for Chamo using free-tier cloud services. Total cost: **$0/month**.

> **Note**: The repository is named `chamo` and the official app name is **Chamo**.

## Architecture Overview

```mermaid
graph TB
    subgraph "Developer Machine"
        Dev[Developer]
        Git[Git Push to main]
    end

    subgraph "GitHub"
        Repo[daodejing/chamo<br/>Repository]
        Actions[GitHub Actions<br/>CI/CD Workflows]
        Secrets[Encrypted Secrets<br/>- API Tokens<br/>- DB URLs<br/>- JWT Secrets]
    end

    subgraph "Cloudflare"
        Pages[Cloudflare Pages<br/>Static Hosting]
        CDN[Global CDN<br/>Edge Network]
        DNS[DNS/SSL<br/>chamo-staging.pages.dev]
    end

    subgraph "Render"
        Backend[NestJS Backend<br/>Web Service]
        Container[Docker Container<br/>Node.js 20]
        GraphQL[GraphQL API<br/>/graphql endpoint]
    end

    subgraph "Neon"
        DB[(PostgreSQL<br/>Serverless DB)]
        Branches[Database Branches<br/>main/dev/test]
    end

    subgraph "External Services"
        Groq[Groq API<br/>LLM Translation<br/>Llama 3.1 70B]
    end

    subgraph "End Users"
        Browser[Web Browser<br/>Chrome/Firefox/Safari]
    end

    %% Developer Flow
    Dev -->|1. Code & Push| Git
    Git -->|2. Trigger| Repo
    Repo -->|3. Run Workflows| Actions
    Actions -->|4. Read| Secrets

    %% CI/CD to Cloudflare
    Actions -->|5a. Deploy Frontend<br/>wrangler deploy| Pages
    Pages -->|Serve via| CDN
    CDN -->|HTTPS| DNS

    %% CI/CD to Render
    Actions -->|5b. Trigger Deploy<br/>webhook| Backend
    Backend -->|Run in| Container
    Container -->|Expose| GraphQL

    %% Database Connections
    Actions -->|6. Run Migrations<br/>prisma migrate| DB
    Backend -->|7. Query/Mutate<br/>Prisma ORM| DB
    DB -.->|Branching| Branches

    %% User Access Flow
    Browser -->|8. HTTPS Request| DNS
    DNS -->|Serve Static Files| Browser
    Browser -->|9. GraphQL Query/Mutation<br/>HTTP/WebSocket| GraphQL
    GraphQL -->|Process| Backend

    %% Translation
    Browser -->|10. Translation Request| Groq
    Groq -->|Translated Text| Browser

    %% Styling
    classDef github fill:#24292e,stroke:#fff,stroke-width:2px,color:#fff
    classDef cloudflare fill:#f38020,stroke:#fff,stroke-width:2px,color:#fff
    classDef render fill:#46E3B7,stroke:#fff,stroke-width:2px,color:#000
    classDef neon fill:#00e5cc,stroke:#fff,stroke-width:2px,color:#000
    classDef groq fill:#7c3aed,stroke:#fff,stroke-width:2px,color:#fff
    classDef user fill:#3b82f6,stroke:#fff,stroke-width:2px,color:#fff

    class Repo,Actions,Secrets github
    class Pages,CDN,DNS cloudflare
    class Backend,Container,GraphQL render
    class DB,Branches neon
    class Groq groq
    class Browser user
```

## Stack Components

The staging stack consists of:
- **Frontend**: Cloudflare Pages (Next.js static export)
- **Backend**: Render Web Service (NestJS + GraphQL)
- **Database**: Neon PostgreSQL (serverless)
- **CI/CD**: GitHub Actions (automated deployments)
- **Translation**: Groq API (optional)

---

## Prerequisites

- GitHub account with access to `daodejing/chamo` repository
- Email address for account signups
- ~30 minutes for complete setup

---

## Step 1: Neon PostgreSQL Database Setup

### 1.1 Create Neon Account

1. Visit https://neon.tech
2. Click **Sign Up**
3. Sign up with GitHub, Google, or email
4. Neon automatically provisions your first PostgreSQL instance

### 1.2 Create Staging Database

1. In the Neon Console, you'll see your default project
2. Click **Create Project** or use the default project
3. Name it `chamo-staging`
4. Select a region (choose closest to your users)
5. Click **Create Project**

### 1.3 Get Connection String

1. In your project dashboard, click **Connection Details**
2. Copy the **Connection String** - it looks like:
   ```
   postgresql://username:password@ep-xxxxx.region.aws.neon.tech/chamo_staging?sslmode=require
   ```
3. **Save this** - you'll need it for:
   - `STAGING_DATABASE_URL` (GitHub Secret)
   - `DATABASE_URL` (Render environment variable)

### Free Tier Limits
- 1 project
- 10 branches
- 3 GiB data per branch
- Shared compute with 1 GB RAM
- Perfect for staging!

---

## Step 2: Render Backend Setup

### 2.1 Create Render Account

1. Visit https://render.com
2. Click **Get Started**
3. Sign up with GitHub (recommended for easier deployment)
4. Authorize Render to access your GitHub account

### 2.2 Create Web Service

1. From the Render Dashboard, click **New +** → **Web Service**
2. Choose **Build and deploy from a Git repository**
3. Click **Connect** next to `daodejing/chamo`
4. Configure the service:

   **Basic Settings:**
   - **Name**: `chamo-backend-staging`
   - **Region**: Choose closest to your users
   - **Branch**: `main`
   - **Root Directory**: `apps/backend`

   **Build & Deploy:**
   - **Runtime**: Node
   - **Build Command**: `pnpm install && pnpm prisma generate && pnpm build`
   - **Start Command**: `pnpm start:prod`

   **Instance Type:**
   - Select **Free**

5. Click **Advanced** and add environment variables:
   ```
   DATABASE_URL=<your-neon-connection-string>
   JWT_SECRET=<generate-with-openssl-rand-base64-32>
   REFRESH_TOKEN_SECRET=<generate-with-openssl-rand-base64-32>
   CORS_ALLOWED_ORIGINS=https://chamo-staging.pages.dev,http://localhost:3002
   NODE_ENV=staging
   PORT=4000
   ```

6. Click **Create Web Service**

### 2.3 Get Service URLs

After deployment completes:
1. Copy your service URL (e.g., `https://chamo-backend-staging.onrender.com`)
2. **Save these URLs**:
   - `STAGING_BACKEND_URL`: `https://chamo-backend-staging.onrender.com`
   - `STAGING_GRAPHQL_HTTP_URL`: `https://chamo-backend-staging.onrender.com/graphql`

### 2.4 Get Deploy Hook

1. In your service settings, go to **Settings** → **Deploy Hook**
2. Click **Create Deploy Hook**
3. Name it `GitHub Actions - Chamo`
4. Copy the webhook URL
5. **Save as**: `RENDER_DEPLOY_HOOK_URL` (GitHub Secret)

### Free Tier Limits
- 750 hours/month (enough for 24/7 with one service)
- Service spins down after 15 minutes of inactivity
- 100 GB bandwidth/month
- Cold start: ~30 seconds

---

## Step 3: Cloudflare Pages Frontend Setup

### 3.1 Create Cloudflare Account

1. Visit https://dash.cloudflare.com/sign-up
2. Enter your email and create a password
3. Verify your email address
4. Skip domain setup (not needed for Pages)

### 3.2 Create Pages Project

1. In Cloudflare Dashboard, go to **Workers & Pages**
2. Click **Create application** → **Pages**
3. Click **Connect to Git**
4. Choose **GitHub** and authorize Cloudflare
5. Select `daodejing/chamo` repository
6. Configure build settings:

   **Build Configuration:**
   - **Production branch**: `main`
   - **Build command**: `pnpm build`
   - **Build output directory**: `out`
   - **Root directory**: `/` (leave empty)

   **Environment Variables** (click Add variable):
   ```
   NEXT_PUBLIC_GRAPHQL_HTTP_URL=https://chamo-backend-staging.onrender.com/graphql
   NEXT_PUBLIC_GRAPHQL_WS_URL=wss://chamo-backend-staging.onrender.com/graphql
   NEXT_PUBLIC_GROQ_API_KEY=<your-groq-api-key>
   NODE_VERSION=20
   ```

7. Click **Save and Deploy**

### 3.3 Get Deployment URLs

After build completes:
1. Your site will be at `https://chamo-staging.pages.dev`
2. **Save as**: `STAGING_FRONTEND_URL` (GitHub Secret)

### 3.4 Get API Token for GitHub Actions

1. Go to **My Profile** → **API Tokens**
2. Click **Create Token**
3. Use template: **Edit Cloudflare Workers**
4. Token name: `GitHub Actions - Chamo`
5. Permissions:
   - Account > Cloudflare Pages > Edit
6. Account Resources: Include > Your Account
7. Click **Continue to summary** → **Create Token**
8. **Copy the token immediately** (only shown once)
9. **Save as**: `CLOUDFLARE_API_TOKEN` (GitHub Secret)

### 3.5 Get Account ID

1. Go to **Workers & Pages** → **Overview**
2. On the right sidebar, copy your **Account ID**
3. **Save as**: `CLOUDFLARE_ACCOUNT_ID` (GitHub Secret)

### Free Tier Limits
- Unlimited requests
- Unlimited bandwidth
- 500 builds/month
- Perfect for staging!

---

## Step 4: Groq API Setup (Optional - for Translation)

### 4.1 Create Groq Account

1. Visit https://console.groq.com
2. Click **Sign Up**
3. Sign up with Google or email
4. Verify your email

### 4.2 Get API Key

1. Go to **API Keys** in the left sidebar
2. Click **Create API Key**
3. Name it `Chamo Staging`
4. Copy the API key
5. **Save as**: `GROQ_API_KEY` (GitHub Secret)

### Free Tier Limits
- Generous free tier for testing
- Rate limits apply

---

## Step 5: Configure GitHub Secrets

### 5.1 Add Repository Secrets

1. Go to https://github.com/daodejing/chamo
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret** for each:

   **Database:**
   ```
   STAGING_DATABASE_URL=postgresql://username:password@ep-xxxxx.region.aws.neon.tech/chamo_staging?sslmode=require
   ```

   **Backend (Render):**
   ```
   RENDER_DEPLOY_HOOK_URL=https://api.render.com/deploy/srv-xxxxx
   STAGING_BACKEND_URL=https://chamo-backend-staging.onrender.com
   STAGING_GRAPHQL_HTTP_URL=https://chamo-backend-staging.onrender.com/graphql
   ```

   **Frontend (Cloudflare):**
   ```
   CLOUDFLARE_API_TOKEN=<your-cloudflare-api-token>
   CLOUDFLARE_ACCOUNT_ID=<your-cloudflare-account-id>
   STAGING_FRONTEND_URL=https://chamo-staging.pages.dev
   ```

   **Optional:**
   ```
   GROQ_API_KEY=<your-groq-api-key>
   ```

### 5.2 Generate JWT Secrets

Run these commands locally:
```bash
# Generate JWT_SECRET
openssl rand -base64 32

# Generate REFRESH_TOKEN_SECRET (use different value)
openssl rand -base64 32
```

Add to Render environment variables (not GitHub Secrets).

---

## Step 6: Run Database Migrations

### 6.1 From Local Machine

```bash
# Set DATABASE_URL temporarily
export DATABASE_URL="postgresql://username:password@ep-xxxxx.region.aws.neon.tech/chamo_staging?sslmode=require"

# Run migrations
cd apps/backend
pnpm prisma migrate deploy

# Verify
pnpm prisma studio
```

### 6.2 Or Use Render Shell

1. Go to your Render service dashboard
2. Click **Shell** tab
3. Run:
   ```bash
   cd /opt/render/project/src/apps/backend
   pnpm prisma migrate deploy
   ```

---

## Step 7: Test the Deployment

### 7.1 Trigger First Deployment

1. Make a small change (e.g., update README)
2. Commit and push to `main` branch
3. GitHub Actions will automatically:
   - Run tests (ci.yml)
   - Deploy backend to Render (deploy-staging.yml)
   - Deploy frontend to Cloudflare Pages (deploy-staging.yml)
   - Run health checks (deploy-staging.yml)

### 7.2 Monitor Deployment

1. Go to https://github.com/daodejing/chamo/actions
2. Click on the running workflow
3. Watch the deployment progress

### 7.3 Verify Health Checks

After deployment:
```bash
# Check backend health
curl https://chamo-backend-staging.onrender.com/health

# Check GraphQL endpoint
curl -X POST https://chamo-backend-staging.onrender.com/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __typename }"}'

# Check frontend
curl https://chamo-staging.pages.dev
```

---

## Step 8: Enable Health Monitoring

The health check workflow runs automatically every 15 minutes to monitor:
- Frontend availability
- Backend health endpoint
- GraphQL endpoint

If checks fail, it creates a GitHub Issue automatically.

---

## Troubleshooting

### Backend not starting on Render
1. Check environment variables are set correctly
2. Ensure `DATABASE_URL` is valid
3. Check build logs for errors
4. Verify `pnpm` is installed during build

### Frontend build fails on Cloudflare
1. Ensure `NODE_VERSION=20` environment variable is set
2. Check `NEXT_PUBLIC_*` variables are configured
3. Verify build output directory is `out`

### Database connection fails
1. Verify Neon connection string includes `?sslmode=require`
2. Check IP allowlist in Neon (should allow all for serverless)
3. Ensure database exists and migrations ran

### Cold starts taking too long
This is expected on Render free tier (15-30 seconds). Consider:
1. Using a paid Render instance ($7/month) for instant wake
2. Implementing a ping service to keep it warm
3. Accepting cold starts for staging environment

---

## Network Security & Architecture

### Database Connectivity

**Important**: Neon and Render do **not** share a private network on the free tier.

**How it works:**
- Render backend connects to Neon database over the **public internet**
- All connections are encrypted with **SSL/TLS** (`?sslmode=require`)
- Neon enforces strong passwords (60-bit entropy)
- Connection uses certificate verification (`verify-full` mode recommended)

**Security Measures:**
- ✅ End-to-end encryption (TLS 1.2+)
- ✅ Strong authentication (random 32+ character passwords)
- ✅ Certificate validation prevents MITM attacks
- ⚠️ Database endpoint is publicly addressable (but protected)

**Is this secure for staging?**
Yes! The free tier setup is secure enough for staging because:
1. All data in transit is encrypted
2. Authentication prevents unauthorized access
3. Performance impact is minimal for low traffic

### Upgrade Options for Production

If you need enhanced security for production:

**Option 1: IP Allowlist** (Neon Scale $19/month)
- Whitelist only Render's IP addresses
- Still uses public internet but restricts access
- Blocks connection attempts from unauthorized IPs

**Option 2: Private Networking** (Enterprise)
- AWS PrivateLink between Neon and Render
- Traffic stays on AWS backbone (never touches public internet)
- Requires Professional plans on both services
- Best security, lowest latency

## Cost Summary

| Service | Free Tier | Limits |
|---------|-----------|--------|
| Neon PostgreSQL | $0/month | 3 GiB, shared compute, **public endpoint** |
| Render Web Service | $0/month | 750 hours, cold starts |
| Cloudflare Pages | $0/month | Unlimited bandwidth, 500 builds |
| GitHub Actions | $0/month | 2,000 minutes |
| **Total** | **$0/month** | Suitable for staging |

### Upgrade Path (Production)

**Basic Production** (~$27/month):
- Render Starter: $7/month (no cold starts, persistent instances)
- Neon Launch: $19/month (better performance, more storage)

**Secure Production** (~$65/month):
- Render Professional: $25/month (private networking capability)
- Neon Scale: $19/month (IP allowlist, higher limits)
- Enhanced monitoring & support

**Enterprise Production** (Custom pricing):
- AWS PrivateLink integration
- Dedicated compute resources
- 24/7 support

---

## Next Steps

1. ✅ Test the staging environment thoroughly
2. ✅ Configure custom domain (optional)
3. ✅ Set up error tracking with Sentry (optional)
4. ✅ Review and test GitHub Actions workflows
5. ✅ Document production deployment differences

## Support

For issues with:
- **Neon**: https://neon.tech/docs/introduction/support
- **Render**: https://render.com/docs/support
- **Cloudflare**: https://developers.cloudflare.com/support/
- **This project**: Create an issue at https://github.com/daodejing/chamo/issues
