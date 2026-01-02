# Story 1.15: Admin Role Transfer & Family Deletion

Status: draft

## Story

As a **family admin who is the only admin**,
I want **to either promote another member to admin OR delete the family**,
so that **the family isn't left orphaned without an admin**.

## Context

When a family's only admin wants to delete their account (Story 1.14), they have three scenarios:

1. **Family has other members**: Admin must either promote someone OR delete the family
2. **Admin is only member**: Admin can delete themselves and family is auto-deleted
3. **Family has multiple admins**: Admin can freely delete themselves

This story ensures families are never orphaned by giving the last admin a clear choice.

### Why Promotion Is Simple

Members who joined via invite code already have the family encryption key in their IndexedDB (embedded in the invite code per Story 1.8). Therefore:
- No encrypted transfer tokens needed
- No accept/reject flow required
- Just update the role in the database
- New admin immediately has full capabilities

## Acceptance Criteria

### Part A: Last Admin Scenarios

1. **AC1: Last Admin with Members** — If admin is the only admin but family has other members:
   - Show choice: "Promote a member to admin" OR "Delete family"
   - Cannot delete account until one option is chosen

2. **AC2: Solo Admin (No Other Members)** — If admin is the only member of the family:
   - Allow self-deletion
   - Automatically soft-delete the family

3. **AC3: Multi-Admin Family** — If family has 2+ admins:
   - Allow self-deletion without restrictions
   - Family continues with remaining admin(s)

### Part B: Promote to Admin

4. **AC4: Promote UI** — Admin sees "Promote to Admin" option next to each non-admin member
5. **AC5: Confirmation** — Modal: "Promote [Name] to admin? They will be able to manage members and invites."
6. **AC6: Backend Mutation** — `promoteToAdmin(userId, familyId)` updates member's role to ADMIN
7. **AC7: Immediate Effect** — New admin can immediately use admin features
8. **AC8: Multiple Admins** — Family can have multiple admins (no limit)

### Part C: Delete Family

9. **AC9: Delete Family Option** — When last admin tries to delete account, show "Delete Family" option
10. **AC10: Delete Confirmation** — Modal: "Delete [Family Name]? All members will be removed. Messages will be preserved but the family will no longer be accessible."
11. **AC11: Family Soft Delete** — Add `deletedAt` to Family model, set on deletion
12. **AC12: Cascade Effects** — When family is soft-deleted:
    - Remove all member associations (delete FamilyMembership records)
    - Clear `activeFamilyId` for all affected users
    - Preserve messages/photos with family attribution
13. **AC13: After Family Delete** — Admin can now delete their account (no longer sole admin of any family)

### Part D: Admin Constraints

14. **AC14: No Demotion** — Admins cannot demote other admins
15. **AC15: Self-Demotion** — Admin can demote themselves if family has other admins

## Tasks / Subtasks

### Part A: Backend - Last Admin Logic

- [ ] Task 1: Analyze Admin Status (AC: 1, 2, 3)
  - [ ] 1.1: Create helper `getAdminStatus(userId)` that returns for each family:
    - `isOnlyAdmin`: boolean
    - `hasOtherMembers`: boolean
    - `familyId`, `familyName`
  - [ ] 1.2: Modify `deregisterSelf` to check admin status before proceeding
  - [ ] 1.3: Return structured error with family details if action needed

### Part B: Backend - Promote Mutation

- [ ] Task 2: Promote to Admin (AC: 6, 7)
  - [ ] 2.1: Add `promoteToAdmin(userId: String!, familyId: String!)` mutation
  - [ ] 2.2: Verify caller is admin of the family
  - [ ] 2.3: Verify target is a member (not already admin)
  - [ ] 2.4: Update target's role from MEMBER to ADMIN
  - [ ] 2.5: Return success with updated member info

### Part C: Backend - Delete Family

- [ ] Task 3: Schema Update (AC: 11)
  - [ ] 3.1: Add `deletedAt DateTime?` to Family model
  - [ ] 3.2: Add partial unique index on `inviteCode` WHERE `deletedAt IS NULL`
  - [ ] 3.3: Run migration

