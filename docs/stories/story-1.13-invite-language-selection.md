# Story 1.13: Invite Language Selection

Status: done

## Story

As a **family admin inviting someone who is not yet registered**,
I want **to specify their preferred UI language when creating the invite**,
so that **they receive the registration invite email in their native language rather than defaulting to English**.

## Context

Currently, when an admin invites an unregistered user via email-bound invite (Story 1.5), the registration invite email is always sent in English. This is jarring for non-English speaking recipients who may not understand the email content.

**User Flow:**
1. **Unregistered user invite:** Admin specifies invitee email + preferred language → Backend stores language preference → Registration email sent in specified language
2. **Already registered user invite:** Backend uses the user's existing `preferredLanguage` setting from their profile → No language selection needed in UI

This story enhances the invite flow from Story 1.5 to include language selection, leveraging the existing translation infrastructure from Story 5.4.

## Acceptance Criteria

**AC1: Language Selection in Invite UI (Unregistered Users)**
- [x] Email-bound invite dialog shows language selector dropdown
- [x] Language selector offers the same 20+ languages as Story 5.4 (en, ja, es, fr, de, zh, ko, pt, ru, ar, it, nl, pl, tr, vi, th, id, hi, sv, no)
- [x] Default selection is the inviter's current UI language
- [x] Language selection is clearly labeled (e.g., "Send invite email in")
- [x] Help text explains this sets the email language for the invite

**AC2: Backend - Store Language Preference with Invite**
- [x] `FamilyInvite` table extended with `inviteeLanguage` column (VARCHAR, default 'en')
- [x] `createInvite` GraphQL mutation accepts optional `inviteeLanguage` parameter
- [x] Language code validated against supported languages enum
- [x] Prisma migration generated and applied

**AC3: Registration Invite Email Uses Specified Language**
- [x] When sending registration invite email, backend reads `inviteeLanguage` from invite record
- [x] Email template rendered in the specified language
- [x] Email subject line translated to specified language
- [x] Email body content (welcome message, instructions, CTA button) translated

**AC4: Registered User Lookup (No UI Language Selection)**
- [x] When admin enters an email that belongs to an already-registered user:
  - Backend looks up user by email
  - Uses user's existing `preferredLanguage` from their profile
  - Sends invite notification in their preferred language
- [x] No language selector shown for already-registered users (backend handles automatically)

**AC5: Email Templates Support Multiple Languages**
- [x] Registration invite email template supports all 20+ languages
- [x] Translations stored in backend translation files or inline template logic
- [x] Fallback to English if specified language not available

**AC6: GraphQL API Updates**
- [x] `CreateInviteInput` type includes optional `inviteeLanguage: String`
- [x] `InviteResponse` type includes `inviteeLanguage` field
- [x] Validation rejects invalid language codes

**AC7: Set New User's Language Preference on Registration**
- [x] When unregistered user completes registration via invite:
  - Backend reads `inviteeLanguage` from the invite record
  - Sets new user's `preferences.preferredLanguage` to that value
- [x] User's first login experience uses their preferred language
- [x] Subsequent emails (verification, notifications) use this preference
- [x] If `inviteeLanguage` is null/missing, default to 'en'

## Tasks / Subtasks

### Task 1: Database Schema Update (AC2) ✅
- [x] **Subtask 1.1**: Add `inviteeLanguage` column to `FamilyInvite` model in Prisma schema (VARCHAR, default 'en')
- [x] **Subtask 1.2**: Generate Prisma migration: `pnpm prisma migrate dev --name add_invite_language`
- [x] **Subtask 1.3**: Apply migration to local database and verify schema

### Task 2: Backend - GraphQL API Updates (AC2, AC6) ✅
- [x] **Subtask 2.1**: Update `CreateInviteInput` DTO to include optional `inviteeLanguage` field
- [x] **Subtask 2.2**: Add language code validation (must be one of supported languages)
- [x] **Subtask 2.3**: Update `createInvite` method in `AuthService` to store `inviteeLanguage`
- [x] **Subtask 2.4**: Update `InviteResponse` type to include `inviteeLanguage` field
- [x] **Subtask 2.5**: Create SUPPORTED_LANGUAGES constant/enum for validation

### Task 3: Backend - Email Language Selection Logic (AC3, AC4) ✅
- [x] **Subtask 3.1**: Update `sendRegistrationInviteEmail` method to accept language parameter
- [x] **Subtask 3.2**: Implement email content translation based on language parameter
- [x] **Subtask 3.3**: Add logic to look up existing user's `preferredLanguage` when inviting registered users
- [x] **Subtask 3.4**: Use invitee's stored language preference (registered) or invite's `inviteeLanguage` (unregistered)

