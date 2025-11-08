# Story 1.5: Email-Bound Invite System

Status: drafted

## Story

As a **family admin creating an invite**,
I want **to specify the invitee's email address when generating the invite code**,
so that **only the intended recipient can accept the invitation and join the family, preventing invite interception and unauthorized access**.

## Context

This story addresses a critical security gap in the family invite system. The current implementation (Stories 1.1, 1.2) allows anyone with an invite code to join a family, creating vulnerabilities for invite hijacking and unauthorized access.

**From Sprint Change Proposal (SCP-2025-11-08-001):**
- **Vulnerability**: Family invite codes can be accepted by anyone who has the code
- **Impact**: HIGH - Intercepted invite codes grant unauthorized family access
- **Security Enhancement**: Server-side email encryption binds invite to specific recipient

This story implements industry-standard invite security: admin specifies invitee email → server encrypts email in invite code → validation on redemption ensures email match.

[Source: docs/sprint-change-proposal-2025-11-08.md#Issue-Summary]

## Acceptance Criteria

**AC1: Database Schema for Email-Bound Invites**
- ✅ `family_invites` table created with columns:
  - `id` (UUID primary key)
  - `code` (VARCHAR(22) unique) - 22-character random token
  - `codeHash` (VARCHAR(64) unique, indexed) - SHA-256 hash for lookup
  - `familyId` (UUID foreign key → families.id, ON DELETE CASCADE)
  - `inviteeEmailEncrypted` (TEXT) - AES-256-GCM encrypted email
  - `inviterId` (UUID foreign key → users.id) - Admin who created invite
  - `createdAt` (TIMESTAMP default NOW())
  - `expiresAt` (TIMESTAMP) - createdAt + 14 days
  - `redeemedAt` (TIMESTAMP NULL)
  - `redeemedByUserId` (UUID foreign key → users.id NULL)
- ✅ Indexes on `codeHash`, `familyId`, `inviteeEmailEncrypted`
- ✅ Prisma migration generated and applied

**AC2: Server-Side Email Encryption**
- ✅ `INVITE_SECRET` environment variable configured (32-byte hex, 64 characters)
- ✅ Encryption utility created: `encryptEmail(email: string): string`
  - Uses AES-256-GCM with INVITE_SECRET as key
  - Returns encrypted email as base64 string
  - Includes authentication tag for integrity
- ✅ Decryption utility created: `decryptEmail(encrypted: string): string`
  - Decrypts AES-256-GCM encrypted email
  - Verifies authentication tag (prevents tampering)
  - Returns plain email address
- ✅ INVITE_SECRET validated at app startup (must be 64-character hex)

**AC3: Invite Creation with Email Binding**
- ✅ GraphQL mutation updated: `createInvite(inviteeEmail: String!): InviteResponse!`
- ✅ Admin specifies invitee email address (required parameter)
- ✅ Backend generates 22-character cryptographic random invite code (128-bit entropy)
- ✅ Backend encrypts invitee email using `encryptEmail()`
- ✅ Backend stores in `family_invites` table:
  - `code` = plain 22-char token (given to user)
  - `codeHash` = SHA-256(code) (for database lookup)
  - `inviteeEmailEncrypted` = encrypted email
  - `expiresAt` = NOW() + 14 days
- ✅ Returns `InviteResponse` with `inviteCode`, `inviteeEmail`, `expiresAt`
- ✅ Old invite codes for same email are NOT invalidated (allow multiple invites)

**AC4: Invite Acceptance with Email Validation**
- ✅ GraphQL mutation updated: `joinFamily(email: String!, inviteCode: String!, password: String!, name: String!): EmailVerificationResponse!`
- ✅ Backend looks up invite by `SHA-256(inviteCode)` in `codeHash` column
- ✅ Backend validates invite:
  - Invite exists
  - Not expired (`expiresAt > NOW()`)
  - Not already redeemed (`redeemedAt IS NULL`)
- ✅ Backend decrypts `inviteeEmailEncrypted` using `decryptEmail()`
- ✅ Backend compares decrypted email with provided `email` (case-insensitive)
- ✅ If email mismatch: Return error "This invite code was not sent to your email address"
- ✅ If valid: Create account, mark invite redeemed (`redeemedAt = NOW()`, `redeemedByUserId = user.id`)
- ✅ Send verification email (Story 1.4 integration)

**AC5: Single-Use Enforcement**
- ✅ Invite code can only be redeemed once
- ✅ After redemption, `redeemedAt` timestamp set (prevents reuse)
- ✅ Attempting to use redeemed invite returns error: "This invite code has already been used"
- ✅ Database constraint prevents race conditions (transaction isolation)

**AC6: Invite Expiration**
- ✅ Invite codes expire after 14 days from creation
- ✅ Expired invites return error: "This invite code has expired"
- ✅ Expired invites not deleted (kept for audit trail)
- ✅ Admin can create new invite for same email if previous expired

**AC7: Frontend - Invite Creation UI**
- ✅ Admin sees "Invite New Member" button in family settings
- ✅ Invite creation form includes:
  - Email address input (required, validated)
  - "Generate Invite Code" button
- ✅ After creation, displays invite code and invitee email
- ✅ Copy-to-clipboard button for invite code
- ✅ Expiration date displayed (14 days from now)
- ✅ Instructions: "Share this code with [email] to join your family"

**AC8: Frontend - Invite Acceptance Updates**
- ✅ Join family form validates email matches invite (backend validation)
- ✅ Email mismatch error displayed clearly
- ✅ Success flow creates account and sends verification email (Story 1.4 integration)
- ✅ Error messages user-friendly: expired, already used, wrong email

[Source: docs/sprint-change-proposal-2025-11-08.md#Section-2-Impact-Analysis]

## Tasks / Subtasks

### Task 1: Database Schema & Migrations (AC1)
- [ ] **Subtask 1.1**: Create `FamilyInvite` Prisma model with all required fields
- [ ] **Subtask 1.2**: Add indexes on `codeHash`, `familyId`, `inviteeEmailEncrypted`
- [ ] **Subtask 1.3**: Generate Prisma migration: `pnpm prisma migrate dev --name add_email_bound_invites`
- [ ] **Subtask 1.4**: Apply migration to local database and verify schema
- [ ] **Subtask 1.5**: Create GraphQL `FamilyInvite` type (if needed for queries)

### Task 2: Email Encryption Utilities (AC2)
- [ ] **Subtask 2.1**: Create `apps/backend/src/common/utils/crypto.util.ts`
- [ ] **Subtask 2.2**: Implement `encryptEmail(email: string): string`
  - Use Node.js `crypto` module with AES-256-GCM
  - Derive key from `INVITE_SECRET` using PBKDF2 or direct hex decode
  - Generate random IV (initialization vector)
  - Return base64-encoded: IV + ciphertext + auth tag
- [ ] **Subtask 2.3**: Implement `decryptEmail(encrypted: string): string`
  - Decode base64 to extract IV, ciphertext, auth tag
  - Decrypt using AES-256-GCM with INVITE_SECRET
  - Verify auth tag (throws if tampered)
  - Return plain email address
- [ ] **Subtask 2.4**: Add unit tests for encryption/decryption round-trip
- [ ] **Subtask 2.5**: Test tampering detection (modify ciphertext, expect error)
- [ ] **Subtask 2.6**: Validate `INVITE_SECRET` is 64-character hex at app startup

### Task 3: Invite Code Generation (AC3)
- [ ] **Subtask 3.1**: Create `generateInviteCode()` util using `crypto.randomBytes(16)` for 128-bit token
- [ ] **Subtask 3.2**: Encode token as 22-character base64url string
- [ ] **Subtask 3.3**: Create `hashInviteCode()` util using SHA-256
- [ ] **Subtask 3.4**: Test code generation produces unique codes

### Task 4: Backend - Create Invite Endpoint (AC3)
- [ ] **Subtask 4.1**: Update GraphQL mutation signature: `createInvite(inviteeEmail: String!): InviteResponse!`
- [ ] **Subtask 4.2**: Update `FamilyService.createInvite()` to accept `inviteeEmail` parameter
- [ ] **Subtask 4.3**: Validate email format using email validation library
- [ ] **Subtask 4.4**: Generate 22-char random invite code
- [ ] **Subtask 4.5**: Encrypt invitee email using `encryptEmail()`
- [ ] **Subtask 4.6**: Hash invite code using SHA-256
- [ ] **Subtask 4.7**: Store in `family_invites` table with `expiresAt = NOW() + 14 days`
- [ ] **Subtask 4.8**: Return `InviteResponse` with code, email, expiration

### Task 5: Backend - Join Family Validation (AC4, AC5, AC6)
- [ ] **Subtask 5.1**: Update `AuthService.joinFamily()` to accept email parameter
- [ ] **Subtask 5.2**: Hash provided invite code and lookup in `family_invites.codeHash`
- [ ] **Subtask 5.3**: Validate invite exists, return error if not found
- [ ] **Subtask 5.4**: Check expiration: `expiresAt > NOW()`, return error if expired
- [ ] **Subtask 5.5**: Check redeemed status: `redeemedAt IS NULL`, return error if used
- [ ] **Subtask 5.6**: Decrypt `inviteeEmailEncrypted` using `decryptEmail()`
- [ ] **Subtask 5.7**: Compare decrypted email with provided email (case-insensitive)
- [ ] **Subtask 5.8**: Return error if email mismatch: "This invite code was not sent to your email address"
- [ ] **Subtask 5.9**: If valid: Create user account (Story 1.2 logic)
- [ ] **Subtask 5.10**: Mark invite redeemed: `UPDATE SET redeemedAt = NOW(), redeemedByUserId = user.id`
- [ ] **Subtask 5.11**: Send verification email (Story 1.4 integration)
- [ ] **Subtask 5.12**: Return `EmailVerificationResponse` (not immediate JWT)

### Task 6: Error Handling & User Messages (AC4, AC5, AC6, AC8)
- [ ] **Subtask 6.1**: Create custom exception: `InviteNotFoundException`
- [ ] **Subtask 6.2**: Create custom exception: `InviteExpiredException`
- [ ] **Subtask 6.3**: Create custom exception: `InviteAlreadyUsedException`
- [ ] **Subtask 6.4**: Create custom exception: `InviteEmailMismatchException`
- [ ] **Subtask 6.5**: Map exceptions to user-friendly GraphQL error messages
- [ ] **Subtask 6.6**: Test all error cases return appropriate messages

### Task 7: Frontend - Invite Creation UI (AC7)
- [ ] **Subtask 7.1**: Create `InviteCreationForm` component
- [ ] **Subtask 7.2**: Add email input with validation (email format)
- [ ] **Subtask 7.3**: Add "Generate Invite Code" button
- [ ] **Subtask 7.4**: Call `createInvite` mutation with email
- [ ] **Subtask 7.5**: Display generated invite code, invitee email, expiration date
- [ ] **Subtask 7.6**: Implement copy-to-clipboard for invite code
- [ ] **Subtask 7.7**: Add instructions: "Share this code with [email]"
- [ ] **Subtask 7.8**: Integrate into family settings page

### Task 8: Frontend - Join Family Updates (AC8)
- [ ] **Subtask 8.1**: Update join family form to send email with invite code
- [ ] **Subtask 8.2**: Handle email mismatch error: display clear message
- [ ] **Subtask 8.3**: Handle expired invite error: suggest requesting new invite
- [ ] **Subtask 8.4**: Handle already used error: suggest contacting admin
- [ ] **Subtask 8.5**: On success: redirect to verification pending (Story 1.4)
- [ ] **Subtask 8.6**: Test error handling for all cases

### Task 9: Security & Validation (AC2, AC3, AC4)
- [ ] **Subtask 9.1**: Validate `INVITE_SECRET` is 64-character hex at startup
- [ ] **Subtask 9.2**: Test encryption produces different output for same input (random IV)
- [ ] **Subtask 9.3**: Test decryption fails if ciphertext tampered
- [ ] **Subtask 9.4**: Test email comparison is case-insensitive
- [ ] **Subtask 9.5**: Test invite code generation produces unique codes
- [ ] **Subtask 9.6**: Test concurrent redemption attempts (race condition)

### Task 10: Testing (All ACs)
- [ ] **Subtask 10.1**: Unit tests: Email encryption/decryption round-trip
- [ ] **Subtask 10.2**: Unit tests: Invite code generation uniqueness
- [ ] **Subtask 10.3**: Unit tests: Invite validation logic (expired, used, mismatch)
- [ ] **Subtask 10.4**: Integration tests: Full invite creation → redemption flow
- [ ] **Subtask 10.5**: Integration tests: Email mismatch rejection
- [ ] **Subtask 10.6**: Integration tests: Expired invite rejection
- [ ] **Subtask 10.7**: Integration tests: Already used invite rejection
- [ ] **Subtask 10.8**: Integration tests: Race condition handling (concurrent redemptions)
- [ ] **Subtask 10.9**: E2E tests: Admin creates invite → member joins with correct email
- [ ] **Subtask 10.10**: E2E tests: Member tries wrong email → sees error

## Dev Notes

### Architecture Patterns & Constraints

**Email Encryption Design (Server-Side):**
- AES-256-GCM symmetric encryption (authenticated encryption)
- Key derived from `INVITE_SECRET` environment variable (32-byte hex)
- Random IV (initialization vector) generated per encryption
- Authentication tag prevents tampering (integrity check)
- Ciphertext format: base64(IV + ciphertext + auth_tag)
- [Source: docs/sprint-change-proposal-2025-11-08.md#Appendix-A]

**Invite Code Security:**
- 128-bit cryptographic randomness (`crypto.randomBytes(16)`)
- Encoded as 22-character base64url (URL-safe, no padding)
- Stored hashed (SHA-256) in database for lookup
- Plain code given to admin to share with invitee
- Never store plain code in database (only hash)
- [Source: docs/sprint-change-proposal-2025-11-08.md#Section-2]

**Single-Use Enforcement:**
- `redeemedAt` timestamp marks invite as used
- Database query: `WHERE redeemedAt IS NULL` ensures single-use
- Transaction isolation prevents race conditions
- Consider using database-level locking for concurrent redemptions
- [Source: OWASP best practices, Sprint Change Proposal]

**Expiration Logic:**
- Invite expires 14 days after creation (`createdAt + 14 days`)
- Query validation: `WHERE expiresAt > NOW()`
- Expired invites not deleted (audit trail)
- Admin can create new invite for same email if previous expired

**Email Validation:**
- Case-insensitive comparison: `email.toLowerCase() === decryptedEmail.toLowerCase()`
- Prevents case-sensitivity bypass attacks
- Frontend validates email format before submission
- Backend performs additional validation

**Environment Variables:**
```bash
# Backend (.env)
INVITE_SECRET=<64-character hex from: openssl rand -hex 32>
# CRITICAL: Must match frontend .env.local (same secret)
```

**GraphQL Schema Updates:**
```graphql
# Mutation signatures
createInvite(inviteeEmail: String!): InviteResponse!
joinFamily(email: String!, inviteCode: String!, password: String!, name: String!): EmailVerificationResponse!

# Response types
type InviteResponse {
  inviteCode: String!
  inviteeEmail: String!
  expiresAt: DateTime!
}
```

### Project Structure Notes

**Backend Files to Create:**
- `apps/backend/src/common/utils/crypto.util.ts` - Email encryption/decryption
- `apps/backend/src/common/utils/invite-code.util.ts` - Invite code generation/hashing
- `apps/backend/src/family/exceptions/` - Custom invite exceptions

**Backend Files to Modify:**
- `apps/backend/prisma/schema.prisma` - Add FamilyInvite model
- `apps/backend/src/family/family.service.ts` - Update createInvite() method
- `apps/backend/src/family/family.resolver.ts` - Update createInvite mutation
- `apps/backend/src/auth/auth.service.ts` - Update joinFamily() validation
- `apps/backend/src/auth/auth.resolver.ts` - Update joinFamily mutation

**Frontend Files to Create:**
- `src/components/family/InviteCreationForm.tsx` - Invite creation UI
- `src/lib/graphql/mutations/family.ts` - createInvite mutation

**Frontend Files to Modify:**
- `src/app/(auth)/unified-login-screen.tsx` - Update join family form
- `src/lib/graphql/mutations/auth.ts` - Update joinFamily mutation signature

**Database Migration:**
- `apps/backend/prisma/migrations/YYYYMMDD_add_email_bound_invites/migration.sql`

### Testing Standards Summary

**Unit Test Coverage:**
- Email encryption/decryption produces correct output
- Decryption fails if ciphertext tampered (auth tag verification)
- Invite code generation produces unique codes
- Email comparison is case-insensitive
- Expiration logic correctly validates 14-day window

**Integration Test Coverage:**
- Admin creates invite → invite stored with encrypted email
- Member joins with correct email → account created, invite marked used
- Member tries wrong email → error returned, invite remains unused
- Expired invite rejected with appropriate error
- Already used invite rejected with appropriate error
- Concurrent redemption attempts handled correctly (no race condition)

**E2E Test Coverage:**
- Admin creates invite for user@example.com → shares code
- Member registers with user@example.com + code → success
- Member tries different email → sees "invite not sent to your email" error
- Member tries expired invite → sees "invite expired" error
- Member tries reusing code → sees "already used" error

**Test Files:**
- `apps/backend/src/common/utils/crypto.util.spec.ts` - Crypto utils tests
- `apps/backend/src/family/family.service.spec.ts` - Invite creation tests
- `apps/backend/src/auth/auth.service.spec.ts` - Invite validation tests
- `apps/backend/test/email-bound-invites.e2e-spec.ts` - Integration tests
- `tests/e2e/invite-flow.spec.ts` - Playwright E2E tests

### Dependencies

**This story depends on:**
- ✅ Story 1.6: Brevo Email Service Integration (for verification emails)
- ✅ Story 1.4: Email Verification (integration point for post-registration flow)

**Related Stories:**
- Story 1.1: Create Family Account (baseline invite logic)
- Story 1.2: Join Family (updates invite acceptance flow)

### References

**Primary Sources:**
- [Sprint Change Proposal](docs/sprint-change-proposal-2025-11-08.md)
- [PRD - FR-1.8: Email-Bound Invite System](docs/PRD.md#FR-1) (to be added)
- [Solution Architecture - Family Invites](docs/solution-architecture.md) (to be updated)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)

**Technical References:**
- Node.js crypto module (AES-256-GCM): https://nodejs.org/api/crypto.html
- Base64url encoding: https://www.rfc-editor.org/rfc/rfc4648#section-5
- SHA-256 hashing: https://nodejs.org/api/crypto.html#cryptocreatehashalgorithm-options
- OWASP Cryptographic Storage: https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html

**Security Research:**
- [Sprint Change Proposal - Appendix A](docs/sprint-change-proposal-2025-11-08.md#Appendix-A) - OWASP-validated approach

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

<!-- Agent model version will be added during implementation -->

### Debug Log References

<!-- Links to debug logs will be added during implementation -->

### Completion Notes List

<!-- Post-implementation notes will be added here -->

### File List

<!-- Created/modified files will be listed here after implementation -->
