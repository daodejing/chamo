# Cloud Deployment Options for OurChat

**Date:** 2025-10-25
**Author:** Winston (BMAD Architecture Agent)
**Status:** Active Research
**Version:** 1.0
**Related:** [Solution Architecture](../solution-architecture.md), [Local Dev Architecture](./local-dev-architecture.md)

---

## Executive Summary

This document provides a comprehensive analysis of cloud deployment options for OurChat in 2025, including cost analysis, provider comparisons, and migration strategies.

### Key Findings

1. **PlanetScale Free Tier Eliminated:** The current architecture document references PlanetScale's free tier, which was discontinued on April 8, 2024. Migration to alternative database providers is required.

2. **Redis Not Currently Used:** Despite being mentioned in the architecture, Redis/Upstash is not implemented. It's only needed for Story 2.1 (Scheduled Messages), which hasn't been built yet.

3. **Static Export Viable:** The frontend is client-heavy with no API routes and disabled middleware, making it suitable for static export to services like Cloudflare Pages ($0 vs Vercel Pro $20/month).

4. **Current Service Needs:**
   - Frontend: Next.js 15 + React 19 (client-side heavy)
   - Backend: NestJS + GraphQL + WebSocket subscriptions
   - Database: MySQL (requires migration from PlanetScale)
   - Storage: Cloudflare R2 (optional, for photos)

### Cost Summary

| Deployment Tier | Monthly Cost | Suitable For |
|----------------|--------------|--------------|
| Free MVP | $0 | Development, testing, non-commercial |
| Commercial MVP | $20 | Initial launch, <10 families |
| Production Ready | $26-28 | 10-50 families, stable traffic |
| Production (Vercel) | $46 | Alternative with Vercel Pro |
| Scale | $120-150 | 100-500 families |

---

## Table of Contents