### Task 4: Backend - Email Template Translations (AC5) ✅
- [x] **Subtask 4.1**: Create email translation map for registration invite email (all 20+ languages)
- [x] **Subtask 4.2**: Translate email subject line for all languages
- [x] **Subtask 4.3**: Translate email body content (greeting, instructions, CTA)
- [x] **Subtask 4.4**: Implement fallback to English for unsupported languages
- [x] **Subtask 4.5**: Test email rendering in at least 3 languages (en, ja, es)

### Task 5: Frontend - Language Selector in Invite Dialog (AC1) ✅
- [x] **Subtask 5.1**: Add language dropdown to `EmailBoundInviteDialog` component
- [x] **Subtask 5.2**: Populate dropdown with 20+ supported languages (same list as Story 5.4)
- [x] **Subtask 5.3**: Default selection to inviter's current UI language from LanguageContext
- [x] **Subtask 5.4**: Add label and help text for language selector
- [x] **Subtask 5.5**: Pass selected language to `createInvite` mutation

### Task 6: Frontend - Update GraphQL Operations (AC6) ✅
- [x] **Subtask 6.1**: Update `CREATE_INVITE_MUTATION` to include `inviteeLanguage` variable
- [x] **Subtask 6.2**: Regenerate GraphQL types: `pnpm codegen`
- [x] **Subtask 6.3**: Update mutation call in `EmailBoundInviteDialog` to pass language

### Task 7: Frontend - Translation Keys (AC1) ✅
- [x] **Subtask 7.1**: Add translation keys for language selector label
- [x] **Subtask 7.2**: Add translation keys for help text
- [x] **Subtask 7.3**: Add language display names in both English and Japanese

### Task 8: Backend - Set User Preference on Registration (AC7) ✅
- [x] **Subtask 8.1**: Update `joinFamily` method to read `inviteeLanguage` from invite record
- [x] **Subtask 8.2**: Set new user's `preferences.preferredLanguage` from invite's `inviteeLanguage`
- [x] **Subtask 8.3**: Default to 'en' if `inviteeLanguage` is null/missing
- [x] **Subtask 8.4**: Ensure verification email uses the user's new `preferredLanguage`

### Task 9: Unit Tests (All ACs) ✅
- [x] **Subtask 9.1**: Test `createInvite` stores `inviteeLanguage` correctly
- [x] **Subtask 9.2**: Test language code validation (valid/invalid codes)
- [x] **Subtask 9.3**: Test email content translation function
- [x] **Subtask 9.4**: Test registered user language lookup logic
- [x] **Subtask 9.5**: Test fallback to English for unsupported language
- [x] **Subtask 9.6**: Test new user's `preferredLanguage` set from invite (AC7)

### Task 10: Integration Tests (All ACs) ✅
- [x] **Subtask 10.1**: Test full invite creation with language selection
- [x] **Subtask 10.2**: Test invite creation defaults to 'en' when no language specified
- [x] **Subtask 10.3**: Test email sent in correct language (mock email service)
- [x] **Subtask 10.4**: Test registered user invite uses their profile language
- [x] **Subtask 10.5**: Test new user registration sets `preferredLanguage` from invite (AC7)

### Task 11: E2E Tests (AC1, AC3, AC7) ✅
- [x] **Subtask 11.1**: Test language selector appears in invite dialog
- [x] **Subtask 11.2**: Test language selection changes invite mutation payload
- [x] **Subtask 11.3**: Test default language matches inviter's UI language
- [x] **Subtask 11.4**: Test new user's UI language matches invite language after registration

## Dev Notes

### Architecture Patterns & Constraints

**Language Code Standard:**
- Use ISO 639-1 codes (same as Story 5.4)
- Supported: en, ja, es, fr, de, zh, ko, pt, ru, ar, it, nl, pl, tr, vi, th, id, hi, sv, no
- Validation: Reject any code not in the supported list

**Email Translation Approach:**
- Option A: Inline translations in email service (simple, all in one place)
- Option B: Separate translation files for emails (more maintainable for many languages)
- Recommendation: Start with Option A, refactor if needed

**Registered vs Unregistered User Detection:**
- When `createInvite` is called, backend checks if email exists in `users` table
- If exists: Use user's `preferences.preferredLanguage` (ignore any passed `inviteeLanguage`)
- If not exists: Use passed `inviteeLanguage` (default to 'en' if not provided)

