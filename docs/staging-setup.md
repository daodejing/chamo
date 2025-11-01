# Staging Environment Setup - Quick Start Guide

This is a condensed step-by-step guide for setting up the Chamo staging environment. For detailed instructions with troubleshooting, see [DEPLOYMENT_SETUP.md](DEPLOYMENT_SETUP.md).

**Total Time: ~50 minutes**

---

## Prerequisites

- GitHub account with access to `daodejing/chamo` repository
- Email address for account signups
- Terminal access for running commands

---

## Step 1: Create Cloud Provider Accounts (15-20 minutes)

### 1.1 Neon PostgreSQL (Database)

1. Go to https://neon.tech
2. Sign up with GitHub/Google/email
3. Neon automatically creates a project with two branches:
   - `main` (production)
   - `dev` (development)
4. **Use the `dev` branch for staging**:
   - Click **Branches** → Select `dev` branch
   - Click **Connection Details**
   - Copy the connection string (starts with `postgresql://...`)
   - **Save as**: `STAGING_DATABASE_URL`

**Important**: Do NOT enable "Neon Auth" - your app has its own authentication system.

### 1.2 Render (Backend Hosting)

1. Go to https://render.com
2. Sign up with GitHub (recommended)
3. Authorize Render to access your GitHub account
4. You'll configure the service in Step 2

### 1.3 Cloudflare (Frontend Hosting)

1. Go to https://dash.cloudflare.com/sign-up
2. Sign up with email and create a password
3. Verify your email address
4. Skip domain setup (not needed for Pages)
5. You'll configure Pages in Step 3

### 1.4 Groq API (Optional - Translation Feature)

1. Go to https://console.groq.com
2. Sign up with Google/email
3. Go to **API Keys** → **Create API Key**
4. Name: `Chamo Staging`
5. Copy the API key
6. **Save as**: `GROQ_API_KEY`

---

## Step 2: Set Up Backend on Render (10 minutes)

### 2.1 Create Web Service

1. In Render Dashboard: **New +** → **Web Service**
2. Choose **Build and deploy from a Git repository**
3. Click **Connect** next to `daodejing/chamo`

### 2.2 Configure Service

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

### 2.3 Add Environment Variables

Click **Advanced** and add these environment variables:

```bash
DATABASE_URL=<your-neon-dev-branch-connection-string>
JWT_SECRET=<generate-below>
REFRESH_TOKEN_SECRET=<generate-below>
CORS_ALLOWED_ORIGINS=https://chamo-staging.pages.dev,http://localhost:3002
NODE_ENV=staging
PORT=4000
```

**Note**: Render automatically assigns your service URL. You'll see it after deployment (e.g., `https://chamo-xpkp.onrender.com`).

**Generate JWT Secrets** (run locally in terminal):
```bash
# Generate JWT_SECRET
openssl rand -base64 32

# Generate REFRESH_TOKEN_SECRET (use different value)
openssl rand -base64 32
```

### 2.4 Deploy and Get URLs

1. Click **Create Web Service**
2. Wait for deployment to complete (~5-10 minutes)
3. Copy your service URL from Render dashboard (e.g., `https://chamo-xpkp.onrender.com`)
   - **Note**: Render generates a unique URL like `chamo-xpkp.onrender.com`, not the service name
4. **Save these** (replace with your actual URL):
   - `STAGING_BACKEND_URL`: `https://chamo-xpkp.onrender.com`
   - `STAGING_GRAPHQL_HTTP_URL`: `https://chamo-xpkp.onrender.com/graphql`

### 2.5 Get Deploy Hook

1. Go to **Settings** → **Deploy Hook**
2. Click **Create Deploy Hook**
3. Name: `GitHub Actions - Chamo`
4. Copy the webhook URL
5. **Save as**: `RENDER_DEPLOY_HOOK_URL`

---

## Step 3: Set Up Frontend on Cloudflare Pages (10 minutes)

### 3.1 Create Pages Project

1. In Cloudflare Dashboard: **Workers & Pages** → **Create application** → **Pages**
2. Click **Connect to Git**
3. Choose **GitHub** and authorize Cloudflare
4. Select `daodejing/chamo` repository

### 3.2 Configure Build Settings

**Build Configuration:**
- **Production branch**: `main`
- **Build command**: `pnpm build`
- **Build output directory**: `out`
- **Root directory**: `/` (leave empty)

**Environment Variables** (click Add variable - use your actual Render URL):
```bash
NEXT_PUBLIC_GRAPHQL_HTTP_URL=https://chamo-xpkp.onrender.com/graphql
NEXT_PUBLIC_GRAPHQL_WS_URL=wss://chamo-xpkp.onrender.com/graphql
NEXT_PUBLIC_GROQ_API_KEY=<your-groq-api-key>
NODE_VERSION=20
```
**Important**: Replace `chamo-xpkp.onrender.com` with your actual Render service URL from Step 2.4.

### 3.3 Deploy

1. Click **Save and Deploy**
2. Wait for build to complete (~3-5 minutes)
3. Your site URL: `https://chamo-staging.pages.dev`
4. **Save as**: `STAGING_FRONTEND_URL`

### 3.4 Get API Token

1. Go to **My Profile** → **API Tokens**
2. Click **Create Token**
3. Use template: **Edit Cloudflare Workers**
4. Token name: `GitHub Actions - Chamo`
5. Permissions: Account > Cloudflare Pages > Edit
6. Account Resources: Include > Your Account
7. Click **Continue to summary** → **Create Token**
8. **Copy the token immediately** (only shown once)
9. **Save as**: `CLOUDFLARE_API_TOKEN`

