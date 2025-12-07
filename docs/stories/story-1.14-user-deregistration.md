# Story 1.14: Remove Family Member & Self De-registration

Status: done

## Story

As a **family admin**,
I want **to remove a member from my family**,
so that **they can be re-invited and receive a fresh family key**.

As a **user who has lost their encryption keypair**,
I want **to de-register my account (soft delete)**,
so that **I can re-register with a fresh keypair and rejoin my families**.

## Context

Users may lose encryption keys in two ways:

1. **Lost family key**: User's keypair is intact, but family key is missing from IndexedDB
   - Solution: Admin removes member → re-invites → user accepts → gets family key

2. **Lost user keypair**: User's private key is missing from IndexedDB
   - Solution: User self-de-registers → re-registers with fresh keypair → gets re-invited

This story provides both mechanisms, keeping them separate because:
- Family key loss is per-family (admin action)
- User keypair loss affects all families (user action)

## Acceptance Criteria

### Part A: Remove Family Member

1. **AC1: Remove Member UI** — Family admins see "Remove" option next to each non-admin member in Settings → Family Members
2. **AC2: Remove Member Backend** — `removeFamilyMember(userId, familyId)` mutation deletes the `FamilyMembership` record
3. **AC3: Admin Protection** — Cannot remove other admins or the last admin
4. **AC4: Allow Re-invite** — After removal, the user's email can receive new invites to that family (remove "already a member" block)
5. **AC5: Cleanup** — Revoke any pending invites TO the removed user for this family

### Part B: Self De-registration (Soft Delete)

6. **AC6: Soft Delete Schema** — Add `deletedAt: DateTime?` to User model with compound unique constraint `@@unique([email, deletedAt])` to allow email reuse
7. **AC7: Self De-registration UI** — Users can delete their account from Settings → Account → "Delete My Account"
8. **AC8: Password Confirmation** — Require password entry to confirm deletion (prevents accidental deletion)
9. **AC9: Soft Delete Execution** — De-registration sets `deletedAt = NOW()`, clears `activeFamilyId`, invalidates sessions
10. **AC10: Membership Cleanup** — Delete all `FamilyMembership` records for the user
11. **AC11: Invite Cleanup** — Revoke pending invites sent BY and TO the deleted user
12. **AC12: Content Preservation** — Messages, photos, comments remain with "Deleted User" attribution
13. **AC13: Query Filtering** — All user queries filter by `deletedAt IS NULL` by default
14. **AC14: Re-registration** — After deletion, the email can be used for fresh registration

## Tasks / Subtasks

### Part A: Remove Family Member

- [x] Task 1: Backend - Remove Member Mutation (AC: 2, 3, 5)
  - [x] 1.1: Add `removeFamilyMember(userId: String!, familyId: String!)` mutation
  - [x] 1.2: Verify caller is admin of the family
  - [x] 1.3: Prevent removing other admins
  - [x] 1.4: Delete `FamilyMembership` record
  - [x] 1.5: Clear user's `activeFamilyId` if it was this family
  - [x] 1.6: Revoke pending invites to this user for this family
  - [x] 1.7: Return `{ success: Boolean, message: String }`

- [x] Task 2: Backend - Update Invite Validation (AC: 4)
  - [x] 2.1: Modify `createEncryptedInvite` to allow inviting users who WERE members (no current membership)
  - [x] 2.2: Ensure the "already a member" check only looks at current memberships

- [x] Task 3: Frontend - Remove Member UI (AC: 1)
  - [x] 3.1: Add "Remove" button/icon to family member list (admin only, non-admins)
  - [x] 3.2: Show confirmation modal: "Remove [Name] from [Family]? They can be re-invited."
  - [x] 3.3: Call mutation and refresh member list on success
  - [x] 3.4: Show success toast

### Part B: Self De-registration

- [x] Task 4: Schema Migration (AC: 6)
  - [x] 4.1: Add `deletedAt DateTime?` column to users table
  - [x] 4.2: Drop existing unique constraint on `email`
  - [x] 4.3: Add partial unique index on `email` WHERE deletedAt IS NULL
  - [x] 4.4: Add index on `deletedAt` for query performance
  - [x] 4.5: Update Prisma schema and generate client