1. [Current Architecture Analysis](#current-architecture-analysis)
2. [Database Migration Urgency](#database-migration-urgency)
3. [Deployment Option 1: AWS-Focused Stack](#deployment-option-1-aws-focused-stack)
4. [Deployment Option 2: Best Free Forever Stack (Recommended)](#deployment-option-2-best-free-forever-stack-recommended)
5. [Deployment Option 3: Cloudflare Serverless Stack](#deployment-option-3-cloudflare-serverless-stack)
6. [Static Export Analysis](#static-export-analysis)
7. [Service Provider Comparison](#service-provider-comparison)
8. [Phased Deployment Strategy](#phased-deployment-strategy)
9. [Cost Analysis & Projections](#cost-analysis--projections)
10. [Recommendations](#recommendations)
11. [Architecture Decision Records](#architecture-decision-records)
12. [Migration Guides](#migration-guides)

---

## Current Architecture Analysis

### Technology Stack (Actual Implementation)

Based on codebase analysis as of 2025-10-25:

**Frontend:**
- Next.js 15.0.3 + React 19.0.0
- Apollo Client 3.9.0 (GraphQL client)
- All components use `"use client"` directive (client-side rendering)
- No API routes in `/app/api/`
- Middleware disabled (commented out in middleware.ts)
- Currently targeting Vercel deployment

**Backend:**
- NestJS 11.0.1 with Apollo Server 5.0.0
- GraphQL API with WebSocket subscriptions (graphql-subscriptions)
- Prisma 6.17.1 ORM
- JWT authentication (passport-jwt)
- Currently configured for MySQL
- No Redis/Bull queue implementation found
- No scheduled message processing

**Database:**
- MySQL 8.0 (via docker-compose for local dev)
- Architecture document mentions PlanetScale, but free tier no longer exists
- Prisma schema currently uses `provider = "mysql"`

**External Services:**
- Groq API (translation) - client-side
- Google OAuth (calendar) - planned but optional
- Cloudflare R2 - planned for photo storage

### Key Architecture Characteristics

1. **Client-Side Heavy:** Almost all React components are client-side ("use client"), minimal server-side rendering needs
2. **GraphQL-First:** All data fetching via Apollo Client to separate NestJS backend
3. **No Server Dependencies:** Frontend doesn't rely on Next.js server features (no API routes, disabled middleware)
4. **Real-Time via WebSocket:** GraphQL subscriptions for chat, not using REST subscriptions
5. **Standalone Backend:** NestJS runs independently, not integrated with Next.js

**Implication:** Frontend could be deployed as static export to CDN, dramatically reducing costs.

---

## Database Migration Urgency

### Critical Issue: PlanetScale Free Tier Eliminated

**Timeline:**
- **April 8, 2024:** PlanetScale discontinued their Hobby (free) plan
- **Current Status:** Minimum cost is $29/month (Scaler Pro plan)
- **Impact:** Architecture document's $0/month cost projections are outdated

### Migration Required

You **must** migrate from PlanetScale to an alternative. Options:

1. **Pay for PlanetScale:** $29/month minimum (not recommended for MVP)
2. **Migrate to Neon PostgreSQL:** 0.5GB free tier, requires schema conversion
3. **Use AWS RDS Free Tier:** 12 months free, then ~$15-25/month
4. **Use Supabase PostgreSQL:** 500MB free tier, architecture change required

**Recommended:** Migrate to **Neon PostgreSQL** (see migration guide below)

---

## Deployment Option 1: AWS-Focused Stack

### Overview

Leverage AWS's 12-month free tier for new accounts, with a $200 credit bonus for accounts created after July 2025.

### Service Breakdown

| Service | Purpose | Free Tier | After Free Tier | Notes |
|---------|---------|-----------|-----------------|-------|
| **AWS Amplify Hosting** | Next.js SSR hosting | $200 credits (6 months) | ~$7-15/month | SSR support, auto-deploy |
| **AWS RDS MySQL** | Database | db.t4g.micro, 20GB (12 months) | ~$15-25/month | Burstable instance |
| **Vercel** (Alternative) | Next.js hosting | $0 hobby / $20 Pro | $20/month | Better DX than Amplify |
| **Upstash Redis** | Cache/queue (future) | 10k commands/day | Pay-as-you-go | Only needed for Story 2.1 |
| **Cloudflare R2** | Object storage | 10GB, 1M writes/month | ~$1-2/month | Photos |

### Cost Timeline

**Months 1-6 (New AWS Account with $200 credits):**
- Amplify: $0 (covered by credits)
- RDS: $0 (free tier)
- R2: $0 (free tier)
- **Total: $0/month**

**Months 7-12 (Credits exhausted, RDS still free):**
- Amplify: ~$10/month
- RDS: $0 (free tier continues)
- R2: $0 (free tier)
- **Total: ~$10/month**

**After 12 Months:**
- Amplify: ~$10/month
- RDS: ~$20/month (or migrate to Neon)
- R2: ~$2/month
- Upstash: $0 (if usage stays low)
- **Total: ~$32/month**

### Pros & Cons

**Pros:**
- ✅ Enterprise-grade infrastructure from day 1
- ✅ Generous free tier (12 months)
- ✅ $200 credits for new accounts (2025 onwards)
- ✅ Familiar AWS ecosystem
- ✅ Easy scaling path
- ✅ MySQL support (no migration needed)

**Cons:**
- ❌ Free tier limited to 12 months
- ❌ RDS gets expensive after free tier (~$20/month)
- ❌ AWS complexity (IAM, VPC, security groups)
- ❌ Amplify DX worse than Vercel for Next.js
- ❌ Only viable for new AWS accounts

### When to Choose This Option

- You're a new AWS customer (can get $200 credits)
- You want enterprise infrastructure from day 1
- You're comfortable with AWS ecosystem
- You can accept 12-month commitment before costs increase

---

## Deployment Option 2: Best Free Forever Stack (Recommended)

### Overview

Maximize free tiers across modern PaaS providers, prioritizing services with permanent free tiers.

### Service Breakdown

| Service | Purpose | Free Tier | Paid Tier | Notes |
|---------|---------|-----------|-----------|-------|
| **Cloudflare Pages** | Next.js static hosting | Unlimited bandwidth, 500 builds/month | N/A (free sufficient) | Requires static export |
| **Render** | NestJS backend | 750hrs/month, auto-sleep | $7/month (always-on) | 30-60s cold start on free |
| **Neon PostgreSQL** | Database | 0.5GB storage, 191.9 compute hrs/month | $19/month (Launch plan) | Serverless, auto-scales to zero |
| **Upstash Redis** | Cache/queue (future) | 10k commands/day | Pay-as-you-go | Only for Story 2.1 |
| **Cloudflare R2** | Object storage | 10GB storage, 1M writes/month | ~$0.015/GB | Photos |
| **Groq API** | LLM translation | Generous free tier | Pay-per-token | Client-side calls |

### Cost Timeline

**MVP (Development/Testing):**
- Cloudflare Pages: $0
- Render: $0 (accept cold starts)
- Neon: $0
- R2: $0
- **Total: $0/month**

**Commercial MVP (<10 families):**
- Cloudflare Pages: $0
- Render: $0 (cold starts acceptable)
- Neon: $0
- R2: $0
- **Total: $0/month**

**Production Ready (10-50 families):**
- Cloudflare Pages: $0
- Render Starter: $7/month (persistent, no cold start)
- Neon Launch: $19/month (better performance)
- R2: ~$1/month
- **Total: ~$27/month**

**Scale (100-500 families):**
- Cloudflare Pages: $0
- Render Standard: $25/month
- Neon Scale: $69/month
- R2: ~$3/month
- Upstash Pro: ~$20/month (if using scheduled messages)
- **Total: ~$117-120/month**

### Migration Requirements

**Critical:** Requires migrating from MySQL to PostgreSQL

```prisma
// Before (MySQL)
datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

// After (PostgreSQL)
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Most schema changes are automatic via Prisma. Notable differences:
- JSON columns work differently
- Some data types map differently (e.g., `@db.Text` vs `TEXT`)
- Connection strings change format

See [Migration Guide](#migrating-from-mysql-to-postgresql) below.

### Pros & Cons

**Pros:**
- ✅ $0/month possible indefinitely
- ✅ Free tiers are permanent (not time-limited)
- ✅ Cloudflare Pages = zero frontend cost forever
- ✅ Neon's serverless model scales to zero
- ✅ Modern, developer-friendly platforms
- ✅ Easy upgrade path when needed
- ✅ No vendor lock-in (Neon uses standard PostgreSQL)

**Cons:**
- ❌ Requires MySQL → PostgreSQL migration
- ❌ Render free tier has cold starts (30-60s)
- ❌ Neon free tier limited to 0.5GB (sufficient for 50-100 families)
- ❌ Requires Next.js static export (loses SSR, though not currently used)
- ❌ Free tiers not suitable for production SLAs

### When to Choose This Option

- You want $0 hosting for MVP/testing
- You can accept cold starts initially
- You're willing to do PostgreSQL migration
- You want permanent free tiers, not 12-month trials
- You prioritize cost optimization over enterprise features

**Verdict:** **Best option for OurChat** given client-heavy architecture and budget constraints.

---

## Deployment Option 3: Cloudflare Serverless Stack

### Overview

All-in on Cloudflare's edge platform using Workers, Pages, and D1 database.

### Service Breakdown

| Service | Purpose | Free Tier | Notes |
|---------|---------|-----------|-------|
| **Cloudflare Pages** | Next.js hosting | Unlimited requests, 500 builds/month | 3MB worker limit |
| **Cloudflare Workers** | Serverless functions | 100k requests/day | For backend logic |
| **Cloudflare D1** | Database (SQLite) | 10GB storage, unlimited databases | **Not MySQL or PostgreSQL** |
| **Cloudflare R2** | Object storage | 10GB, 1M writes/month | Same as Option 2 |

### Architecture Changes Required

1. **Database:** Migrate from MySQL to SQLite (D1)
   - Significant schema changes
   - D1 is SQLite-based, not relational like MySQL/PostgreSQL
   - Prisma support for D1 is experimental

2. **Backend:** Migrate from NestJS to Cloudflare Workers
   - NestJS doesn't run on Workers (V8 isolate, not Node.js)
   - Would need to rewrite GraphQL server for Workers runtime
   - OR: Keep NestJS on Render, only frontend on Cloudflare

3. **Worker Size Limits:** 3MB compressed on free tier
   - Next.js apps can exceed this
   - Would require bundle optimization

### Cost

**Completely free** if you fit within limits:
- Pages: $0
- Workers: $0 (100k req/day)
- D1: $0
- R2: $0

### Pros & Cons

**Pros:**
- ✅ Completely free at scale
- ✅ Edge deployment (ultra-low latency)
- ✅ Unlimited scalability
- ✅ Cloudflare's global network

**Cons:**
- ❌ Requires complete database rewrite (MySQL → SQLite)
- ❌ Backend rewrite (NestJS → Workers or keep separate)
- ❌ 3MB worker size limit challenging for Next.js
- ❌ D1 is less mature than PostgreSQL/MySQL
- ❌ Prisma support for D1 is experimental
- ❌ Steep learning curve
- ❌ V8 isolate limitations (no native Node.js APIs)

### When to Choose This Option

- You're starting from scratch (not migrating)
- You want edge-native architecture
- You're comfortable with experimental tech
- You can rewrite backend for Workers
- You need global low-latency deployment

**Verdict:** **Not recommended for OurChat** due to extensive rewrites required.

---

## Static Export Analysis

### Why OurChat Can Use Static Export

Analysis of your codebase shows:

1. **No API Routes:** `src/app/api/` directory is empty
2. **Middleware Disabled:** `middleware.ts` currently returns `NextResponse.next()` without auth checks
3. **Client-Side Components:** All components use `"use client"` directive
4. **GraphQL Client:** Apollo Client handles all data fetching to separate NestJS backend
5. **No SSR Dependencies:** No `getServerSideProps`, `getStaticProps`, or server components

### What You'd Lose

If you enable static export (`output: 'export'` in next.config.js):

- ❌ Server-side rendering (not currently used)
- ❌ API routes (don't exist in your app)
- ❌ Middleware (currently disabled anyway)
- ❌ Image optimization (could use Cloudflare Images)
- ❌ Incremental static regeneration (not used)

### What You'd Keep

- ✅ Client-side routing (React Router via Next.js)
- ✅ All React components
- ✅ Apollo Client GraphQL queries/mutations/subscriptions
- ✅ Client-side authentication (JWT stored in cookies/localStorage)
- ✅ WebSocket connections to NestJS backend

### Static Export Configuration

```javascript
// next.config.js
const nextConfig = {
  output: 'export',  // Enable static export

  // Rest of your config remains the same
  reactStrictMode: true,
  // ... headers, images, etc.
}
```

### Build & Deploy Process

```bash
# Build static site
npm run build
# Output goes to 'out/' directory

# Deploy to Cloudflare Pages
npx wrangler pages deploy out --project-name ourchat

# Or drag & drop 'out' folder to Cloudflare dashboard
```

### Cost Comparison

| Platform | Type | Cost | Notes |
|----------|------|------|-------|
| **Vercel Hobby** | Next.js platform | $0 | Non-commercial only |
| **Vercel Pro** | Next.js platform | $20/month | Required for commercial use |
| **Cloudflare Pages** | Static hosting | $0 | Unlimited commercial use |
| **Netlify** | Static hosting | $0 | Alternative to Cloudflare |
| **AWS S3 + CloudFront** | Static hosting | ~$1-3/month | After free tier |

**Savings:** $20/month (Vercel Pro) → $0/month (Cloudflare Pages)

### Recommendation

**Use static export to Cloudflare Pages** because:
1. You're not using Next.js server features
2. Saves $20/month (Vercel Pro cost)
3. Global CDN with unlimited bandwidth
4. No cold starts (always fast)
5. Easy rollback to Vercel if you need server features later

---

## Service Provider Comparison

### Frontend Hosting

| Provider | Free Tier | Bandwidth | Builds/Month | SSR Support | Cost After Free |
|----------|-----------|-----------|--------------|-------------|-----------------|
| **Vercel** | Hobby: Yes (non-commercial) | 100GB/month | Unlimited | Yes | $20/month (Pro) |
| **Cloudflare Pages** | Yes | Unlimited | 500 | Via Workers | N/A (free sufficient) |
| **Netlify** | Yes | 100GB/month | 300 minutes | Via Functions | $19/month |
| **AWS Amplify** | 6mo ($200 credits) | 15GB/month | 1000 minutes | Yes | ~$10-15/month |

**Winner for OurChat:** Cloudflare Pages (static export) or Vercel (if need SSR)

### Backend Hosting (NestJS)

| Provider | Free Tier | Always-On | Cold Start | Memory | Cost After Free |
|----------|-----------|-----------|------------|--------|-----------------|
| **Render** | 750hrs/month | No (auto-sleep) | 30-60s | 512MB | $7/month (Starter) |
| **Railway** | $5 trial credit | No | N/A | Variable | ~$10-15/month |
| **Fly.io** | No free tier | N/A | N/A | N/A | $5/month minimum |
| **AWS ECS Fargate** | No free tier | Yes | N/A | Configurable | ~$25-40/month |
| **Heroku** | No free tier | N/A | N/A | N/A | $5/month minimum |

**Winner for OurChat:** Render (750hrs = 31 days if always-on, or use $7 Starter)

### Database (PostgreSQL)

| Provider | Free Tier Storage | Compute | Limits | Cost After Free |
|----------|-------------------|---------|--------|-----------------|
| **Neon** | 0.5GB | 191.9 hrs/month | Auto-scales to zero | $19/month (Launch) |
| **Supabase** | 500MB | Shared | 2 projects, pauses after 7 days | $25/month (Pro) |
| **AWS RDS** | 20GB (12 months) | db.t4g.micro | 12-month limit | ~$20/month |
| **PlanetScale** | None | N/A | Free tier eliminated | $29/month minimum |

**Winner for OurChat:** Neon (best free tier, serverless, standard PostgreSQL)

### Object Storage

| Provider | Free Tier | Egress Fees | Notes |
|----------|-----------|-------------|-------|
| **Cloudflare R2** | 10GB storage, 1M writes/month | $0 | Zero egress fees |
| **AWS S3** | 5GB (12 months) | ~$0.09/GB | Free tier time-limited |
| **Backblaze B2** | 10GB storage | Free up to 3x storage | Good alternative |

**Winner for OurChat:** Cloudflare R2 (zero egress fees crucial for photos)

---

## Phased Deployment Strategy

### Phase 1: MVP Launch (Months 1-3)

**Goal:** Get to $0 hosting for development and early testing

**Stack:**
- Frontend: Cloudflare Pages (static export) - $0
- Backend: Render Free Tier - $0
- Database: Neon Free Tier - $0
- Storage: Cloudflare R2 - $0

**Actions:**
1. Migrate Prisma schema from MySQL to PostgreSQL
2. Configure Next.js for static export
3. Deploy frontend to Cloudflare Pages
4. Deploy backend to Render
5. Set up Neon PostgreSQL database
6. Configure CORS for GraphQL (Cloudflare → Render)

**Limitations:**
- ⚠️ Backend has 30-60s cold start after inactivity
- ⚠️ Database limited to 0.5GB (sufficient for 50-100 families)
- ⚠️ No SLA guarantees

**Cost: $0/month**

### Phase 2: Production Ready (Months 3-6, 10-50 Families)

**Goal:** Remove cold starts, improve reliability

**Stack:**
- Frontend: Cloudflare Pages - $0
- Backend: Render Starter (always-on) - $7/month
- Database: Neon Launch (better performance) - $19/month
- Storage: Cloudflare R2 - ~$1/month

**Upgrade Triggers:**
- Backend cold starts impacting user experience
- Need better database performance
- Storing >0.5GB of data in Neon

**Cost: ~$27/month**

### Phase 3: Scale (Months 6-12, 100-500 Families)

**Goal:** Handle significant traffic, add advanced features

**Stack:**
- Frontend: Cloudflare Pages - $0
- Backend: Render Standard (2GB RAM, 2 CPU) - $25/month
- Database: Neon Scale (8GB, better performance) - $69/month
- Storage: Cloudflare R2 - ~$3/month
- Redis: Upstash Pro - ~$20/month (if using scheduled messages)

**New Features:**
- Scheduled messages (requires Redis)
- Advanced caching
- Multiple backend instances

**Cost: ~$117-120/month**

### Alternative: Vercel-Based Path

If you prefer staying with Vercel instead of static export:

**Phase 1 (MVP):**
- Vercel Hobby (non-commercial) - $0
- Render Free - $0
- Neon Free - $0
- **Total: $0/month**

**Phase 2 (Commercial):**
- Vercel Pro - $20/month
- Render Starter - $7/month
- Neon Launch - $19/month
- **Total: $46/month**

**Trade-off:** Pay extra $20/month for Vercel Pro vs doing static export to Cloudflare Pages.

---

## Cost Analysis & Projections

### Free Tier Comparison (MVP Development)

| Component | Cloudflare Stack | Vercel Stack | AWS Stack |
|-----------|------------------|--------------|-----------|
| Frontend | $0 (Pages) | $0 (Hobby) | $0 (credits) |
| Backend | $0 (Render) | $0 (Render) | $0 (credits) |
| Database | $0 (Neon) | $0 (Neon) | $0 (12mo free) |
| Storage | $0 (R2) | $0 (R2) | $0 (12mo free) |
| **Total** | **$0/month** | **$0/month** | **$0/month** |
| **Duration** | Indefinite | Until commercial | 6-12 months |

### Commercial Production Costs (10-50 Families)

| Component | Cloudflare Stack | Vercel Stack | AWS Stack |
|-----------|------------------|--------------|-----------|
| Frontend | $0 (Pages) | $20 (Pro) | $10 (Amplify) |
| Backend | $7 (Render Starter) | $7 (Render Starter) | $10 (Amplify/ECS) |
| Database | $19 (Neon Launch) | $19 (Neon Launch) | $20 (RDS) |
| Storage | $1 (R2) | $1 (R2) | $2 (S3) |
| **Total** | **$27/month** | **$46/month** | **$42/month** |

### Scale Costs (100-500 Families)

| Component | Cloudflare Stack | Vercel Stack | AWS Stack |
|-----------|------------------|--------------|-----------|
| Frontend | $0 (Pages) | $20 (Pro) | $15 (Amplify) |
| Backend | $25 (Render Standard) | $25 (Render Standard) | $40 (ECS) |
| Database | $69 (Neon Scale) | $69 (Neon Scale) | $50 (RDS db.t3.medium) |
| Redis | $20 (Upstash Pro) | $20 (Upstash Pro) | $30 (ElastiCache) |
| Storage | $3 (R2) | $3 (R2) | $5 (S3) |
| **Total** | **$117/month** | **$137/month** | **$140/month** |

### Break-Even Analysis (Cloudflare Stack)

Assuming $5/month per family subscription:

| Tier | Monthly Cost | Families Needed | Monthly Revenue | Margin |
|------|--------------|-----------------|-----------------|--------|
| MVP (Free) | $0 | 1 | $5 | 100% |
| Production | $27 | 6 | $30 | 10% |
| Scale | $117 | 24 | $120 | 2.5% |

**Key Insight:** With Cloudflare Pages (free frontend), you reach profitability at just 6 paying families.

### Cost Per Family (100 Families, Cloudflare Stack)

- Infrastructure: $117/month
- Cost per family: $1.17/month
- If charging $5/month: $3.83 profit per family
- Gross margin: 76.6%

**Highly sustainable business model.**

---

## Recommendations

### Immediate Actions (Next 30 Days)

1. **Migrate Database to Neon PostgreSQL**
   - PlanetScale has no free tier (minimum $29/month)
   - Neon offers 0.5GB free forever
   - Migration is straightforward with Prisma
   - Estimated effort: 2-4 hours

2. **Configure Static Export for Next.js**
   - Add `output: 'export'` to next.config.js
   - Test build: `npm run build`
   - Verify all routes work without server
   - Estimated effort: 1-2 hours

3. **Deploy Frontend to Cloudflare Pages**
   - Create Cloudflare account
   - Connect GitHub repository
   - Configure build settings
   - Test deployment
   - Estimated effort: 1 hour

4. **Keep Backend on Render Free Tier**
   - Deploy NestJS to Render
   - Accept cold starts for MVP
   - Upgrade to $7/month when launching
   - Estimated effort: 2 hours

### Short-Term Strategy (Months 1-3)

**Target: $0/month hosting**

- ✅ Frontend: Cloudflare Pages (static)
- ✅ Backend: Render Free (accept cold starts)
- ✅ Database: Neon Free (0.5GB sufficient)
- ✅ Storage: Cloudflare R2 (10GB free)

**When to upgrade:** User complaints about cold starts OR commercial launch.

### Medium-Term Strategy (Months 3-6)

**Target: $27/month production-ready**

Upgrade triggers:
1. Backend cold starts hurting UX → Render Starter ($7)
2. Need better DB performance → Neon Launch ($19)
3. Storing photos regularly → R2 paid tier (~$1)

### Long-Term Strategy (Months 6-12)

**Target: $117/month for scale**

Scale triggers:
1. 100+ families → Neon Scale ($69)
2. High traffic → Render Standard ($25)
3. Implement Story 2.1 (scheduled messages) → Upstash Pro ($20)

### Alternative: Vercel Path

If you prefer staying on Vercel:

**Pros:**
- Better Next.js DX
- No need for static export config
- Easier deployment

**Cons:**
- Costs $20/month for commercial (Vercel Pro)
- Total production cost: $46/month vs $27/month

**When to choose:** If $20/month difference isn't significant and you value Vercel's DX.

### Redis: Don't Add Yet

**Current status:** Not implemented in codebase

**Only needed for:**
- Story 2.1: Scheduled Messages (Bull queue)
- Advanced caching (optional optimization)

**Recommendation:** Wait until implementing scheduled messages. Upstash free tier (10k commands/day) should suffice initially.

---

## Architecture Decision Records

### ADR-001: Migrate from PlanetScale to Neon PostgreSQL

**Status:** Recommended

**Context:**
- PlanetScale eliminated free tier (April 2024)
- Current architecture assumes PlanetScale free tier ($0)
- Minimum PlanetScale cost now $29/month
- Need cost-effective database for MVP

**Decision:** Migrate to Neon PostgreSQL

**Rationale:**
- ✅ 0.5GB free tier (permanent, not time-limited)
- ✅ Serverless (auto-scales to zero, pay for what you use)
- ✅ Standard PostgreSQL (no vendor lock-in)
- ✅ Excellent Prisma support
- ✅ Database branching like PlanetScale
- ✅ Generous free tier (191.9 compute hours/month)

**Consequences:**
- Requires MySQL → PostgreSQL migration
- Most changes handled automatically by Prisma
- Some data type mapping differences
- Better long-term cost structure ($19/month Launch plan vs $29/month PlanetScale minimum)

**Alternatives Considered:**
- PlanetScale: Rejected due to $29/month minimum cost
- AWS RDS: Rejected due to 12-month time limit on free tier
- Supabase: Rejected due to 500MB limit (vs Neon's 0.5GB) and 7-day pause

---

### ADR-002: Use Static Export for Next.js Frontend

**Status:** Recommended

**Context:**
- Current app has no API routes
- Middleware is disabled
- All components use "use client" (client-side)
- All data fetching via Apollo Client to NestJS backend
- Vercel Pro costs $20/month for commercial use

**Decision:** Enable static export, deploy to Cloudflare Pages

**Rationale:**
- ✅ Saves $20/month (Vercel Pro → Cloudflare Pages free)
- ✅ No loss of functionality (not using SSR, API routes, middleware)
- ✅ Unlimited bandwidth on Cloudflare
- ✅ Global CDN with zero cold starts
- ✅ Easy to revert if needed later

**Consequences:**
- Cannot use server-side rendering (not currently used)
- Cannot add API routes without reverting
- Cannot use Next.js middleware (currently disabled)
- Must use client-side auth (already doing this)

**Implementation:**
```javascript
// next.config.js
output: 'export'
```

**Alternatives Considered:**
- Vercel Hobby (free): Rejected because prohibits commercial use
- Vercel Pro ($20/month): Rejected because paying for unused features
- Netlify: Similar to Cloudflare Pages, either works

---

### ADR-003: Keep Backend on Render vs AWS

**Status:** Accepted

**Context:**
- Need to host NestJS + GraphQL backend
- Backend has WebSocket support (GraphQL subscriptions)
- Want minimal operational complexity
- Budget-conscious for MVP

**Decision:** Use Render (free tier for MVP, $7 Starter for production)

**Rationale:**
- ✅ 750 hours/month free tier (31 days if always-on)
- ✅ Native WebSocket support
- ✅ Auto-deploy from Git
- ✅ Simple Dockerfile deployment
- ✅ $7/month Starter plan removes cold starts
- ✅ No AWS complexity (VPC, security groups, ECS config)

**Consequences:**
- Free tier has 30-60s cold starts after inactivity
- Acceptable for MVP/testing
- Need to upgrade to $7/month for production
- Less flexibility than AWS ECS/Fargate

**Alternatives Considered:**
- Railway: No free tier (only $5 trial credit), costs $10-15/month
- Fly.io: No free tier, $5/month minimum
- AWS ECS Fargate: More complex, ~$25-40/month minimum
- Heroku: No free tier, $5/month minimum

---

### ADR-004: Don't Implement Redis Yet

**Status:** Accepted

**Context:**
- Architecture document mentions Redis/Upstash for Bull queue
- Codebase analysis shows no Redis implementation
- Story 2.1 (Scheduled Messages) not yet built
- Redis only needed for job queue

**Decision:** Wait to add Redis until implementing Story 2.1

**Rationale:**
- ✅ YAGNI principle (You Aren't Gonna Need It)
- ✅ Reduces complexity for MVP
- ✅ Upstash free tier (10k commands/day) will suffice when needed
- ✅ Easy to add later (no migration needed)

**Consequences:**
- Cannot implement scheduled messages yet
- No distributed caching (acceptable for MVP)
- Simpler architecture
- Lower learning curve

**When to Revisit:**
- When implementing Story 2.1 (Scheduled Messages)
- If need distributed caching for performance

---

## Migration Guides

### Migrating from MySQL to PostgreSQL

#### Step 1: Update Prisma Schema

```prisma
// prisma/schema.prisma

// BEFORE
datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

// AFTER
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

#### Step 2: Handle Data Type Differences

Most types are compatible, but check these:

```prisma
// MySQL-specific → PostgreSQL
@db.Text          → @db.Text (same)
@db.VarChar(255)  → @db.VarChar(255) (same)
DateTime @db.Date → DateTime @db.Date (same)
DateTime @db.Time → Time (PostgreSQL type)
Json              → Json (same, but behavior differs)

// Notable differences:
// - MySQL ENUM → PostgreSQL enum type (Prisma handles this)
// - MySQL TINYINT(1) for Boolean → PostgreSQL BOOLEAN
```

#### Step 3: Create Neon Database

1. Go to https://neon.tech
2. Sign up for free account
3. Create new project
4. Copy connection string

Example connection string:
```
postgresql://username:password@ep-cool-name-123456.us-east-2.aws.neon.tech/ourchat?sslmode=require
```

#### Step 4: Update Environment Variables

```bash
# .env (backend)
# Before (MySQL)
DATABASE_URL="mysql://user:password@localhost:3306/ourchat_dev"

# After (PostgreSQL/Neon)
DATABASE_URL="postgresql://username:password@ep-cool-name-123456.us-east-2.aws.neon.tech/ourchat?sslmode=require"
```

#### Step 5: Generate New Migration

```bash
# Navigate to backend directory
cd apps/backend

# Generate migration
npx prisma migrate dev --name switch_to_postgresql

# This will:
# 1. Compare schema.prisma to current DB
# 2. Generate SQL migration file
# 3. Apply migration to new PostgreSQL database
```

#### Step 6: Test Database Connection

```bash
# Test Prisma connection
npx prisma db push

# Open Prisma Studio to verify
npx prisma studio
```

#### Step 7: Update Backend Code (if needed)

Most code should work unchanged. Check for:

```typescript
// MySQL-specific queries (rare with Prisma)
// Example: Raw SQL queries
const result = await prisma.$queryRaw`
  SELECT * FROM users WHERE id = ${userId}
`;

// PostgreSQL might have different syntax for:
// - Full-text search
// - JSON operations
// - Date functions
```

#### Step 8: Migrate Data (if existing production data)

If you have production MySQL data to migrate:

```bash
# Export from MySQL
mysqldump -u user -p ourchat_dev > backup.sql

# Convert to PostgreSQL format (use tool like pgloader)
pgloader mysql://user:pass@localhost/ourchat_dev postgresql://user:pass@neon.tech/ourchat

# Or manually:
# 1. Export as CSV
# 2. Import to PostgreSQL using Prisma seed script
```

#### Estimated Time

- Schema update: 15 minutes
- New database setup: 15 minutes
- Migration generation: 10 minutes
- Testing: 30 minutes
- **Total: ~1-2 hours**

---

### Configuring Next.js Static Export

#### Step 1: Update next.config.js

```javascript
/** @type {import('next').NextConfig} */

const nextConfig = {
  // ADD THIS LINE
  output: 'export',

  reactStrictMode: true,

  // Remove or comment out 'headers' function
  // Static export doesn't support custom headers
  // (Headers will be configured on Cloudflare Pages instead)

  // Keep image config, but note: Image Optimization won't work
  images: {
    unoptimized: true, // ADD THIS for static export
    domains: [],
    remotePatterns: [],
  },
};

module.exports = nextConfig;
```

#### Step 2: Update Image Components (if using next/image)

```tsx
// If using next/image, switch to regular img or unoptimized images

// BEFORE
import Image from 'next/image';
<Image src="/logo.png" width={200} height={100} alt="Logo" />

// AFTER (Option 1: Regular img)
<img src="/logo.png" alt="Logo" style={{ width: 200, height: 100 }} />

// AFTER (Option 2: Keep next/image with unoptimized)
// Already handled by images.unoptimized: true in config
```

#### Step 3: Test Build

```bash
# Build static export
npm run build

# Output will be in 'out' folder
# Verify it was created
ls -la out/

# Test locally (optional)
npx serve out
# Visit http://localhost:3000
```

#### Step 4: Update .gitignore (optional)

```bash
# .gitignore
out/
```

#### Step 5: Deploy to Cloudflare Pages

**Option A: Wrangler CLI**

```bash
# Install Wrangler
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Deploy
wrangler pages deploy out --project-name ourchat
```

**Option B: Cloudflare Dashboard (Drag & Drop)**

1. Go to https://dash.cloudflare.com
2. Select "Pages" → "Create a project"
3. Upload `out/` folder
4. Configure custom domain (optional)

**Option C: GitHub Integration (Recommended)**

1. Push code to GitHub
2. In Cloudflare Pages dashboard:
   - "Create a project" → "Connect to Git"
   - Select repository
   - Build settings:
     - Build command: `npm run build`
     - Build output directory: `out`
     - Environment variables: (add any NEXT_PUBLIC_* vars)
3. Cloudflare will auto-deploy on every push

#### Step 6: Configure CORS for GraphQL Backend

Your frontend will now be on Cloudflare Pages (e.g., `ourchat.pages.dev`), but backend is on Render (e.g., `ourchat-api.onrender.com`).

Update backend CORS:

```typescript
// apps/backend/src/main.ts

app.enableCors({
  origin: [
    'http://localhost:3002',           // Local dev
    'https://ourchat.pages.dev',       // Cloudflare Pages
    'https://ourchat.com',              // Custom domain (if using)
  ],
  credentials: true,
});
```

Update environment variable:

```bash
# apps/backend/.env
CORS_ALLOWED_ORIGINS=http://localhost:3002,https://ourchat.pages.dev,https://ourchat.com
```

#### Step 7: Update Frontend GraphQL Endpoint

```typescript
// src/lib/graphql/client.ts

const GRAPHQL_HTTP_URL =
  process.env.NEXT_PUBLIC_GRAPHQL_HTTP_URL ||
  'https://ourchat-api.onrender.com/graphql';  // Production backend URL

const GRAPHQL_WS_URL =
  process.env.NEXT_PUBLIC_GRAPHQL_WS_URL ||
  'wss://ourchat-api.onrender.com/graphql';   // WebSocket URL
```

#### Step 8: Test Production Deployment

1. Visit deployed URL (e.g., https://ourchat.pages.dev)
2. Test login flow
3. Test GraphQL queries
4. Test WebSocket subscriptions (chat messages)
5. Check browser console for CORS errors

#### Rollback Plan

If you need to revert:

```javascript
// next.config.js
// Comment out or remove:
// output: 'export',
// images.unoptimized: true,
```

Re-deploy to Vercel:
```bash
vercel --prod
```

#### Estimated Time

- Config changes: 15 minutes
- Build & test: 15 minutes
- Cloudflare setup: 20 minutes
- CORS configuration: 10 minutes
- Testing: 30 minutes
- **Total: ~1.5 hours**

---

## Appendix: Provider-Specific Details

### Neon PostgreSQL

**Free Tier Limits (2025):**
- 0.5GB storage (shared across all branches)
- 191.9 compute hours/month (~256 MB/h equivalent)
- 10 branches per project
- 1 project (unlimited databases within project)
- Auto-suspend after 5 minutes of inactivity
- No credit card required

**Paid Tiers:**
- Launch: $19/month (3GB storage, always-on option)
- Scale: $69/month (8GB storage, better performance)

**Unique Features:**
- Database branching (like Git)
- Instant provisioning
- Scale-to-zero (save costs)
- Time travel (point-in-time restore)

**Dashboard:** https://console.neon.tech

---

### Cloudflare Pages

**Free Tier Limits (2025):**
- Unlimited requests
- Unlimited bandwidth
- 500 builds/month
- 100 custom domains
- Built-in SSL/TLS
- Global CDN (200+ cities)

**Build Settings for Next.js:**
- Build command: `npm run build`
- Build output directory: `out`
- Node version: 20.x

**Custom Domains:**
- Add via Cloudflare dashboard
- Automatic SSL certificates
- DNS managed by Cloudflare

**Dashboard:** https://dash.cloudflare.com → Pages

---

### Render

**Free Tier Limits (2025):**
- 750 hours/month per service
- 512MB RAM
- 0.1 CPU (shared)
- Auto-suspend after 15 minutes of inactivity
- 30-60 second cold start

**Paid Tiers:**
- Starter: $7/month (persistent, no sleep)
- Standard: $25/month (2GB RAM, 2 CPU)
- Pro: $85/month (4GB RAM, 2 CPU)

**Deployment:**
- Dockerfile support (recommended for NestJS)
- Auto-deploy from Git
- Environment variables via dashboard
- Health checks supported

**Dashboard:** https://dashboard.render.com

---

### Cloudflare R2

**Free Tier Limits (2025):**
- 10GB storage
- 1 million writes/month
- 10 million reads/month
- **Zero egress fees** (unlike S3)

**Pricing After Free Tier:**
- Storage: $0.015/GB/month
- Class A operations (writes): $4.50/million
- Class B operations (reads): $0.36/million
- No egress fees

**S3 Compatibility:**
- Compatible with AWS S3 API
- Use existing S3 SDKs
- Drop-in replacement for most use cases

**Setup:**
```bash
# Install Wrangler
npm install -g wrangler

# Create R2 bucket
wrangler r2 bucket create ourchat-photos

# Generate access keys
wrangler r2 access-keys create ourchat-api
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-10-25 | Winston | Initial document based on research and codebase analysis |

---

## Related Documents

- [Solution Architecture](../solution-architecture.md) - Overall system architecture (NOTE: Contains outdated PlanetScale cost assumptions)
- [Local Dev Architecture](./local-dev-architecture.md) - Local development setup
- [PRD](../PRD.md) - Product requirements
- [Tech Spec Epic 1](../tech-spec-epic-1.md) - User onboarding implementation details

---

## Questions or Feedback

For questions about this deployment guide, contact the development team or Winston (Architecture Agent).

**Last Updated:** 2025-10-25
