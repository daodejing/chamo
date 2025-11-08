# Sprint Change Proposal: Email Verification & Email-Bound Invites

**Date:** 2025-11-08
**Proposal ID:** SCP-2025-11-08-001
**Scope:** MODERATE
**Status:** APPROVED
**Author:** Winston (Architect)
**Approver:** Nick (Product Owner)

---

## Executive Summary

**Issue:** The authentication system lacks email verification and email-bound invite mechanisms, creating security vulnerabilities that allow account impersonation and invite hijacking.

**Solution:** Add three new stories to Epic 1 implementing industry-standard email verification and server-side email-encrypted invite codes.

**Impact:** +1.5-2 weeks timeline, $0 cost (free tier service), enhanced security posture.

**Recommendation:** APPROVED - Implement immediately as foundational authentication security.

---

## 1. Issue Summary

### Problem Statement

The current OurChat authentication system has two critical security gaps:

**Vulnerability 1: Unverified Email Accounts**
- Users can create accounts with any email address without proving ownership
- Enables account impersonation (registering with victim's email)
- Allows invalid/unreachable emails in database
- Violates industry-standard authentication practices

**Vulnerability 2: Unrestricted Invite Acceptance**
- Family invite codes can be accepted by anyone with the code
- Not bound to specific recipient email address
- Enables invite interception and unauthorized family access
- No accountability for who joins families

### Discovery Context

- **Discovered:** 2025-11-08 during general security review
- **Triggering Event:** Proactive security audit (not specific story)
- **Production Impact:** NONE (pre-launch, no users affected)
- **Classification:** Security gap in completed Epic 1

### Evidence from Codebase

**User Schema (apps/backend/prisma/schema.prisma:23-54):**
- ❌ No `emailVerified` field
- ❌ No `emailVerificationToken` tracking
- ❌ No verification timestamp

**Family Schema (apps/backend/prisma/schema.prisma:56-75):**
- ⚠️ `inviteCode` is generic string, not email-bound
- ❌ No `invitedEmail` field to restrict acceptance

**Auth Service - register() (apps/backend/src/auth/auth.service.ts:162-244):**
- ❌ Immediately creates account without verification
- ❌ Grants full JWT access without email confirmation
- Lines 169-175: Only checks duplicate email, doesn't verify ownership

**Auth Service - joinFamily() (apps/backend/src/auth/auth.service.ts:246-316):**
- ❌ Accepts ANY email for invite acceptance
- ❌ No binding between invite code and invitee email
- Lines 260-267: Validates code exists, not who can use it

**Email Infrastructure:**
- ❌ No email sending service configured
- ❌ No verification email templates
- ❌ No token generation/validation logic

### Security Impact Assessment

| Risk | Severity | Description |
|------|----------|-------------|
| Account Impersonation | HIGH | Attacker registers with victim's email, creates fake account |
| Invite Hijacking | HIGH | Intercepted invite codes grant unauthorized family access |
| Data Integrity | MEDIUM | Invalid emails prevent user communication |
| Compliance | MEDIUM | Email verification often required for GDPR/data protection |

---

## 2. Impact Analysis

### Epic Impact

**Affected Epic:** Epic 1 - User Onboarding & Authentication

**Current Status:** DONE (Stories 1.1, 1.2, 1.3 complete)
**New Status:** IN PROGRESS (reopened for Stories 1.4, 1.5, 1.6)
**Rationale:** Completed stories implemented happy path but omitted critical security validation

**New Stories Required:**

1. **Story 1.4: Email Verification for Account Creation**
   - Implement email verification flow with time-limited tokens
   - Prevent unverified users from accessing application features
   - Brevo integration for sending verification emails
   - Create verification pending and confirmation UI screens

2. **Story 1.5: Email-Bound Invite System**
   - Admin specifies invitee email when creating invite
   - Server-side email encryption in invite codes
   - Validate email match on invite acceptance
   - Single-use enforcement with database tracking

3. **Story 1.6: Brevo Email Service Integration**
   - Integrate Brevo transactional email service (9,000 emails/month free)
   - Create email templates (verification, welcome)
   - Implement NestJS email service layer
   - Add delivery monitoring and error handling

**Epic Priority Elevation:**
- **Previous:** Epic 1 complete, Epic 2 in progress
- **New:** Epic 1 CRITICAL (must complete before continuing Epic 2)
- **Justification:** Foundational security cannot be deferred

### Future Epic Dependencies

**Epic 6: Family Management**
- Story 6.1 "Invite Members" will use new email-bound invite system
- Requires Epic 1 Stories 1.4, 1.5 complete first

**Epic 8: DevOps & Infrastructure**
- Add email service monitoring and delivery tracking
- Email template management system
- Brevo webhook integration for delivery status

**Epics 2, 3, 4, 5, 7:** No impact (don't touch authentication/invites)

### Artifact Changes Required

**1. PRD (docs/PRD.md) - Functional Requirements**

```markdown
ADDITIONS:

FR-1.7: Email Verification
- Users must verify email ownership via confirmation link
- Verification tokens expire after 24 hours
- Accounts remain in unverified state until email confirmed
- Rate limiting: Maximum 5 verification resends per 15 minutes

FR-1.8: Email-Bound Invite System
- Invite codes are 22-character cryptographic random tokens (128-bit entropy)
- Admin specifies target email address when creating invite
- Invite codes bound to invitee email via server-side encrypted storage
- Single-use enforcement: Code becomes invalid after redemption
- Invite codes expire after 14 days
- Acceptance validates submitted email matches invite target (server-side)

UPDATES:

FR-1.1: Users must authenticate via email + invite code
  → Enhanced: "Users must verify email ownership before account activation"

FR-1.2: Family admin generates invite codes for new members
  → Enhanced: "Admin must specify invitee email address when generating code"
```

**2. Solution Architecture (docs/solution-architecture.md)**

**Database Schema Additions:**

```sql
-- User table updates
ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN email_verified_at TIMESTAMP;

-- New table: Email verification tokens
CREATE TABLE email_verification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL UNIQUE, -- SHA-256 hash
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  used_at TIMESTAMP,

  INDEX idx_token_hash (token_hash),
  INDEX idx_user_id (user_id)
);

-- New table: Family invites
CREATE TABLE family_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(22) NOT NULL UNIQUE, -- Random 128-bit token
  code_hash VARCHAR(64) NOT NULL UNIQUE, -- SHA-256 hash for lookup
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  invitee_email_encrypted TEXT NOT NULL, -- AES-256-GCM encrypted
  inviter_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL, -- created_at + 14 days
  redeemed_at TIMESTAMP,
  redeemed_by_user_id UUID REFERENCES users(id),

  INDEX idx_code_hash (code_hash),
  INDEX idx_family_id (family_id),
  INDEX idx_invitee_email (invitee_email_encrypted)
);
```

**GraphQL Schema Updates:**

```graphql
type Mutation {
  # Auth - Updated
  register(email: String!, familyName: String!, password: String!, name: String!): EmailVerificationResponse!
  verifyEmail(token: String!): AuthResponse!
  resendVerificationEmail(email: String!): GenericResponse!

  # Family - Updated
  createInvite(inviteeEmail: String!): InviteResponse!
  joinFamily(email: String!, inviteCode: String!, password: String!, name: String!): EmailVerificationResponse!

  # Existing (unchanged)
  login(email: String!, password: String!): AuthResponse!
}

type EmailVerificationResponse {
  message: String!
  requiresEmailVerification: Boolean!
}

type InviteResponse {
  inviteCode: String!
  inviteeEmail: String!
  expiresAt: DateTime!
}

type GenericResponse {
  success: Boolean!
  message: String!
}
```

**External Services Addition:**

| Service | Purpose | Free Tier | Rationale |
|---------|---------|-----------|-----------|
| **Brevo** | Transactional email | 9,000 emails/month | Best recurring free tier, excellent NestJS integration |

**Environment Variables:**

```bash
# Backend (.env)
INVITE_SECRET=<32-byte hex>  # For encrypting invitee emails
EMAIL_SERVICE=brevo
BREVO_API_KEY=xkeysib-xxx
EMAIL_FROM=noreply@ourchat.app
EMAIL_FROM_NAME=OurChat
EMAIL_VERIFICATION_URL=http://localhost:3000/verify-email
```

**3. UI/UX Implementation**

**New Screens Required:**
- `/verify-email` - Token validation from email link
- `/verification-pending` - Post-registration "check your email" screen
- Verification status banner (for unverified users)

**Component Updates:**
- `unified-login-screen.tsx` - Remove immediate login, show verification pending
- New: `invite-creation-form.tsx` - Admin specifies invitee email
- New: Email templates (verification email, welcome email)

**4. Tech Spec Epic 1 (docs/tech-spec-epic-1.md)**
- Add Stories 1.4, 1.5, 1.6 specifications
- Document Brevo integration patterns
- Update API contracts section

**5. Testing & Infrastructure**
- Unit tests: Email service, token generation, encryption
- Integration tests: Full verification flow, invite acceptance
- E2E tests: Registration → Email → Verification → Login
- CI/CD: Add Brevo API key to secrets, staging email testing
- Monitoring: Email delivery webhooks, failed verification tracking

---

## 3. Recommended Approach

### Selected Path: Option 1 - Direct Adjustment

**Add three new stories to Epic 1 and implement immediately.**

**Implementation Timeline:**

| Phase | Story | Duration | Dependencies |
|-------|-------|----------|--------------|
| Phase 1 | Story 1.6: Brevo Integration | 1-2 days | None |
| Phase 2 | Story 1.4: Email Verification | 3-4 days | Story 1.6 complete |
| Phase 3 | Story 1.5: Email-Bound Invites | 2-3 days | Story 1.6 complete |
| **Total** | **All Stories** | **6-9 days** | **(~1.5-2 weeks)** |

**Effort Estimate:** MEDIUM
**Risk Level:** LOW
**Cost:** $0 (Brevo free tier: 9,000 emails/month)

### Rationale

✅ **Security Priority:** Email verification is foundational authentication security, not optional

✅ **Timing Advantage:** No production users = clean implementation window before complexity grows

✅ **Research-Backed:** Approach validated against OWASP guidelines and industry best practices (see Appendix A)

✅ **Infrastructure Reuse:** Email service needed for future features (password reset, notifications, Epic 6)

✅ **Low Risk:** Standard patterns, free-tier service, well-defined requirements

✅ **Brand Alignment:** Maintains "privacy-first" positioning with professional security

### Alternatives Considered (Rejected)

**Option 2: Rollback Completed Stories**
- ❌ NOT VIABLE - Stories 1.1, 1.2, 1.3 are correct and foundational
- ❌ Email verification is additive, not corrective
- ❌ Rollback would destroy working authentication

**Option 3: Reduce MVP Scope**
- ❌ NOT VIABLE - Email verification IS part of MVP (authentication security)
- ❌ Launching without email verification creates unacceptable security risk
- ❌ MVP goals unchanged (enhanced, not reduced)

**Option 4: Defer to Epic 6**
- ❌ NOT RECOMMENDED - Risky to launch without email verification
- ❌ Harder to retrofit after user data exists
- ❌ Creates technical debt

---

## 4. MVP Impact

### MVP Goals - UNCHANGED

✅ **"Family of 4-10 can communicate privately with E2EE"**
- Still achievable with email verification
- Actually strengthens security posture

✅ **"Works on web and mobile browsers"**
- Unaffected by email verification

✅ **"Runs on free tier hosting"**
- Brevo: 9,000 emails/month free
- Adequate for MVP (estimated 1,000-2,000 emails/month)

### Timeline Impact

**Original Timeline:**
- Epic 1: DONE
- Epic 2: IN PROGRESS (messaging features)

**Revised Timeline:**
- Epic 1: Reopen for Stories 1.4, 1.5, 1.6 (+1.5-2 weeks)
- Epic 2: Resume after Epic 1 complete

**Launch Delay:** +1.5-2 weeks (acceptable - no production users waiting)

### Scope Enhancement (Not Expansion)

Email verification **enhances** existing MVP scope:
- Professional authentication UX (expected by users)
- Prevents security vulnerabilities
- Establishes email infrastructure for future features
- Aligns with "privacy-first" brand promise

---

## 5. Implementation Action Plan

### Immediate Actions (This Week)

**Scrum Master:**
- [ ] Update sprint-status.yaml: Epic 1 (done → in-progress)
- [ ] Create story files: docs/stories/story-1.4.md, story-1.5.md, story-1.6.md
- [ ] Schedule sprint planning session for Epic 1 completion
- [ ] Update backlog with new story priorities

**Product Owner:**
- [ ] Review and approve story definitions (1.4, 1.5, 1.6)
- [ ] Validate acceptance criteria
- [ ] Confirm Epic 1 priority elevation

**Infrastructure:**
- [ ] Sign up for Brevo account (free tier)
- [ ] Generate Brevo API key
- [ ] Add BREVO_API_KEY to .env (local, staging, production)
- [ ] Generate INVITE_SECRET (32-byte hex)

### Development Sequence (Weeks 1-2)

**Story 1.6: Brevo Email Service Integration (Days 1-2)**
- [ ] Install `@getbrevo/brevo` package
- [ ] Create NestJS EmailService wrapper
- [ ] Build email templates (verification, welcome)
- [ ] Test email sending in local development
- [ ] Add monitoring/error handling

**Story 1.4: Email Verification (Days 3-6)**
- [ ] Database migrations (EmailVerificationToken table, User fields)
- [ ] Backend: Token generation, validation endpoints (GraphQL mutations)
- [ ] Frontend: Verification pending screen, verify-email page
- [ ] Email templates: Verification email HTML/text
- [ ] Rate limiting: 5 resends per 15 minutes
- [ ] Tests: Unit, integration, E2E

**Story 1.5: Email-Bound Invites (Days 7-9)**
- [ ] Database migration (FamilyInvite table)
- [ ] Backend: Invite creation with email encryption (AES-256-GCM)
- [ ] Backend: Invite acceptance validation (decrypt, compare email)
- [ ] Frontend: Invite creation UI (admin specifies email)
- [ ] Frontend: Update invite acceptance flow
- [ ] Tests: Unit, integration, E2E

### Validation & Completion (Week 2-3)

**Quality Assurance:**
- [ ] Run full test suite (all Epic 1 stories)
- [ ] Manual QA: Registration → Email → Verification → Login
- [ ] Manual QA: Admin creates invite → Member accepts (email match)
- [ ] Manual QA: Negative cases (wrong email, expired token, used invite)

**Documentation:**
- [ ] Update PRD: Add FR-1.7, FR-1.8
- [ ] Update solution-architecture.md: Database schema, GraphQL, Brevo
- [ ] Update tech-spec-epic-1.md: Add Stories 1.4, 1.5, 1.6
- [ ] Update deployment guide: Brevo setup instructions

**Story Completion:**
- [ ] Mark Stories 1.4, 1.5, 1.6 as DONE
- [ ] Update sprint-status.yaml: Epic 1 (in-progress → done)
- [ ] Confirm all 6 Epic 1 stories complete (1.1, 1.2, 1.3, 1.4, 1.5, 1.6)

### Handoff & Resume (Week 3+)

- [ ] Resume Epic 2 development (messaging features)
- [ ] Document email verification for team onboarding
- [ ] Archive sprint change proposal

---

## 6. Agent Handoff Plan

### Change Scope Classification: MODERATE

**Not Minor:** Requires 3 new stories, database changes, external service integration
**Not Major:** Doesn't require fundamental replan or architecture pivot
**MODERATE:** Focused implementation scope, backlog reorganization needed

### Handoff Recipients

| Role | Agent | Responsibilities | Deliverables |
|------|-------|------------------|--------------|
| **Development** | Developer | Implement Stories 1.4, 1.5, 1.6 | Working email verification, email-bound invites, Brevo integration, tests |
| **Coordination** | Scrum Master | Sprint planning, story creation, backlog management | Story files, updated sprint-status.yaml, sprint plan |
| **Approval** | Product Owner | Story approval, acceptance criteria validation | Approved stories, priority confirmation |
| **Technical Review** | Architect (Winston) | Database schema, security implementation review | Migration approval, encryption validation |

### Success Criteria

**All criteria must be met before Epic 1 marked DONE:**

✅ **Functional:**
- Email verification working end-to-end (registration → email → verify → login)
- Email-bound invites validated (admin creates for specific email, only that email accepts)
- Brevo delivering emails reliably (<2 min delivery time)
- Rate limiting enforced (5 verification resends per 15 min)
- Token expiration enforced (24h verification, 14d invites)

✅ **Technical:**
- All database migrations executed successfully
- GraphQL schema updated with new mutations
- Email encryption using AES-256-GCM with INVITE_SECRET
- Token generation using cryptographic randomness (128-bit)
- Single-use enforcement (redeemed invites/tokens invalidated)

✅ **Quality:**
- All tests passing (unit, integration, E2E)
- Code coverage >90% for email service and auth flows
- No security vulnerabilities (OWASP compliance validated)

✅ **Documentation:**
- PRD updated (FR-1.7, FR-1.8)
- Architecture document updated (database, GraphQL, Brevo)
- Tech spec updated (Stories 1.4, 1.5, 1.6)
- Deployment guide includes Brevo setup

✅ **Status:**
- Stories 1.4, 1.5, 1.6 all marked DONE in sprint-status.yaml
- Epic 1 status: DONE (all 6 stories complete)

---

## 7. Risk Assessment

### Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Email deliverability issues | LOW | MEDIUM | Brevo has excellent deliverability; use verified sender domain |
| Token generation not cryptographically secure | LOW | HIGH | Use Node.js crypto.randomBytes(); validate in code review |
| Invite email encryption compromised | LOW | HIGH | Use AES-256-GCM with rotatable INVITE_SECRET; store in secrets manager |
| Race condition in single-use enforcement | LOW | MEDIUM | Use database constraints and transactions |
| Brevo free tier exceeded | VERY LOW | LOW | 9,000/month adequate for MVP; monitoring alerts at 80% |

### Schedule Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Stories take longer than estimated | MEDIUM | LOW | 6-9 day range includes buffer; no hard launch deadline |
| Developer unavailable | LOW | MEDIUM | Stories can be implemented by any backend developer |
| Brevo API changes | VERY LOW | MEDIUM | Use official SDK; monitor Brevo status page |

### User Impact Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Users don't receive verification emails | LOW | HIGH | Clear UI messaging; resend button; support contact |
| Verification emails go to spam | MEDIUM | MEDIUM | Use verified sender domain; SPF/DKIM/DMARC setup |
| Users lose verification emails | LOW | LOW | Resend functionality (rate-limited) |

**Overall Risk Level:** LOW (pre-production, well-researched approach, free-tier service)

---

## 8. Cost Analysis

### Development Costs

**Developer Time:** 6-9 days @ $0 (internal team)

**External Services:**

| Service | Tier | Cost | Justification |
|---------|------|------|---------------|
| **Brevo** | Free | $0/month | 9,000 emails/month adequate for MVP |

**Estimated Email Volume (MVP):**
- 1,000 signups/month × 1 verification email = 1,000
- 10% password resets × 1 email = 100
- 500 invite acceptances × 1 email = 500
- Welcome emails, notifications: 400
- **Total: ~2,000 emails/month**

**Brevo Free Tier:** 9,000 emails/month (4.5x capacity)

**Growth Plan:**
- 0-9,000 emails/month: FREE
- 9,000-20,000 emails/month: Brevo Starter ($15/month)
- 20,000+ emails/month: Brevo Business ($25/month)

**Infrastructure Costs:** $0 (no additional hosting/storage needed)

**Total Incremental Cost:** $0 for MVP phase

---

## 9. Next Steps

### Immediate (This Week)

1. **Scrum Master:** Create story files (1.4, 1.5, 1.6)
2. **Infrastructure:** Set up Brevo account, generate API keys
3. **Product Owner:** Review and approve story definitions
4. **Team:** Sprint planning for Epic 1 completion

### Short-Term (Weeks 1-2)

1. **Developer:** Implement Story 1.6 (Brevo integration)
2. **Developer:** Implement Stories 1.4 and 1.5 (can parallelize)
3. **Architect:** Review database migrations and encryption implementation
4. **QA:** Test email verification and invite flows

### Medium-Term (Week 3+)

1. **Team:** Mark Epic 1 complete (all 6 stories DONE)
2. **Team:** Resume Epic 2 development (messaging features)
3. **Documentation:** Archive this proposal, update team onboarding

---

## 10. Approval & Sign-Off

**Proposal Approved:** ✅ YES

**Approver:** Nick (Product Owner)
**Date:** 2025-11-08
**Decision:** Proceed with implementation

**Reviewed By:**
- Winston (Architect) - Technical design validated
- Scrum Master - Sprint planning confirmed

**Next Action:** Create story files and begin Story 1.6 (Brevo integration)

---

## Appendix A: Research Summary

### Email Verification Best Practices (OWASP)

**Standard Industry Approach:**
1. Create account immediately in **unverified state**
2. Send verification email with time-limited token (24 hours)
3. Restrict features until email verified
4. Rate limit resend requests (5 per 15 minutes)

**Source:** OWASP Authentication Cheat Sheet, Password Reset Cheat Sheet

### Invite Code Security Best Practices

**Recommended Pattern (Research-Backed):**
1. Generate cryptographically random token (128+ bits, 22 chars)
2. Store server-side with encrypted invitee email
3. Validate email match on redemption
4. Single-use enforcement via database tracking
5. Time-limited expiration (7-30 days)

**Source:** OWASP guidelines, Stack Exchange Security consensus, industry SaaS patterns

### Email Service Provider Selection

**Brevo Selected Based On:**
- Best recurring free tier (9,000 emails/month)
- Excellent deliverability reputation
- Strong NestJS integration support
- Professional email template builder
- Comprehensive delivery tracking

**Alternatives Considered:**
- Resend: 3,000/month (less generous)
- SendGrid: No free tier (eliminated)
- AWS SES: Complex setup (deferred)
- Postmark: 100/month (too limited)

**Source:** 2025 email service provider comparison research

---

**Document Control:**
- **Created:** 2025-11-08
- **Author:** Winston (Architect)
- **Version:** 1.0
- **Status:** APPROVED
- **Location:** docs/sprint-change-proposal-2025-11-08.md