**Database Schema:**
```prisma
model FamilyInvite {
  // ... existing fields
  inviteeLanguage String @default("en") @db.VarChar(5)
}
```

**GraphQL Schema:**
```graphql
input CreateInviteInput {
  inviteeEmail: String!
  inviteeLanguage: String  # Optional, defaults to 'en'
}

type InviteResponse {
  inviteCode: String!
  inviteeEmail: String!
  inviteeLanguage: String!
  expiresAt: DateTime!
}
```

### Project Structure Notes

**Files to Create:**
- `apps/backend/src/email/templates/invite-email.translations.ts` - Email content translations

**Files to Modify:**
- `apps/backend/prisma/schema.prisma` - Add inviteeLanguage to FamilyInvite
- `apps/backend/src/auth/dto/create-invite.input.ts` - Add inviteeLanguage field
- `apps/backend/src/auth/types/invite.type.ts` - Add inviteeLanguage to response
- `apps/backend/src/auth/auth.service.ts` - Update createInvite logic
- `apps/backend/src/email/email.service.ts` - Add language parameter to email methods
- `src/components/family/email-bound-invite-dialog.tsx` - Add language selector
- `src/lib/graphql/operations.ts` - Update CREATE_INVITE_MUTATION
- `src/lib/translations.ts` - Add UI translation keys

### Dependencies

**This story depends on:**
- Story 1.5: Email-Bound Invite System (baseline invite flow)
- Story 1.6: Brevo Email Service Integration (email sending)
- Story 5.4: Customize Language Settings (language infrastructure)

**Related Stories:**
- Story 1.4: Email Verification (uses similar email infrastructure)

### References

- [Source: docs/tech-spec-epic-1.md] - Epic 1 technical specification
- [Source: docs/solution-architecture.md] - Backend patterns, GraphQL conventions, Prisma patterns
- [Source: docs/stories/1-5-email-bound-invites.md] - Email-bound invite baseline implementation
- [Source: docs/stories/story-5.4.md] - Language settings and translation infrastructure
- [ISO 639-1 Language Codes](https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes)

## Dev Agent Record

### Context Reference

- docs/stories/story-1.13-invite-language-selection.context.xml (Generated: 2025-11-29)

### Agent Model Used

claude-opus-4-5-20251101 (via Claude Code CLI)

### Debug Log References

N/A - No significant debugging issues encountered

### Completion Notes List

- All 11 tasks completed successfully
- 150 backend unit tests passing
- 32 new translation unit tests added
- E2E test suite created for invite language selection
- Email templates support 20 languages with proper fallback to English
- Language preference is automatically set for new users registering via invite

### File List

**Created:**
- `apps/backend/src/email/templates/invite-email.translations.ts` - Email translations for all 20 languages
- `apps/backend/src/email/templates/invite-email.translations.spec.ts` - Unit tests for translations
- `apps/backend/prisma/migrations/20251129132940_add_invite_language/migration.sql` - Database migration
- `src/components/settings/invite-language-selector.tsx` - Reusable language selector component
- `tests/e2e/invite-language-selection.spec.ts` - E2E test suite

**Modified:**
- `apps/backend/prisma/schema.prisma` - Added inviteeLanguage to FamilyInvite model
- `apps/backend/src/auth/dto/create-invite.input.ts` - Added inviteeLanguage field with validation
- `apps/backend/src/auth/types/invite.type.ts` - Added inviteeLanguage to InviteResponse
- `apps/backend/src/auth/auth.service.ts` - Updated createInvite and joinFamily methods
- `apps/backend/src/auth/auth.resolver.ts` - Updated resolver to pass inviteeLanguage
- `apps/backend/src/email/email.service.ts` - Added language parameter to email methods
- `apps/backend/src/email/email.service.spec.ts` - Added language parameter tests
- `src/components/family/email-bound-invite-dialog.tsx` - Added language selector UI
- `src/lib/graphql/operations.ts` - Updated CREATE_INVITE_MUTATION
- `src/lib/translations.ts` - Added UI translation keys for language selector

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-11-29 | Initial draft created | Bob (SM Agent) |
| 2025-11-29 | Added AC7: Set user's preferredLanguage on registration | Bob (SM Agent) |
| 2025-11-29 | Implementation completed - all tasks and ACs satisfied | Amelia (Dev Agent) |
