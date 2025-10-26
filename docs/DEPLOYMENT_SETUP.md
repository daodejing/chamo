# OurChat Staging Deployment Setup Guide

This guide walks you through setting up the complete staging environment for OurChat using free-tier cloud services. Total cost: **$0/month**.

## Overview

The staging stack consists of:
- **Frontend**: Cloudflare Pages (Next.js static export)
- **Backend**: Render Web Service (NestJS + GraphQL)
- **Database**: Neon PostgreSQL (serverless)
- **CI/CD**: GitHub Actions (automated deployments)

---

## Prerequisites

- GitHub account with access to `daodejing/ourchat` repository
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
3. Name it `ourchat-staging`
4. Select a region (choose closest to your users)
5. Click **Create Project**

### 1.3 Get Connection String

1. In your project dashboard, click **Connection Details**
2. Copy the **Connection String** - it looks like:
   ```
   postgresql://username:password@ep-xxxxx.region.aws.neon.tech/ourchat_staging?sslmode=require
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
3. Click **Connect** next to `daodejing/ourchat`
4. Configure the service:

   **Basic Settings:**
   - **Name**: `ourchat-backend-staging`
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
   CORS_ALLOWED_ORIGINS=https://ourchat-staging.pages.dev,http://localhost:3002
   NODE_ENV=staging
   PORT=4000
   ```

6. Click **Create Web Service**

### 2.3 Get Service URLs

After deployment completes:
1. Copy your service URL (e.g., `https://ourchat-backend-staging.onrender.com`)
2. **Save these URLs**:
   - `STAGING_BACKEND_URL`: `https://ourchat-backend-staging.onrender.com`
   - `STAGING_GRAPHQL_HTTP_URL`: `https://ourchat-backend-staging.onrender.com/graphql`

### 2.4 Get Deploy Hook

1. In your service settings, go to **Settings** → **Deploy Hook**
2. Click **Create Deploy Hook**
3. Name it `GitHub Actions`
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
5. Select `daodejing/ourchat` repository
6. Configure build settings:

   **Build Configuration:**
   - **Production branch**: `main`
   - **Build command**: `pnpm build`
   - **Build output directory**: `out`
   - **Root directory**: `/` (leave empty)

   **Environment Variables** (click Add variable):
   ```
   NEXT_PUBLIC_GRAPHQL_HTTP_URL=https://ourchat-backend-staging.onrender.com/graphql
   NEXT_PUBLIC_GRAPHQL_WS_URL=wss://ourchat-backend-staging.onrender.com/graphql
   NEXT_PUBLIC_GROQ_API_KEY=<your-groq-api-key>
   NODE_VERSION=20
   ```

7. Click **Save and Deploy**

### 3.3 Get Deployment URLs

After build completes:
1. Your site will be at `https://ourchat-staging.pages.dev`
2. **Save as**: `STAGING_FRONTEND_URL` (GitHub Secret)

### 3.4 Get API Token for GitHub Actions

1. Go to **My Profile** → **API Tokens**
2. Click **Create Token**
3. Use template: **Edit Cloudflare Workers**
4. Token name: `GitHub Actions - OurChat`
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
3. Name it `OurChat Staging`
4. Copy the API key
5. **Save as**: `GROQ_API_KEY` (GitHub Secret)

### Free Tier Limits
- Generous free tier for testing
- Rate limits apply

---

## Step 5: Configure GitHub Secrets

### 5.1 Add Repository Secrets

1. Go to https://github.com/daodejing/ourchat
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret** for each:

   **Database:**
   ```
   STAGING_DATABASE_URL=postgresql://username:password@ep-xxxxx.region.aws.neon.tech/ourchat_staging?sslmode=require
   ```

   **Backend (Render):**
   ```
   RENDER_DEPLOY_HOOK_URL=https://api.render.com/deploy/srv-xxxxx
   STAGING_BACKEND_URL=https://ourchat-backend-staging.onrender.com
   STAGING_GRAPHQL_HTTP_URL=https://ourchat-backend-staging.onrender.com/graphql
   ```

   **Frontend (Cloudflare):**
   ```
   CLOUDFLARE_API_TOKEN=<your-cloudflare-api-token>
   CLOUDFLARE_ACCOUNT_ID=<your-cloudflare-account-id>
   STAGING_FRONTEND_URL=https://ourchat-staging.pages.dev
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
export DATABASE_URL="postgresql://username:password@ep-xxxxx.region.aws.neon.tech/ourchat_staging?sslmode=require"

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

1. Go to https://github.com/daodejing/ourchat/actions
2. Click on the running workflow
3. Watch the deployment progress

### 7.3 Verify Health Checks

After deployment:
```bash
# Check backend health
curl https://ourchat-backend-staging.onrender.com/health

# Check GraphQL endpoint
curl -X POST https://ourchat-backend-staging.onrender.com/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __typename }"}'

# Check frontend
curl https://ourchat-staging.pages.dev
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

## Cost Summary

| Service | Free Tier | Limits |
|---------|-----------|--------|
| Neon PostgreSQL | $0/month | 3 GiB, shared compute |
| Render Web Service | $0/month | 750 hours, cold starts |
| Cloudflare Pages | $0/month | Unlimited bandwidth, 500 builds |
| GitHub Actions | $0/month | 2,000 minutes |
| **Total** | **$0/month** | Suitable for staging |

### Upgrade Path (Production)
- Render Starter: $7/month (no cold starts)
- Neon Launch: $19/month (better performance)
- **Production Total**: ~$27/month

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
- **This project**: Create an issue at https://github.com/daodejing/ourchat/issues
