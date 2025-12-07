# Story 1.15: Key Status Display & Recovery Prompts

Status: draft

## Story

As a **user with missing encryption keys**,
I want **to be clearly informed about what's missing and what action to take**,
so that **I can recover access to encrypted communication with minimal confusion**.

## Context

Users can lose two types of keys:

1. **User keypair** (X25519): Personal keys for receiving encrypted invites
   - Stored in IndexedDB per user
   - If missing: Cannot decrypt incoming invites, must delete account and re-register

2. **Family key** (symmetric): Shared key for family message encryption
   - Stored in IndexedDB per family
   - If missing: Cannot decrypt messages, admin must remove and re-invite

Currently, missing keys show generic errors or the `[Encrypted - Key Missing]` placeholder.
This story provides clear diagnostics and actionable recovery paths.

## Acceptance Criteria

### Key Status Detection

1. **AC1: Keypair Check on Login** — After successful login, verify user keypair exists in IndexedDB
2. **AC2: Family Key Check on Family Switch** — When switching to or loading a family, verify family key exists
3. **AC3: Visibility Change Check** — Re-check keys on tab focus (visibilitychange event) to catch mid-session loss

### Missing Keypair Flow

4. **AC4: Missing Keypair Modal** — When user keypair is missing, show modal:
   - Title: "Encryption Keys Not Found"
   - Message: "Your encryption keys are missing from this device. To restore secure messaging, you'll need to delete your account and re-register. Your messages will be preserved."
   - Actions: [Delete Account] [Learn More]
5. **AC5: Block Interaction** — User cannot dismiss modal or use app until resolved (keypair is critical)
6. **AC6: Delete Account Flow** — "Delete Account" opens password confirmation, then executes self de-registration (Story 1.14)

### Missing Family Key Flow

7. **AC7: Missing Family Key Modal** — When family key is missing for active family, show modal:
   - Title: "Family Key Missing"
   - Message: "The encryption key for [Family Name] is missing. Contact your family admin to be removed and re-invited."
   - Actions: [Switch Family] [OK]
8. **AC8: Switch Family Option** — If user has other families, allow switching to one with valid keys
9. **AC9: Single Family Case** — If user only has one family (with missing key), show simplified message without switch option
10. **AC10: Dismissable** — Family key modal can be dismissed (user can still see UI, just can't decrypt messages)

### Key Status in Settings

11. **AC11: Key Status Section** — Add "Encryption Status" section to Settings showing:
    - User keypair: ✅ Valid / ❌ Missing
    - Per-family key status: ✅ Valid / ❌ Missing for each family
12. **AC12: Refresh Status** — Button to re-check key status
13. **AC13: Help Links** — Link to documentation explaining key recovery options

## Tasks / Subtasks

- [ ] Task 1: Frontend - Key Status Utilities (AC: 1, 2, 3)
  - [ ] 1.1: Create `useKeyStatus()` hook that checks keypair and family keys
  - [ ] 1.2: Add `hasUserKeypair(): Promise<boolean>` utility
  - [ ] 1.3: Add `hasFamilyKey(familyId): Promise<boolean>` utility
  - [ ] 1.4: Integrate checks into auth-context login flow
  - [ ] 1.5: Add visibilitychange listener for mid-session checks

- [ ] Task 2: Frontend - Missing Keypair Modal (AC: 4, 5, 6)
  - [ ] 2.1: Create `MissingKeypairModal` component
  - [ ] 2.2: Style as critical/blocking (no dismiss, no backdrop click)
  - [ ] 2.3: Implement "Delete Account" flow with password confirmation
  - [ ] 2.4: Implement "Learn More" linking to help docs
  - [ ] 2.5: Integrate into auth-context to show when keypair missing

- [ ] Task 3: Frontend - Missing Family Key Modal (AC: 7, 8, 9, 10)
  - [ ] 3.1: Create `MissingFamilyKeyModal` component
  - [ ] 3.2: Show family name in message
  - [ ] 3.3: Implement "Switch Family" dropdown (if multiple families)
  - [ ] 3.4: Handle single-family case (no switch option)
  - [ ] 3.5: Allow dismissal (user can still navigate, just can't read messages)
  - [ ] 3.6: Integrate into family switch/load logic

- [ ] Task 4: Frontend - Settings Key Status (AC: 11, 12, 13)
  - [ ] 4.1: Add "Encryption Status" section to Settings
  - [ ] 4.2: Display user keypair status with icon
  - [ ] 4.3: Display per-family key status list
  - [ ] 4.4: Add "Refresh Status" button
  - [ ] 4.5: Add help link to recovery documentation

- [ ] Task 5: Replace Existing Lost Key Modal
  - [ ] 5.1: Remove or deprecate `lost-key-modal.tsx`
  - [ ] 5.2: Update auth-context to use new modals
  - [ ] 5.3: Ensure smooth transition (no duplicate modals)

- [ ] Task 6: Testing
  - [ ] 6.1: Unit test - key status detection utilities
  - [ ] 6.2: Unit test - modal display logic
  - [ ] 6.3: Integration test - missing keypair triggers correct modal
  - [ ] 6.4: Integration test - missing family key triggers correct modal
  - [ ] 6.5: E2E test - keypair missing → delete account flow
  - [ ] 6.6: E2E test - family key missing → switch family flow

## Dev Notes

### Architecture Patterns

- **Blocking vs non-blocking**: Keypair loss is blocking (critical), family key loss is non-blocking (degraded experience)
- **Centralized detection**: Key checks happen in auth-context, modals rendered at app root
- **Graceful degradation**: Missing family key shows `[Encrypted - Key Missing]` but app remains usable

### Key Storage Reference

```typescript
// User keypair - stored per user
IndexedDB: secure-keys → privateKey:{userId}

// Family key - stored per family
IndexedDB: secure-keys → familyKey:{familyId}
```

### Source Tree Components

```
src/
├── components/
│   ├── auth/
│   │   ├── missing-keypair-modal.tsx     # NEW - blocking modal
│   │   ├── missing-family-key-modal.tsx  # NEW - dismissable modal
│   │   └── lost-key-modal.tsx            # DEPRECATE
│   └── settings/
│       └── encryption-status.tsx         # NEW - status display
├── lib/
│   ├── contexts/
│   │   └── auth-context.tsx              # MODIFY - add key checks
│   ├── crypto/
│   │   └── secure-storage.ts             # Existing - hasPrivateKey, etc.
│   └── hooks/
│       └── use-key-status.ts             # NEW - key status hook
```

### UX Considerations

1. **Clear language**: Avoid crypto jargon, explain in user terms
2. **Actionable**: Every modal has a clear next step
3. **No dead ends**: Always provide a path forward
4. **Admin contact**: For family key issues, direct to admin (they can remove + re-invite)

### Dependency

- **Requires Story 1.14**: Self de-registration for "Delete Account" action
- Can be developed in parallel, but full flow testing requires 1.14

## Dev Agent Record

### Context Reference

<!-- To be generated by story-context workflow -->

### Agent Model Used

<!-- To be filled by dev agent -->

### Debug Log References

### Completion Notes List

### File List
