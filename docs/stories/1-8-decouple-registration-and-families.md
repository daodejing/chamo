# Story 1.8: Decouple Account Registration from Family Creation

Status: drafted

## Story

As a **prospective Chamo user**,
I want **to register and verify my account independently of family creation**,
so that **I can securely create or join families only after my identity is confirmed and my personal encryption keys are ready**.

## Context

The current onboarding path mixes account registration, email verification, family creation, and family key provisioning. That coupling produces multiple failures:
- Unverified admins can still obtain JWTs and access `/chat`.
- Family encryption keys are lost when verification happens in another browser/device, leading to "encryption key missing" modals.
- Invite flows cannot reliably resume after registration because key material lives only in temporary storage.

To fix this, we will adopt per-user keypairs at registration time, move all family creation into authenticated sessions, and redesign invites so the family key is encrypted with the invitee's public key. This mirrors Signal-style E2EE principles without requiring full double-ratchet support yet.

## Acceptance Criteria

- **AC1: Account-Only Registration** – Completing the registration form creates a user account and generates that user's public/private keypair client-side. The backend returns only a verification acknowledgement (no JWTs, no invite info).
- **AC2: Email Verification Gate** – Login attempts for `emailVerified=false` users always fail with `requiresEmailVerification: true`; no tokens are issued and `/chat` stays inaccessible.
- **AC3: Authenticated Family Creation** – Once logged in with a verified account, the user can create a family. Family key generation happens during this authenticated action, never during registration.
- **AC4: Invite Flow (Registered Users)** – Invite links encrypt the family key with the invitee's public key. When a registered, verified user opens the invite, the client decrypts the payload with their private key and joins the family without "encryption key missing" errors.
- **AC5: Two-Phase Invite Flow (Unregistered Users)** – When admin attempts to invite an unregistered user:
  1. **Phase 1 - Registration Check:** System checks if invitee email has an account. If not, admin is notified: "user@example.com is not registered yet."
  2. **Phase 2 - Registration Prompt:** Admin can send registration link to invitee via "Send Registration Invitation" button. System sends email: "You've been invited to join [Family Name]. Register to accept the invitation."
  3. **Phase 3 - Registration Notification:** When invitee completes registration + verification, system notifies admin: "user@example.com has registered! You can now complete their family invitation."
  4. **Phase 4 - Complete Invite:** Admin returns to invite flow, system fetches invitee's public key (now available), encrypts family key, and generates invite code.
  5. **Acceptance:** Invitee receives invite code, accepts, client decrypts family key using their private key, joins family successfully.

  **User Enumeration Trade-off:** Admin learns registration status (accepted trade-off following Signal/WhatsApp pattern for E2EE security).
- **AC6: No Unverified Access** – Metrics confirm 0% unverified logins reach `/chat` and 100% invite acceptances hydrate the family key (including cross-browser verification scenarios).

## Tasks / Subtasks

### Task 1: Registration Flow Updates
- [x] Generate per-user keypairs client-side during registration and store private keys securely (IndexedDB + passphrase/OS keystore). *(Completed in Story 1.9)*
- [x] Update GraphQL `register` mutation to return only verification messaging; remove JWT/Invite side effects.
- [ ] Persist pending invites (if any) in durable client storage that survives cross-browser verification (e.g., encrypted payload embedded in invite link). *(Deferred - will be handled in Task 4 invite encryption)*

### Task 2: Verification & Login Gate
- [x] Ensure `login` and guards return `requiresEmailVerification` with no tokens for unverified accounts.
- [x] Add regression tests proving unverified users cannot reach `/chat`. *(Already implemented in JwtAuthGuard, verified in auth.service.spec.ts)*

### Task 3: Authenticated Family Creation
- [x] Implement a post-login "Create Family" mutation that generates the family key and invite code, mapping the key to the creator's account.
- [x] Store family key client-side in IndexedDB; server stores only the unencrypted invite code (family key never sent to server, ensuring E2EE).
- [x] Create family-setup UI page with "Create Family" and "Join Family" tabs.
- [x] Add redirect logic from chat page to family-setup when user doesn't have a family.

### Task 4: Invite Encryption Flow (Registered Users Only)
- [x] Create cryptographic utilities for invite encryption/decryption using nacl.box
- [x] Add GET_USER_PUBLIC_KEY_QUERY to check if invitee is registered
- [x] Add Prisma Invite model to store encrypted invites
- [x] Create backend mutations: createEncryptedInvite, acceptInvite
- [x] Build InviteMemberDialog UI component with email input
- [x] Check if invitee email has registered account with public key
- [x] If NO public key: Show "User not registered" UI, offer "Send Registration Link" option
- [x] If public key exists: Encrypt family key with invitee's public key
- [x] Store encrypted invite with inviteeEmail, encryptedFamilyKey, nonce, and inviterId
- [x] Implement invite acceptance flow with key decryption

