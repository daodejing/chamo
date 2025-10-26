# Story 8.1: Set up CI/CD Pipeline and Staging Deployment

Status: Draft

## Story

As a developer,
I want an automated CI/CD pipeline with GitHub Actions,
so that code changes are tested and deployed to staging automatically.

## Acceptance Criteria

1. **AC1:** GitHub Actions runs all tests (unit, integration, E2E) on every pull request
2. **AC2:** Pull requests are blocked from merging if any tests fail
3. **AC3:** Successful merges to main branch trigger automatic deployment to staging environment
4. **AC4:** Database migrations are automatically applied to staging database during deployment
5. **AC5:** Staging deployment health check verifies frontend and backend are accessible
6. **AC6:** Basic uptime monitoring alerts team if staging goes down
7. **AC7:** Deployment logs are accessible and retained for 30 days

## Tasks / Subtasks

- [ ] Task 1: Create GitHub Actions CI workflow (AC: #1, #2)
  - [ ] Subtask 1.1: Create `.github/workflows/ci.yml`
  - [ ] Subtask 1.2: Configure matrix testing for Node.js versions (20.x)
  - [ ] Subtask 1.3: Add frontend unit tests job (Vitest)
  - [ ] Subtask 1.4: Add backend unit tests job (Jest/Vitest)
  - [ ] Subtask 1.5: Add integration tests job
  - [ ] Subtask 1.6: Add E2E tests job (Playwright)
  - [ ] Subtask 1.7: Configure test result reporting and artifacts
  - [ ] Subtask 1.8: Set up required status checks for PR merges

- [ ] Task 2: Create staging deployment workflow (AC: #3, #4, #5)
  - [ ] Subtask 2.1: Create `.github/workflows/deploy-staging.yml`
  - [ ] Subtask 2.2: Configure Cloudflare Pages deployment for frontend
  - [ ] Subtask 2.3: Configure Render deployment for backend
  - [ ] Subtask 2.4: Add Prisma migration step to backend deployment
  - [ ] Subtask 2.5: Configure environment variables as GitHub secrets
  - [ ] Subtask 2.6: Add post-deployment health check job
  - [ ] Subtask 2.7: Add deployment status notifications (success/failure)

- [ ] Task 3: Configure staging environment infrastructure (AC: #3, #4)
  - [ ] Subtask 3.1: Create Neon PostgreSQL staging database
  - [ ] Subtask 3.2: Set up Render staging service for NestJS backend
  - [ ] Subtask 3.3: Set up Cloudflare Pages staging project
  - [ ] Subtask 3.4: Configure Cloudflare R2 bucket for staging photos
  - [ ] Subtask 3.5: Set up CORS configuration for staging domains
  - [ ] Subtask 3.6: Document staging URLs and access credentials

- [ ] Task 4: Create environment variable management (AC: #3)
  - [ ] Subtask 4.1: Create `.env.staging.template` with all required variables
  - [ ] Subtask 4.2: Document environment variables in README
  - [ ] Subtask 4.3: Add GitHub secrets for sensitive values
  - [ ] Subtask 4.4: Create script to validate environment variables
  - [ ] Subtask 4.5: Add fail-fast validation for missing env vars

- [ ] Task 5: Implement health check endpoints and monitoring (AC: #5, #6)
  - [ ] Subtask 5.1: Create `/health` endpoint in NestJS backend
  - [ ] Subtask 5.2: Add database connectivity check to health endpoint
  - [ ] Subtask 5.3: Create `.github/workflows/health-check.yml` for scheduled monitoring
  - [ ] Subtask 5.4: Configure health check to run every 15 minutes
  - [ ] Subtask 5.5: Add GitHub Issues alert on health check failure
  - [ ] Subtask 5.6: Create simple frontend health check page

- [ ] Task 6: Set up deployment logging and observability (AC: #7)
  - [ ] Subtask 6.1: Configure Render logging with 30-day retention
  - [ ] Subtask 6.2: Set up Cloudflare Pages deployment logs
  - [ ] Subtask 6.3: Add structured logging to GitHub Actions workflows
  - [ ] Subtask 6.4: Create deployment history tracking
  - [ ] Subtask 6.5: Add rollback documentation and procedures

- [ ] Task 7: Configure Next.js for static export (if needed) (AC: #3)
  - [ ] Subtask 7.1: Update `next.config.js` with `output: 'export'`
  - [ ] Subtask 7.2: Add `images: { unoptimized: true }` configuration
  - [ ] Subtask 7.3: Test static build locally (`npm run build`)
  - [ ] Subtask 7.4: Verify all routes work without server dependencies
  - [ ] Subtask 7.5: Update GraphQL endpoint URLs for staging

- [ ] Task 8: Write deployment documentation (AC: All)
  - [ ] Subtask 8.1: Create `docs/deployment-guide.md`
  - [ ] Subtask 8.2: Document manual deployment procedures
  - [ ] Subtask 8.3: Document rollback procedures
  - [ ] Subtask 8.4: Document environment setup for new developers
  - [ ] Subtask 8.5: Create troubleshooting guide for common deployment issues

- [ ] Task 9: Test complete CI/CD pipeline end-to-end (AC: All)
  - [ ] Subtask 9.1: Create test PR with passing tests
  - [ ] Subtask 9.2: Verify all CI checks pass
  - [ ] Subtask 9.3: Merge to main and verify staging deployment
  - [ ] Subtask 9.4: Verify database migration applied
  - [ ] Subtask 9.5: Verify health checks pass
  - [ ] Subtask 9.6: Test health check monitoring and alerting

## Dev Notes

### Architecture Patterns and Constraints

**Deployment Stack (Option 2 - Free Forever):**
- Frontend: Cloudflare Pages (static export, $0/month)
- Backend: Render Free Tier ($0 with cold starts, $7 Starter for always-on)
- Database: Neon PostgreSQL Free Tier (0.5GB, serverless)
- Storage: Cloudflare R2 (10GB free)
- **Total Cost**: $0/month for staging

**CI/CD Pipeline:**
- GitHub Actions for all automation
- Triggered on: PR creation, push to main
- Test matrix: Node 20.x
- Deployment: Automatic to staging on main branch merge
- No production deployment yet (manual only)

**Database Migration Strategy:**
- PostgreSQL already migrated ✅
- Prisma migrations managed via `prisma migrate deploy`
- Migration runs automatically during backend deployment
- Migrations are idempotent and safe to re-run
- Rollback requires manual intervention (documented procedure)

**Environment Management:**
- Staging environment variables stored as GitHub Secrets
- Never commit secrets to repository
- Use `.env.staging.template` for documentation
- Fail-fast validation on missing environment variables
- Separate secrets for frontend (NEXT_PUBLIC_*) and backend

**Health Check Architecture:**
- Backend: `/health` endpoint returns JSON with status, database connectivity
- Frontend: Simple HTML page that checks GraphQL connectivity
- Scheduled monitoring via GitHub Actions (every 15 minutes)
- Alerts via GitHub Issues on consecutive failures
- No paid monitoring service (UptimeRobot, etc.) for MVP

**Security Measures:**
- All GitHub secrets encrypted at rest
- No secrets in workflow logs (masked automatically)
- CORS configured for specific staging domains only
- Database credentials rotated per environment
- SSL/TLS enforced (Cloudflare + Render default)

**Testing in CI Pipeline:**
- Unit tests: Fast, run first (~2-3 min)
- Integration tests: Medium speed (~3-5 min)
- E2E tests: Slowest, run last (~5-10 min)
- Total CI runtime target: < 15 minutes
- Fail fast: Stop on first test failure
- Test artifacts uploaded for debugging

### Project Structure Notes

**Alignment with cloud deployment options document:**

Files to create:
- `.github/workflows/ci.yml` - Continuous integration testing
- `.github/workflows/deploy-staging.yml` - Staging deployment
- `.github/workflows/health-check.yml` - Uptime monitoring
- `.env.staging.template` - Environment variable template
- `docs/deployment-guide.md` - Deployment documentation

Files to modify:
- `next.config.js` - Add static export configuration
- `apps/backend/src/main.ts` - Add `/health` endpoint
- `README.md` - Add CI/CD badges and staging links

Dependencies on existing work:
- PostgreSQL migration already complete ✅
- NestJS + GraphQL backend already running
- Frontend already using Apollo Client
- E2E tests already written

Testing approach:
- No new unit/integration/E2E tests required
- Testing validates CI/CD pipeline itself
- Health check endpoints tested via curl in workflows

**Detected conflicts or variances:** None. Follows cloud deployment options document recommendations.

**Key Decisions:**
1. **Staging only**: No production deployment in this story (defer to Story 8.2)
2. **Free tier**: Accept cold starts on Render free tier for staging
3. **Minimal monitoring**: GitHub Actions health checks sufficient for staging
4. **Manual rollback**: Automated rollback deferred to future story

### References

- [Source: docs/architecture/cloud-deployment-options.md - Deployment Option 2]
- [Source: docs/architecture/cloud-deployment-options.md - Phased Deployment Strategy]
- [Source: docs/architecture/cloud-deployment-options.md - Migration Guides]
- [Source: docs/solution-architecture.md - System Architecture]
- [Source: GitHub Actions Documentation - https://docs.github.com/actions]
- [Source: Cloudflare Pages Docs - https://developers.cloudflare.com/pages]
- [Source: Render Docs - https://render.com/docs]
- [Source: Neon PostgreSQL Docs - https://neon.tech/docs]

## Implementation Notes

### GitHub Actions Workflow Structure

**CI Workflow (`.github/workflows/ci.yml`)**:
```yaml
name: CI
on: [pull_request, push]
jobs:
  frontend-unit-tests:
    runs-on: ubuntu-latest
    steps:
      - Checkout code
      - Setup Node.js 20.x
      - Install dependencies
      - Run Vitest

  backend-unit-tests:
    runs-on: ubuntu-latest
    steps:
      - Checkout code
      - Setup Node.js 20.x
      - Install dependencies
      - Run backend tests

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - Checkout code
      - Setup Node.js 20.x
      - Install Playwright browsers
      - Start services (docker-compose)
      - Run E2E tests
      - Upload test artifacts
```

**Staging Deployment Workflow**:
```yaml
name: Deploy Staging
on:
  push:
    branches: [main]
jobs:
  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - Build Next.js static export
      - Deploy to Cloudflare Pages

  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - Run Prisma migrations
      - Deploy to Render
      - Wait for deployment

  health-check:
    needs: [deploy-frontend, deploy-backend]
    steps:
      - Check frontend health
      - Check backend health
      - Check database connectivity
```

### Environment Variables Required

**Frontend (NEXT_PUBLIC_*)**:
- `NEXT_PUBLIC_GRAPHQL_HTTP_URL` - Backend GraphQL endpoint
- `NEXT_PUBLIC_GRAPHQL_WS_URL` - Backend WebSocket endpoint
- `NEXT_PUBLIC_GROQ_API_KEY` - Translation API key

**Backend**:
- `DATABASE_URL` - Neon PostgreSQL connection string
- `JWT_SECRET` - JWT signing secret
- `REFRESH_TOKEN_SECRET` - Refresh token secret
- `CORS_ALLOWED_ORIGINS` - Allowed frontend origins
- `NODE_ENV=staging`

**Deployment**:
- `CLOUDFLARE_API_TOKEN` - Cloudflare Pages deployment
- `RENDER_API_KEY` - Render deployment API
- `RENDER_SERVICE_ID` - Render service identifier

### Cost Breakdown (Staging Environment)

| Service | Tier | Monthly Cost | Notes |
|---------|------|--------------|-------|
| Cloudflare Pages | Free | $0 | Static hosting |
| Render | Free | $0 | Accepts cold starts |
| Neon PostgreSQL | Free | $0 | 0.5GB storage |
| Cloudflare R2 | Free | $0 | 10GB storage |
| GitHub Actions | Free | $0 | 2000 minutes/month |
| **Total** | | **$0/month** | Sufficient for staging |

**Upgrade Path (Production)**:
- Render Starter: $7/month (no cold starts)
- Neon Launch: $19/month (better performance)
- Total: ~$27/month for production-ready

## Dev Agent Record

### Context Reference

- TBD - Will be created after story completion

### Agent Model Used

claude-sonnet-4-5-20250929

### Debug Log References

N/A - Initial story creation

### Completion Notes List

- [ ] All GitHub Actions workflows created and tested
- [ ] Staging environment deployed and accessible
- [ ] Health checks passing consistently
- [ ] Documentation complete and validated
- [ ] CI/CD pipeline verified end-to-end

### File List

**New Files Created:**
- `.github/workflows/ci.yml`
- `.github/workflows/deploy-staging.yml`
- `.github/workflows/health-check.yml`
- `.env.staging.template`
- `docs/deployment-guide.md`

**Modified Files:**
- `next.config.js` (static export configuration)
- `apps/backend/src/main.ts` (health endpoint)
- `README.md` (CI badges, staging links)

**Configuration Files:**
- GitHub Secrets (environment variables)
- Cloudflare Pages settings
- Render service settings

### Change Log

**2025-10-26 (Initial Creation):**
- Story 8.1 created based on cloud deployment options document
- Deployment stack: Option 2 (Cloudflare + Render + Neon)
- Scope: CI/CD pipeline and staging environment only
- Status: Draft

## Follow-Up Tasks (Future Stories)

**Story 8.2: Production Deployment** (Deferred):
- Manual production deployment workflow
- Production environment setup (paid tiers)
- Production database backups
- Production monitoring (APM, error tracking)
- Blue-green deployment strategy

**Story 8.3: Advanced Monitoring** (Deferred):
- Sentry error tracking
- Performance monitoring (Core Web Vitals)
- User analytics
- Database query performance monitoring

**Story 8.4: Automated Rollback** (Deferred):
- Automatic rollback on health check failure
- Database migration rollback strategy
- Deployment versioning and tagging

---

## Senior Developer Review (AI)

**Status:** Pending - Story not yet implemented

---

**Last Updated:** 2025-10-26
