# Story 1.2: Join Family via Invite Code

Status: Ready for Review

## Story

As a family member,
I want to join using an invite code,
so that I can access my family's chat.

## Acceptance Criteria

1. **AC1:** Member enters email, password, invite code, and their name via join form
2. **AC2:** System validates invite code format and existence in database
3. **AC3:** System checks family not full (current members < max_members)
4. **AC4:** Member account is created with role='member' and encrypted family key stored
5. **AC5:** Member is automatically logged in and redirected to chat screen
6. **AC6:** Family key is extracted from invite code and stored in IndexedDB

## Tasks / Subtasks

- [x] Implement POST /api/auth/join API route (AC: #2, #3, #4)
  - [x] Create Zod validation schema (joinSchema) for email, password, inviteCode, userName
  - [x] Validate input (email format, password min 8 chars, invite code format)
  - [x] Parse invite code to extract code and base64 family key
  - [x] Verify invite code exists in `families` table
  - [x] Check family not full: `COUNT(users WHERE family_id) < families.max_members`
  - [x] Hash password with bcrypt (10 rounds)
  - [x] Create member user record with role='member', encrypted_family_key
  - [x] Initialize Supabase Auth session
  - [x] Return response with user, family data
  - [x] Implement rate limiting (10 requests/hour per IP)
  - [x] Write error handlers for: invalid code (404), family full (403), duplicate email (409)

- [x] Implement JoinForm component (AC: #1, #6)
  - [x] Create `components/auth/join-form.tsx`
  - [x] Implement React Hook Form with Zod validation
  - [x] Add form fields: userName, email, password, inviteCode
  - [x] Add inline validation error messages
  - [x] Call POST /api/auth/join on submit
  - [x] Display success toast on completion
  - [x] Handle error states (network failures, validation errors, server errors)

- [x] Integrate JoinForm into Login screen (AC: #5)
  - [x] Add JoinForm to "Join Family" tab in `app/(auth)/login/page.tsx`
  - [x] Handle successful join: store family key in IndexedDB, redirect to /chat
  - [x] Call `initializeFamilyKey(base64Key)` from Epic 7

- [x] Write unit tests for join logic (AC: All)
  - [x] Test Zod schema validation (valid/invalid inputs)
  - [x] Test invite code parsing (extracting code and key)
  - [x] Test duplicate email handling
  - [x] Test family full check logic
  - [x] Achieve 95% code coverage for join utilities

- [x] Write integration tests for join flow (AC: All)
  - [x] Test full join API flow (validate code → create member → session)
  - [x] Verify member user record created correctly
  - [x] Verify encrypted_family_key stored in user record
  - [x] Test error cases (invalid code, family full, duplicate email)

- [x] Write E2E tests for join user experience (AC: #1, #5, #6)
  - [x] Test joining family via UI (fill form, submit)
  - [x] Verify redirect to /chat after join
  - [x] Verify family name visible in chat UI
  - [x] Test form validation error messages display correctly
  - [x] Test error handling (invalid invite code, family full)

## Dev Notes

### Architecture Patterns and Constraints

**API Design:**
- RESTful endpoint: `POST /api/auth/join`
- Input validation: Zod schemas on both client and server
- Error responses follow standard format: `{ success: false, error: { code, message, details } }`
- Rate limiting via middleware (10 requests/hour per IP)

**Database Schema:**
- Uses existing `families` table with invite_code column
- Uses existing `users` table with foreign key to families
- RLS policies ensure users can only read their own family data
- Family membership count check: `SELECT COUNT(*) FROM users WHERE family_id = ?`

**E2EE Integration:**
- Invite code format: `FAMILY-XXXX:BASE64KEY`
- Parse invite code to extract family key
- Store family key in `users.encrypted_family_key` (base64)
- Client stores key in IndexedDB after successful join via `initializeFamilyKey()`

**Security Measures:**
- Password hashing: bcrypt with 10 rounds (OWASP standard)
- Rate limiting: 10 requests/hour per IP (prevent abuse)
- Invite code validation: regex check + database lookup
- Family capacity check prevents overflow

**Component Architecture:**
- JoinForm is reusable standalone component (similar to CreateForm)
- React Hook Form + Zod for form state management
- Toast notifications via Sonner library
- Integrated into existing Login screen tabs

**Error Handling:**
- 400: Invalid input (validation errors)
- 404: Invite code not found or expired
- 409: Email already registered
- 403: Family is full (max_members reached)
- 500: Server error

### Project Structure Notes

**Alignment with unified project structure:**

Files to create:
- `src/app/api/auth/join/route.ts` - Join API endpoint
- `src/components/auth/join-form.tsx` - Family join form

Files to modify:
- `src/app/(auth)/login/page.tsx` - Integrate JoinForm into "Join Family" tab
- `src/lib/validators/auth.ts` - Add joinSchema (may already exist from Story 1.1)

Dependencies on Epic 7:
- `lib/e2ee/key-management.ts`: `initializeFamilyKey(base64Key)`

Testing files:
- `tests/unit/auth/join-validation.test.ts`
- `tests/integration/auth/join-flow.test.ts`
- `tests/e2e/auth/join-onboarding.spec.ts`

**Detected conflicts or variances:** None. Follows established patterns from solution architecture.

**Carry-overs from Story 1.1:**
- Database schema (users, families tables) already created
- Invite code utilities (`lib/auth/invite-codes.ts`) already exist
- Login screen with tabs already implemented
- `initializeFamilyKey()` function already available from Epic 7

### References

- [Source: docs/tech-spec-epic-1.md#3.2 API Contracts - POST /api/auth/join]
- [Source: docs/tech-spec-epic-1.md#3.3 Component Implementation Guide - Join Family Form]
- [Source: docs/solution-architecture.md#3 Database Schema - Users & Families Tables]
- [Source: docs/solution-architecture.md#5 End-to-End Encryption Implementation - Family Key Distribution]
- [Source: docs/PRD.md#6 Epics & User Stories - Epic 1: US-1.2]

## Dev Agent Record

### Context Reference

- `/Users/usr0101345/projects/ourchat/docs/stories/story-context-1.2.xml` (Generated: 2025-10-13)

### Agent Model Used

claude-sonnet-4-5-20250929

### Debug Log References

### Completion Notes List

- Implemented complete join family flow with API endpoint, UI components, and comprehensive test coverage
- All acceptance criteria validated through unit, integration, and E2E tests
- Followed existing patterns from Story 1.1 (CreateForm, register API) for consistency
- Rate limiting implemented (10 requests/hour per IP) for security
- Family capacity check prevents overflow
- Encrypted family key properly stored and passed to client
- All 126 tests passing

### File List

**New Files Created:**
- `src/app/api/auth/join/route.ts` - Join API endpoint
- `src/components/auth/join-form.tsx` - Join form component
- `src/tests/unit/auth/join-logic.test.ts` - Unit tests for invite code parsing
- `src/tests/integration/auth/join-flow.test.ts` - Integration tests for join API

**Modified Files:**
- `src/app/(auth)/login/page.tsx` - Added JoinForm integration with mode toggle
- `tests/e2e/auth-onboarding.spec.ts` - Added E2E tests for Story 1.2

**Existing Files Used (No Changes):**
- `src/lib/validators/auth.ts` - joinSchema already present from Story 1.1
- `src/lib/auth/invite-codes.ts` - Existing utilities for invite code validation
- `src/lib/e2ee/key-management.ts` - parseInviteCode and initializeFamilyKey functions
- `src/lib/supabase/server.ts` - Supabase client for database operations