### Task 5: Testing & Instrumentation
- [ ] Unit/integration tests for keypair generation, invite encryption/decryption, and login gating.
- [ ] Playwright scenario: register in Browser A, verify/invite in Browser B, log back into Browser A, confirm no "encryption key missing" modal.
- [ ] Metrics/Dashboards to detect any unverified logins reaching `/chat` and invite decrypt failures.

### Task 6: Admin Notification System
- [ ] Create notification mechanism when pending invitee registers
- [ ] Update UI to show "Pending Invitations" section in family settings
- [ ] Display status: "Waiting for registration" vs "Ready to complete invite"
- [ ] Email notification to admin when invitee registers (optional)
- [ ] "Complete Invite" button appears when invitee registered

## Dev Notes

### Technology Stack (Architect-Approved)

**Cryptography Libraries:**
- **`tweetnacl`** - Keypair generation (Ed25519/X25519)
  - Audited by Cure53 (Jan-Feb 2017) - no security issues found
  - 7 KB minified, no async initialization required
  - Use `nacl.box.keyPair()` for per-user keypairs at registration
  - NPM: `npm install tweetnacl`

- **`dexie` + `dexie-encrypted`** - Secure IndexedDB storage
  - Transparent encryption for private keys in IndexedDB
  - TypeScript-first, 13.7k stars, actively maintained (Jan 2025)
  - Non-extractable key storage support
  - NPM: `npm install dexie dexie-encrypted`

- **`2key-ratchet`** - E2EE encrypted envelopes
  - Implements Signal-style Double Ratchet + X3DH
  - Perfect for encrypting family keys with invitee public keys
  - Native TypeScript, WebCrypto-based (no external deps)
  - NPM: `npm install 2key-ratchet`

**Storage Strategy:**
- Private keys → IndexedDB (encrypted with device key via dexie-encrypted)
- Public keys → Server database (plaintext, used for invite encryption)
- Family keys → Encrypted envelopes (encrypted per-invitee using their public key)

**Key Management Transparency:**
- **Option 1 (MVP - Recommended):** Device-based key encryption
  - Generate keypair once per device
  - Encrypt private key with device fingerprint (no user passphrase needed)
  - Store in IndexedDB with dexie-encrypted
  - Trade-off: Keys don't sync across devices automatically

- **Option 2 (Future):** Platform keystore integration
  - Use WebAuthn/Credential Management API
  - Store in OS keychain (macOS Keychain, Windows Credential Manager)
  - Requires modern browsers, more complex implementation

**Implementation Pattern:**

```typescript
// 1. Registration (Client-Side)
import nacl from 'tweetnacl';
import { secureDB } from '@/lib/secure-db'; // Dexie instance

async function registerUser(email: string) {
  // Generate keypair
  const keypair = nacl.box.keyPair();

  // Store encrypted in IndexedDB
  await secureDB.userKeys.add({
    email,
    publicKey: Buffer.from(keypair.publicKey).toString('base64'),
    secretKey: Buffer.from(keypair.secretKey).toString('base64')
  });

  // Send public key to server
  await registerMutation({
    email,
    publicKey: Buffer.from(keypair.publicKey).toString('base64')
  });
}

// 2. Invite Encryption (using 2key-ratchet)
import { DoubleRatchet } from '2key-ratchet';

async function createInvite(familyKey: Uint8Array, inviteePublicKey: string) {
  const encryptedEnvelope = await DoubleRatchet.encryptToPublicKey(
    Buffer.from(inviteePublicKey, 'base64'),
    familyKey
  );
  return encryptedEnvelope;
}
```

**Browser Compatibility:**
- All modern browsers (Chrome, Firefox, Safari, Edge)
- No IE11 support (requires IndexedDB + WebCrypto)

**Security Boundaries:**
- Private keys NEVER leave client (except encrypted backups)
- Server only stores public keys + encrypted envelopes
- No plaintext family keys on server
- Follow Signal-inspired patterns: per-user keypairs, encrypted envelopes for invites

**Documentation Updates:**
- Update `docs/tech-spec-epic-1.md` with new registration/verification flows
- Update `docs/solution-architecture.md` with E2EE architecture patterns
- Add security section documenting key management strategy

### Two-Phase Invite Pattern

**Registration-First Requirement:**

Registration-first is required because:
1. Public key cryptography requires recipient's public key to encrypt
2. Public keys are generated during user registration
3. Cannot create encrypted invite without target public key

**User Enumeration Consideration:**

- Admin can determine if email is registered (checks public key existence)
- This follows Signal/WhatsApp pattern (accepted security trade-off)
- Alternative would be server-side encryption (breaks true E2EE)
- Decision: Accept enumeration for better security posture

**Admin UX Flow:**

```
Admin → Enter invitee email → System checks registration

IF registered (publicKey exists):
  → "Generate Invite" button enabled
  → Creates encrypted invite immediately

IF NOT registered (no publicKey):
  → "Send Registration Link" button shown
  → Admin sends registration invitation
  → System notifies admin when registration complete
  → Admin returns to complete invite creation
```

## Story Context Reference

- [x] Story context XML exists at `docs/stories/1-8-decouple-registration-and-families.context.xml`.

