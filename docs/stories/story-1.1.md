# Story 1.1: Create Family Account

Status: Approved

## Story

As a family admin,
I want to create a family account,
so that I can invite my family members.

## Acceptance Criteria

1. **AC1:** Admin provides family name, email, password, and their name via registration form
2. **AC2:** System generates unique invite code with embedded family encryption key (format: `FAMILY-XXXX:BASE64KEY`)
3. **AC3:** Admin receives success confirmation with invite code displayed for sharing
4. **AC4:** Admin is automatically logged in and redirected to chat screen
5. **AC5:** Family record is created in database with generated invite code
6. **AC6:** Admin user record is created with role='admin' and encrypted family key stored

## Tasks / Subtasks

- [ ] Implement database migration for users and families tables (AC: #5, #6)
  - [ ] Create families table with invite_code column
  - [ ] Create users table with role and encrypted_family_key columns
  - [ ] Implement RLS policies for both tables
  - [ ] Create database indexes for performance

- [ ] Implement POST /api/auth/register API route (AC: #1, #2, #5, #6)
  - [ ] Create Zod validation schema (registerSchema)
  - [ ] Validate input (email, password min 8 chars, family name, user name)
  - [ ] Check email not already registered (return 409 if duplicate)
  - [ ] Generate family encryption key using Epic 7 `generateFamilyKey()`
  - [ ] Generate unique invite code (format: FAMILY-XXXX using nanoid)
  - [ ] Hash password with bcrypt (10 rounds)
  - [ ] Create family record in database
  - [ ] Create admin user record with encrypted_family_key
  - [ ] Initialize Supabase Auth session
  - [ ] Return response with user, family, and invite code
  - [ ] Implement rate limiting (5 requests/hour per IP)

- [ ] Implement CreateForm component (AC: #1, #3)
  - [ ] Create `components/auth/create-form.tsx`
  - [ ] Implement React Hook Form with Zod validation
  - [ ] Add form fields: userName, email, password, familyName
  - [ ] Add inline validation error messages
  - [ ] Call POST /api/auth/register on submit
  - [ ] Display success toast with invite code on completion
  - [ ] Handle error states (network failures, validation errors, server errors)

- [ ] Implement Login screen with tabs (AC: #4)
  - [ ] Create `app/(auth)/login/page.tsx`
  - [ ] Implement tabbed interface (Login, Create Family, Join Family)
  - [ ] Integrate CreateForm component in "Create Family" tab
  - [ ] Handle successful registration: store family key, redirect to /chat
  - [ ] Call `initializeFamilyKey()` from Epic 7 to store key in IndexedDB

- [ ] Implement invite code generation utilities (AC: #2)
  - [ ] Create `lib/auth/invite-codes.ts`
  - [ ] Implement `generateInviteCode()` using nanoid
  - [ ] Implement `validateInviteCodeFormat()` regex checker
  - [ ] Write unit tests for invite code generation and validation

- [ ] Write unit tests for registration logic (AC: All)
  - [ ] Test Zod schema validation (valid/invalid inputs)
  - [ ] Test invite code format generation
  - [ ] Test duplicate email handling
  - [ ] Test password hashing
  - [ ] Achieve 95% code coverage for auth utilities

- [ ] Write integration tests for registration flow (AC: All)
  - [ ] Test full registration API flow (create family + admin user)
  - [ ] Verify invite code format in response
  - [ ] Verify database records created correctly
  - [ ] Verify encrypted_family_key stored in user record
  - [ ] Test error cases (duplicate email, validation failures)

- [ ] Write E2E tests for user experience (AC: #1, #3, #4)
  - [ ] Test creating family via UI (fill form, submit)
  - [ ] Verify success toast displays with invite code
  - [ ] Verify redirect to /chat after registration
  - [ ] Verify family name visible in chat UI
  - [ ] Test form validation error messages display correctly

## Dev Notes

### Architecture Patterns and Constraints

**API Design:**
- RESTful endpoint: `POST /api/auth/register`
- Input validation: Zod schemas on both client and server
- Error responses follow standard format: `{ success: false, error: { code, message, details } }`
- Rate limiting via middleware to prevent spam registrations

**Database Schema:**
- `families` table stores invite codes with unique constraint
- `users` table has foreign key to families with CASCADE delete
- RLS policies ensure users can only read their own family data
- Indexes on `users.email` and `families.invite_code` for performance

**E2EE Integration:**
- Family key generation delegated to Epic 7 (`generateFamilyKey()`)
- Key stored as base64 in `users.encrypted_family_key`
- Invite code format embeds key: `FAMILY-XXXX:BASE64KEY`
- Client stores key in IndexedDB after successful registration

**Security Measures:**
- Password hashing: bcrypt with 10 rounds (OWASP standard)
- Rate limiting: 5 requests/hour per IP (prevent brute force)
- CSRF protection: SameSite=Strict cookies
- Input validation: Server-side validation mandatory (client-side for UX only)

**Component Architecture:**
- Login screen uses Tabs component (shadcn/ui)
- CreateForm is reusable standalone component
- React Hook Form + Zod for form state management
- Toast notifications via Sonner library

### Project Structure Notes

**Alignment with unified project structure:**

Files to create:
- `src/app/(auth)/login/page.tsx` - Login screen with tabs
- `src/components/auth/create-form.tsx` - Family creation form
- `src/app/api/auth/register/route.ts` - Registration API endpoint
- `src/lib/auth/invite-codes.ts` - Invite code utilities
- `src/lib/validators/auth.ts` - Zod validation schemas
- `supabase/migrations/001_auth_schema.sql` - Database migration

Dependencies on Epic 7:
- `lib/e2ee/key-management.ts`: `generateFamilyKey()`, `initializeFamilyKey()`

Testing files:
- `tests/unit/auth/invite-codes.test.ts`
- `tests/unit/auth/validation.test.ts`
- `tests/integration/auth/register-flow.test.ts`
- `tests/e2e/auth/onboarding.spec.ts`

**Detected conflicts or variances:** None. Follows established patterns from solution architecture.

### References

- [Source: docs/tech-spec-epic-1.md#3.2 API Contracts]
- [Source: docs/tech-spec-epic-1.md#3.3 Component Implementation Guide]
- [Source: docs/solution-architecture.md#3 Database Schema]
- [Source: docs/solution-architecture.md#5 End-to-End Encryption Implementation]
- [Source: docs/epic-alignment-matrix.md#Epic 1 Row]

## Dev Agent Record

### Context Reference

- `/Users/usr0101345/projects/ourchat/docs/stories/story-context-1.1.xml` (Generated: 2025-10-13)

### Agent Model Used

claude-sonnet-4-5-20250929

### Debug Log References

### Completion Notes List

### File List