- [ ] Task 4: Delete Family Mutation (AC: 11, 12)
  - [ ] 4.1: Add `deleteFamily(familyId: String!)` mutation
  - [ ] 4.2: Verify caller is admin of the family
  - [ ] 4.3: Set `deletedAt = NOW()` on family
  - [ ] 4.4: Delete all FamilyMembership records for this family
  - [ ] 4.5: Clear `activeFamilyId` for affected users
  - [ ] 4.6: Return success message

- [ ] Task 5: Auto-Delete Empty Family (AC: 2)
  - [ ] 5.1: In `deregisterSelf`, if user is only member of a family, auto-delete that family
  - [ ] 5.2: Log family deletion for audit

### Part D: Frontend - Delete Account Flow

- [ ] Task 6: Enhanced Delete Account Modal (AC: 1, 9, 10)
  - [ ] 6.1: Check admin status before showing delete confirmation
  - [ ] 6.2: If last admin with members, show choice modal:
    - "You are the only admin of [Family]. Choose an option:"
    - Option 1: "Promote a member to admin" → navigate to family settings
    - Option 2: "Delete family and my account" → confirm and proceed
  - [ ] 6.3: If solo admin (no members), proceed with deletion (auto-deletes family)
  - [ ] 6.4: If multi-admin, proceed normally

### Part E: Frontend - Promote UI

- [ ] Task 7: Member List Promote Action (AC: 4, 5)
  - [ ] 7.1: Add "Promote to Admin" dropdown item for non-admin members
  - [ ] 7.2: Show confirmation dialog
  - [ ] 7.3: Call mutation and show success toast
  - [ ] 7.4: Update UI to show admin badge

- [ ] Task 8: Admin Badge Display (AC: 8, 14)
  - [ ] 8.1: Show "Admin" badge next to admin members
  - [ ] 8.2: Hide "Remove" and "Promote" for admin members
  - [ ] 8.3: Show member count with admin count: "3 members (2 admins)"

### Testing

- [ ] Task 9: E2E Tests
  - [ ] 9.1: Last admin with members sees choice modal
  - [ ] 9.2: Promoting member allows admin to delete account
  - [ ] 9.3: Deleting family allows admin to delete account
  - [ ] 9.4: Solo admin deletion auto-deletes family
  - [ ] 9.5: Multi-admin family allows free deletion
  - [ ] 9.6: Deleted family not visible to former members

## Dev Notes

### Decision Tree for Self-Deletion

```
User wants to delete account
    │
    ├─► For each family where user is ADMIN:
    │       │
    │       ├─► Has other admins?
    │       │       YES → OK, skip this family
    │       │       NO  → Continue checking...
    │       │
    │       └─► Has other members?
    │               YES → BLOCK: Must promote or delete family
    │               NO  → AUTO-DELETE family, then continue
    │
    └─► All families resolved? → Proceed with account deletion
```

### GraphQL Schema Additions

```graphql
type Mutation {
  promoteToAdmin(userId: String!, familyId: String!): MutationResponse!
  deleteFamily(familyId: String!): MutationResponse!
}

type AdminStatusResponse {
  canDelete: Boolean!
  blockingFamilies: [BlockingFamily!]!
}

type BlockingFamily {
  familyId: String!
  familyName: String!
  memberCount: Int!
  requiresAction: Boolean!  # true if must promote or delete
}
```

### Family Soft Delete Schema

```prisma
model Family {
  id          String    @id @default(uuid())
  name        String
  inviteCode  String
  deletedAt   DateTime?
  // ... other fields

  @@unique([inviteCode, deletedAt]) // Allow reuse of invite codes after deletion
}
```

### Security Considerations

1. **Only admins can delete family**: Verified in mutation
2. **Cascade is atomic**: All membership deletions in single transaction
3. **Preserved content**: Messages/photos remain with "Deleted Family" context
4. **Audit trail**: `deletedAt` timestamp for compliance

## Related Stories

- Story 1.14: Remove Family Member & Self De-registration
- Story 1.8: Family Invite Flow (members get family key via invite)