## Dev Agent Record

### Debug Log

**2025-11-09: Task 4 - Add Prisma Invite Model**
- Created Invite model in schema.prisma with fields: familyId, inviterId, inviteeEmail, encryptedFamilyKey, nonce, inviteCode, status, expiresAt, acceptedAt
- Added InviteStatus enum (PENDING, ACCEPTED, EXPIRED, REVOKED)
- Added relations: Family→invites, User→sentInvites
- Ran schema-updater workflow:
  - Applied Prisma migration `20251109122850_add_invites_table`
  - Restarted backend to regenerate GraphQL schema
  - Regenerated frontend TypeScript types
- Migration includes all indexes (inviteCode, inviteeEmail, familyId, status) and foreign key constraints

**2025-11-09: Task 4 - Create Backend Mutations**
- Created DTOs: CreateEncryptedInviteInput, AcceptInviteInput
- Created response types: InviteType, CreateInviteResponse, AcceptInviteResponse
- Added GraphQL mutations to auth.resolver.ts: createEncryptedInvite, acceptInvite
- Implemented business logic in auth.service.ts:
  - createEncryptedInvite: Validates membership, checks for existing invites, creates encrypted invite
  - acceptInvite: Validates invite code/expiry/email, creates family membership, marks invite accepted
- Both mutations include proper error handling (ForbiddenException, ConflictException, BadRequestException)
- Backend restarted with 0 TypeScript errors, GraphQL schema regenerated
- Frontend types regenerated to include new mutations

**2025-11-09: Task 4 - Build UI Components**
- Created InviteMemberDialog component with email input and registration check
- Integrated encryption utilities: encryptFamilyKeyForRecipient, getFamilyKeyBase64
- Implemented flow: email input → check public key → encrypt if registered → create invite
- Shows "User not registered" warning with hint if invitee hasn't registered
- Created family settings page at /family/settings with invite button
- Added comprehensive translations (Japanese + English) for invite dialog and toasts
- All UI components use existing crypto utilities from Story 1.9

**2025-11-09: Task 4 - Implement Invite Acceptance Flow**
- Updated AcceptInviteResponse to include inviterPublicKey field
- Modified auth.service.ts acceptInvite to fetch and return inviter's public key
- Added acceptInvite function to auth context:
  - Calls acceptInvite mutation
  - Decrypts family key using decryptFamilyKey utility (inviter's public key + recipient's private key)
  - Stores decrypted key in IndexedDB via initializeFamilyKey
  - Refreshes user to update family membership
- Created accept invite page at /accept-invite with query parameter support (?code=XXX)
- Page auto-accepts invite on load if user is authenticated
- Shows success state with family name and redirects to chat
- Shows error state with retry button
- Added comprehensive translations (Japanese + English) for accept invite flow
- Complete E2EE flow: Admin encrypts → Server stores encrypted → Invitee decrypts client-side

### Completion Notes

*To be filled as tasks complete.*

## File List

### Modified Files
- `apps/backend/prisma/schema.prisma` - Added Invite model and InviteStatus enum
- `apps/backend/src/auth/auth.resolver.ts` - Added createEncryptedInvite and acceptInvite mutations
- `apps/backend/src/auth/auth.service.ts` - Implemented invite creation and acceptance logic (includes inviterPublicKey)
- `apps/backend/src/auth/types/invite.type.ts` - Updated AcceptInviteResponse with inviterPublicKey field
- `src/lib/contexts/auth-context.tsx` - Added acceptInvite function with client-side key decryption
- `src/lib/graphql/generated/graphql.ts` - Auto-generated with new Invite types and mutations
- `src/lib/graphql/operations.ts` - Added CREATE_ENCRYPTED_INVITE_MUTATION and ACCEPT_INVITE_MUTATION
- `src/lib/translations.ts` - Added invite dialog, accept invite, and toast translations (Japanese + English)

### New Files
- `apps/backend/prisma/migrations/20251109122850_add_invites_table/migration.sql` - Database migration for invites table
- `apps/backend/src/auth/dto/create-encrypted-invite.input.ts` - DTO for createEncryptedInvite mutation
- `apps/backend/src/auth/dto/accept-invite.input.ts` - DTO for acceptInvite mutation
- `apps/backend/src/auth/types/invite.type.ts` - GraphQL types for Invite responses
- `src/components/family/invite-member-dialog.tsx` - Dialog component for inviting members with encryption
- `src/app/family/settings/page.tsx` - Family settings page with invite functionality
- `src/app/(auth)/accept-invite/page.tsx` - Accept invite page with client-side key decryption

## Change Log

- **2025-11-09**: Added Prisma Invite model with encryption support (Task 4)
- **2025-11-09**: Implemented createEncryptedInvite and acceptInvite GraphQL mutations (Task 4)
- **2025-11-09**: Built InviteMemberDialog component and family settings page with full E2EE invite flow (Task 4)
- **2025-11-09**: Implemented complete invite acceptance flow with client-side key decryption (Task 4) ✅ **TASK 4 COMPLETE**