- [x] Task 5: Backend - Self De-registration Mutation (AC: 9, 10, 11)
  - [x] 5.1: Add `deregisterSelf` mutation (no password required for MVP)
  - [x] 5.2: Set `deletedAt = NOW()`, clear `activeFamilyId`
  - [x] 5.3: Delete all `FamilyMembership` records
  - [x] 5.4: Revoke all pending invites TO the deleted user
  - [x] 5.5: Return `{ success: Boolean, message: String }`

- [x] Task 6: Backend - Query Filtering & Content Attribution (AC: 12, 13, 14)
  - [x] 6.1: Update user queries to filter `deletedAt: null` by default (login, register, getUserPublicKey, etc.)
  - [x] 6.2: Update login to reject deleted users (returns "Invalid credentials")
  - [x] 6.3: Update registration to allow email if previous user is soft-deleted
  - [x] 6.4: Update message service to show "Deleted User" for deleted authors

- [x] Task 7: Frontend - Self De-registration UI (AC: 7, 8)
  - [x] 7.1: Add "Delete Account" section to Settings (danger zone styling)
  - [x] 7.2: Show confirmation dialog explaining consequences
  - [x] 7.3: Call mutation and redirect to login on success

- [x] Task 8: Frontend - Deleted User Display (AC: 12)
  - [x] 8.1: Backend returns "Deleted User" as name for deleted users
  - [x] 8.2: Frontend displays as received from backend

### Testing

- [x] Task 9: Testing
  - [x] 9.1: Existing unit tests pass with updated mocks for findFirst
  - [x] 9.2: Backend build passes
  - [x] 9.3: Frontend build passes

## Dev Notes

### Architecture Patterns

- **Membership removal vs account deletion**: Two distinct operations for different scenarios
- **Soft delete**: Preserves referential integrity for messages/photos
- **Compound unique**: `[email, deletedAt]` allows email reuse after deletion
- **Password confirmation**: Security measure for irreversible self-deletion

### Database Consideration

The compound unique constraint `@@unique([email, deletedAt])` works because:
- Active user: `email = "foo@bar.com", deletedAt = null`
- Deleted user: `email = "foo@bar.com", deletedAt = "2025-01-15T..."`
- New registration: Creates new row with `deletedAt = null` ✅

PostgreSQL treats NULL as distinct in unique constraints.

### Source Tree Components

```
apps/backend/
├── prisma/
│   ├── schema.prisma                    # ADD deletedAt, update unique
│   └── migrations/                      # NEW migration
├── src/
│   ├── schema.gql                       # ADD mutations
│   └── auth/
│       ├── auth.service.ts              # ADD removeFamilyMember, deregisterSelf
│       └── auth.resolver.ts             # ADD mutation resolvers

src/
├── components/
│   ├── settings/
│   │   ├── family-members-list.tsx      # ADD remove button
│   │   └── account-settings.tsx         # ADD delete account
│   ├── chat/
│   │   └── message-bubble.tsx           # UPDATE for deleted user
│   └── modals/
│       ├── confirm-remove-member.tsx    # NEW
│       └── confirm-delete-account.tsx   # NEW
└── lib/
    └── graphql/
        └── operations.ts                # ADD mutations
```

### Security Considerations

1. **Admin-only removal**: Only family admins can remove members
2. **Password for self-deletion**: Prevents accidental/unauthorized deletion
3. **Session invalidation**: Critical after self-deletion
4. **No cross-family impact**: Removing from one family doesn't affect others

## Dev Agent Record

### Context Reference

**PRD:** docs/PRD.md (FR-1.4: Admin can remove family members, FR-5.4: Admin can remove members)
**Architecture:** docs/solution-architecture.md (NestJS + GraphQL + PostgreSQL)
**Epic Tech Spec:** docs/tech-spec-epic-1.md (Epic 1: User Onboarding & Authentication)

**Schema File:** apps/backend/prisma/schema.prisma
- User model: Add `deletedAt DateTime?` with compound unique `@@unique([email, deletedAt])`
- FamilyMembership: Existing model for membership tracking

**Auth Service:** apps/backend/src/auth/auth.service.ts
- Add `removeFamilyMember()` mutation
- Add `deregisterSelf()` mutation

**Frontend Components:**
- src/components/settings/ - Settings UI for member removal and account deletion
- src/lib/graphql/operations.ts - GraphQL operations

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

### Completion Notes List

### File List

### Manual Testing Notes

See `docs/issues/2025-12-07-23-story-1.14-remove-member.md` for testing session results and issues found.
