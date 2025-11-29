# Story 1.12: User Keypair Regeneration

Status: ready

## Story

As a **user with missing encryption keys**,
I want **to regenerate my keypair automatically or manually**,
so that **I can send and receive family invites again without losing access to existing messages**.

## Acceptance Criteria

1. **AC1: Detection** — Trigger regeneration flow when `hasPrivateKey(userId)` returns false but user has valid session:
   - On login
   - On tab focus (visibilitychange event) to catch mid-session key loss
2. **AC2: User Notification** — Display modal with context-appropriate messaging:
   - **Automatic trigger**: "Your encryption keys need to be restored" (something went wrong tone)
   - **Manual trigger**: "You are about to regenerate your encryption keys" (intentional action tone)
   - Both explain: existing messages still work, pending invites will be invalidated
3. **AC3: Key Generation** — Generate new X25519 keypair client-side using `nacl.box.keyPair()`
4. **AC4: Local Storage** — Store private key in IndexedDB via `storePrivateKey(userId, secretKey)` before server update
5. **AC5: Server Update** — Call `updateUserPublicKey` mutation to update public key on server
6. **AC6: Invite Invalidation** — Server marks any pending invites TO this user as `INVALIDATED` status with `invalidatedAt` timestamp (allows sender to query and resend)
7. **AC7: Success Feedback** — On success: dismiss modal, clear warning flags, show toast with count of invalidated invites (if any)
8. **AC8: Error Recovery** — If server update fails, delete local key and allow retry; if local storage fails, show error with retry option
9. **AC9: Manual Trigger** — Add "Regenerate Encryption Keys" option in Settings → Account Settings for manual troubleshooting

## Tasks / Subtasks

- [ ] Task 1: Backend - GraphQL mutation (AC: 5, 6)
  - [ ] 1.1: Add `updateUserPublicKey(publicKey: String!)` mutation to schema
  - [ ] 1.2: Implement resolver that updates `users.publicKey` column
  - [ ] 1.3: Add `invalidatedAt` column to invites table (nullable DateTime)
  - [ ] 1.4: Add logic to mark pending invites to this user as INVALIDATED with `invalidatedAt = NOW()`
  - [ ] 1.5: Return `{ success: Boolean, invalidatedInviteCount: Int }`
  - [ ] 1.6: Add rate limiting (max 3 regenerations per hour per user)

- [ ] Task 2: Frontend - Regeneration Modal (AC: 2, 3, 4, 7, 8)
  - [ ] 2.1: Create `KeyRegenerationModal` component with `trigger` prop ('auto' | 'manual')
  - [ ] 2.2: Implement context-aware messaging (auto: "restore", manual: "regenerate")
  - [ ] 2.3: Implement key generation using `nacl.box.keyPair()`
  - [ ] 2.4: Implement atomic local storage with rollback on failure
  - [ ] 2.5: Wire up GraphQL mutation call
  - [ ] 2.6: Handle success state (dismiss, clear flags, toast with invalidated count)
  - [ ] 2.7: Handle error states with retry capability

- [ ] Task 3: Frontend - Detection Integration (AC: 1)
  - [ ] 3.1: Add `visibilitychange` event listener to check keys on tab focus
  - [ ] 3.2: Update `auth-context.tsx` to show `KeyRegenerationModal` instead of `LostKeyModal`
  - [ ] 3.3: Pass `trigger='auto'` and regeneration handlers to modal
  - [ ] 3.4: Remove or repurpose `LostKeyModal` (now replaced)

- [ ] Task 4: Frontend - Manual Trigger in Settings (AC: 9)
  - [ ] 4.1: Add "Regenerate Encryption Keys" option to Account Settings section
  - [ ] 4.2: Show `KeyRegenerationModal` with `trigger='manual'` on click
  - [ ] 4.3: Reuse regeneration logic from Task 2

- [ ] Task 5: Testing
  - [ ] 5.1: Unit tests for key generation and storage
  - [ ] 5.2: Integration test for full regeneration flow
  - [ ] 5.3: Test invite invalidation on server (including `invalidatedAt` timestamp)
  - [ ] 5.4: Test error recovery scenarios
  - [ ] 5.5: Test visibilitychange detection triggers modal

## Dev Notes

### Architecture Patterns

- **Client-side key generation**: Private key NEVER leaves device (security requirement)
- **Atomic operations**: Local storage must succeed before server update; rollback on failure
- **Idempotent server operation**: Multiple calls with same public key should be safe
- **Dual-trigger detection**: Check keys on login AND on tab focus (visibilitychange event)
- **Context-aware UX**: Different messaging for automatic vs manual regeneration

### Source Tree Components

```
src/
├── components/
│   ├── auth/
│   │   ├── key-regeneration-modal.tsx  # NEW - replaces lost-key-modal.tsx
│   │   └── lost-key-modal.tsx          # DEPRECATE or remove
│   └── settings-screen.tsx             # ADD to Account Settings section
├── lib/
│   ├── contexts/
│   │   └── auth-context.tsx            # MODIFY detection logic
│   ├── crypto/
│   │   └── secure-storage.ts           # Existing - storePrivateKey
│   └── graphql/
│       └── operations.ts               # ADD updateUserPublicKey mutation

apps/backend/
├── src/
│   ├── schema.graphql                  # ADD mutation
│   └── resolvers/
│       └── user.resolver.ts            # ADD resolver
```

### Testing Standards

- Unit tests for crypto operations (key generation, storage)
- Integration tests for full flow with mocked GraphQL
- E2E test for Settings manual trigger path

### Security Considerations

1. Rate limit regeneration to prevent abuse
2. Log regeneration events for audit trail
3. No key escrow - old keys are unrecoverable by design
4. Pending invites become unrecoverable (user must be informed)

### Project Structure Notes

- Follows existing pattern for auth modals in `src/components/auth/`
- GraphQL mutation follows existing patterns in `apps/backend/src/resolvers/`
- Uses existing `storePrivateKey` from `secure-storage.ts`

### References

- [Source: src/lib/crypto/secure-storage.ts] - `storePrivateKey`, `hasPrivateKey` functions
- [Source: src/lib/e2ee/invite-encryption.ts] - `encryptFamilyKeyForRecipient` uses keypair
- [Source: src/components/auth/lost-key-modal.tsx] - Current warning modal to replace
- [Source: src/lib/contexts/auth-context.tsx#L243-267] - Current detection logic

## Dev Agent Record

### Context Reference

- `docs/stories/story-1.12-keypair-regeneration.context.xml` (Generated: 2025-11-29)

### Agent Model Used

<!-- To be filled by dev agent -->

### Debug Log References

### Completion Notes List

### File List