### 3.5 Get Account ID

1. Go to **Workers & Pages** → **Overview**
2. On the right sidebar, copy your **Account ID**
3. **Save as**: `CLOUDFLARE_ACCOUNT_ID`

---

## Step 4: Configure GitHub Secrets (5 minutes)

1. Go to https://github.com/daodejing/chamo
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret** for each:

**Database:**
```
STAGING_DATABASE_URL=<neon-dev-branch-connection-string>
```

**Backend (Render - use your actual URL):**
```
RENDER_DEPLOY_HOOK_URL=<render-deploy-hook-url>
STAGING_BACKEND_URL=https://chamo-xpkp.onrender.com
STAGING_GRAPHQL_HTTP_URL=https://chamo-xpkp.onrender.com/graphql
```

**Frontend (Cloudflare):**
```
CLOUDFLARE_API_TOKEN=<cloudflare-api-token>
CLOUDFLARE_ACCOUNT_ID=<cloudflare-account-id>
STAGING_FRONTEND_URL=https://chamo-staging.pages.dev
```

**Optional:**
```
GROQ_API_KEY=<groq-api-key>
```

---

## Step 5: Run Database Migrations (2 minutes)

From your local machine:

```bash
# Set DATABASE_URL temporarily
export DATABASE_URL="<your-neon-dev-branch-connection-string>"

# Navigate to backend directory
cd apps/backend

# Run migrations
pnpm prisma migrate deploy

# Verify (opens Prisma Studio)
pnpm prisma studio

# Return to project root
cd ../..
```

---

## Step 6: Test Deployment (5 minutes)

### 6.1 Trigger First Deployment

1. Make a small change (e.g., add comment to README)
   ```bash
   # Example: Add a comment to README.md
   echo "<!-- Staging deployment test -->" >> README.md
   ```

2. Commit and push to `main` branch:
   ```bash
   git add README.md
   git commit -m "Test staging deployment"
   git push
   ```

3. GitHub Actions will automatically:
   - Run tests (ci.yml)
   - Deploy backend to Render (deploy-staging.yml)
   - Deploy frontend to Cloudflare Pages (deploy-staging.yml)
   - Run health checks (deploy-staging.yml)

### 6.2 Monitor Deployment

1. Go to https://github.com/daodejing/chamo/actions
2. Click on the running workflow
3. Watch the deployment progress

### 6.3 Verify Health Checks

After deployment completes, test the endpoints:

```bash
# Check backend health (replace with your actual Render URL)
curl https://chamo-xpkp.onrender.com/health

# Expected response:
# {"status":"ok","timestamp":"2025-11-01T01:58:34.876Z","uptime":44.02,"environment":"staging"}

# Check GraphQL endpoint
curl -X POST https://chamo-xpkp.onrender.com/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __typename }"}'

# Expected response:
# {"data":{"__typename":"Query"}}

# Check frontend
curl -I https://chamo-staging.pages.dev

# Expected: HTTP/2 200
```

---

## Step 7: Re-enable Health Checks (1 minute)

Once everything is working, re-enable automatic health monitoring:

1. Open `.github/workflows/health-check.yml`
2. Uncomment the schedule section:
   ```yaml
   on:
     schedule:
       # Run every 15 minutes
       - cron: '*/15 * * * *'
     workflow_dispatch: # Allow manual trigger
   ```
3. Commit and push the change

---

## Troubleshooting

### Backend not starting on Render

1. Check environment variables are set correctly in Render dashboard
2. Ensure `DATABASE_URL` is valid and includes `?sslmode=require`
3. Check build logs in Render for errors
4. Verify `pnpm` is installed during build

### Frontend build fails on Cloudflare

1. Ensure `NODE_VERSION=20` environment variable is set
2. Check `NEXT_PUBLIC_*` variables are configured correctly
3. Verify build output directory is `out`
4. Check build logs in Cloudflare Pages dashboard

### Database connection fails

1. Verify Neon connection string includes `?sslmode=require`
2. Check you're using the `dev` branch connection string
3. Ensure database exists and migrations ran successfully
4. Test connection locally with `pnpm prisma studio`

### Cold starts on Render (15-30 seconds)

This is expected on Render free tier:
- Service spins down after 15 minutes of inactivity
- First request after sleep takes 15-30 seconds to wake up
- Acceptable for staging environment
- Consider paid tier ($7/month) for instant wake if needed

---

## Next Steps

After successful deployment:

1. ✅ Test the staging application in your browser
2. ✅ Create a test family and verify E2EE works
3. ✅ Test invite code sharing between users
4. ✅ Monitor GitHub Actions for future deployments
5. ✅ Set up error tracking with Sentry (optional)
6. ✅ Plan production deployment differences

---

## Cost Summary

| Service | Free Tier | What You're Using |
|---------|-----------|-------------------|
| Neon PostgreSQL | 3 GiB storage, shared compute | Dev branch only |
| Render Web Service | 750 hours/month, cold starts | 24/7 with cold starts |
| Cloudflare Pages | Unlimited bandwidth, 500 builds/month | Staging deployments |
| GitHub Actions | 2,000 minutes/month | CI/CD pipelines |
| **Total** | **$0/month** | Staging environment |

---

## Support

For issues:
- **Neon**: https://neon.tech/docs/introduction/support
- **Render**: https://render.com/docs/support
- **Cloudflare**: https://developers.cloudflare.com/support/
- **This project**: https://github.com/daodejing/chamo/issues
