# Tech Spec: Epic 1 - User Onboarding & Authentication

> **⚠️ Architecture Change (2025-10-18):** This spec was written for Supabase + Next.js API routes architecture.
> **Current implementation uses NestJS + GraphQL + MySQL (Prisma).** See `docs/solution-architecture.md` v2.0 for current stack.
> API contracts and implementation details below are **for reference only** - actual implementation uses GraphQL mutations.

**Epic ID:** Epic 1
**Priority:** Critical (MVP Blocker)
**Story Points:** 8
**Estimated Duration:** 1.5 weeks
**Dependencies:** Epic 7 (E2EE Infrastructure)

---

## 1. Epic Overview

User onboarding and authentication is the gateway to OurChat. Family admins create new families and receive invite codes embedded with family encryption keys. Family members join using invite codes, seamlessly receiving encryption keys without manual intervention. Sessions persist across browser restarts for convenience while maintaining security.

**User Stories:**

- **US-1.1:** As a family admin, I want to create a family account so that I can invite my family members
  - **AC1:** Admin provides family name, email, and password
  - **AC2:** System generates unique invite code with embedded family key
  - **AC3:** Admin receives confirmation with invite code to share

- **US-1.2:** As a family member, I want to join using an invite code so that I can access my family's chat
  - **AC1:** Member enters email + invite code
  - **AC2:** System validates code and creates account
  - **AC3:** Member redirected to chat screen with encryption key loaded

- **US-1.3:** As a user, I want my session to persist so that I don't have to log in every time
  - **AC1:** Session tokens stored securely in browser
  - **AC2:** Auto-login on app revisit (if session valid)
  - **AC3:** Logout clears session and encryption keys

---

## 2. Architecture Components

### 2.1 Frontend Components

| Component | Location | Purpose |
|-----------|----------|---------|
| **Login Screen** | `app/(auth)/login/page.tsx` | Login/register UI |
| **Join Form** | `components/auth/join-form.tsx` | Family join flow |
| **Create Form** | `components/auth/create-form.tsx` | Family creation flow |
| **Auth Layout** | `app/(auth)/layout.tsx` | Auth pages layout (centered, no nav) |

### 2.2 Backend API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `POST /api/auth/register` | POST | Create family admin account |
| `POST /api/auth/join` | POST | Join existing family |
| `POST /api/auth/logout` | POST | Clear session |
| `GET /api/auth/session` | GET | Validate current session |
| `POST /api/auth/login` | POST | Login existing user |

### 2.3 Database Tables

```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  avatar TEXT, -- URL or base64 data URI
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'member')),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ,
  encrypted_family_key TEXT NOT NULL, -- Family key (base64)
  preferences JSONB DEFAULT '{}',
  google_calendar_token TEXT,
  google_calendar_connected BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_family_id ON users(family_id);
CREATE INDEX idx_users_email ON users(email);

-- Families table
CREATE TABLE families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  avatar TEXT,
  invite_code VARCHAR(50) UNIQUE NOT NULL, -- Format: FAMILY-XXXX-YYYY
  max_members INTEGER DEFAULT 10,
  created_by UUID NOT NULL, -- user_id
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_families_invite_code ON families(invite_code);
```

### 2.4 Libraries & Services

| Library | Version | Purpose |
|---------|---------|---------|
| **Supabase Auth** | Latest | JWT authentication, session management |
| **bcrypt** | 5.1.x | Password hashing (server-side) |
| **zod** | 3.x | Input validation |
| **React Hook Form** | 7.55.x | Form state management |
| **idb** | 8.x | IndexedDB key storage |

---

## 3. Implementation Details

### 3.1 Database Schema (Detailed)

#### Users Table with RLS

```sql
-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only read their own data and family members' data
CREATE POLICY "Users can read their family members"
  ON users FOR SELECT
  USING (
    family_id = (SELECT family_id FROM users WHERE id = auth.uid())
  );

-- Policy: Users can only update their own data
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

#### Families Table with RLS

```sql
ALTER TABLE families ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own family
CREATE POLICY "Users can read their family"
  ON families FOR SELECT
  USING (
    id = (SELECT family_id FROM users WHERE id = auth.uid())
  );

-- Policy: Only family admin can update family
CREATE POLICY "Admin can update family"
  ON families FOR UPDATE
  USING (
    created_by = auth.uid() OR
    id IN (SELECT family_id FROM users WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    created_by = auth.uid() OR
    id IN (SELECT family_id FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE TRIGGER update_families_updated_at
  BEFORE UPDATE ON families
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### 3.2 API Contracts

#### POST /api/auth/register

**Authentication:** None (public endpoint)

**Request Schema (Zod):**
```typescript
import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  familyName: z.string().min(2, 'Family name must be at least 2 characters').max(50),
  userName: z.string().min(2, 'Name must be at least 2 characters').max(50),
});

export type RegisterInput = z.infer<typeof registerSchema>;
```

**Response Schema:**
```typescript
type RegisterResponse = {
  success: true;
  user: {
    id: string;
    email: string;
    name: string;
    role: 'admin';
    familyId: string;
  };
  family: {
    id: string;
    name: string;
    inviteCode: string; // Format: FAMILY-XXXX:BASE64KEY
  };
  session: {
    accessToken: string;
    refreshToken: string;
  };
};
```

**Error Responses:**
- 400: Invalid input (email format, password too short)
- 409: Email already registered
- 500: Server error (database failure, key generation failure)

**Rate Limiting:** 5 requests per hour per IP (prevent spam registrations)

**Implementation Logic:**
1. Validate input with Zod
2. Check email not already registered
3. Generate family key (call `generateFamilyKey()` from Epic 7)
4. Hash password with bcrypt
5. Generate unique invite code (format: `FAMILY-XXXX`)
6. Create family record in database
7. Create admin user record (store `encrypted_family_key` as base64)
8. Return invite code with embedded key (format: `FAMILY-XXXX:BASE64KEY`)
9. Initialize Supabase Auth session

---

#### POST /api/auth/join

**Authentication:** None (public endpoint)

**Request Schema (Zod):**
```typescript
export const joinSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  inviteCode: z.string().regex(/^FAMILY-[A-Z0-9]{4,8}:[A-Za-z0-9+/=]+$/, 'Invalid invite code format'),
  userName: z.string().min(2, 'Name must be at least 2 characters').max(50),
});

export type JoinInput = z.infer<typeof joinSchema>;
```

**Response Schema:**
```typescript
type JoinResponse = {
  success: true;
  user: {
    id: string;
    email: string;
    name: string;
    role: 'member';
    familyId: string;
  };
  family: {
    id: string;
    name: string;
  };
  session: {
    accessToken: string;
    refreshToken: string;
  };
};
```

**Error Responses:**
- 400: Invalid input (email format, invite code format)
- 404: Invite code not found or expired
- 409: Email already registered
- 403: Family is full (max_members reached)
- 500: Server error

**Rate Limiting:** 10 requests per hour per IP

**Implementation Logic:**
1. Validate input with Zod
2. Parse invite code (extract code and base64 key)
3. Verify invite code exists in `families` table
4. Check family not full (`COUNT(users) < max_members`)
5. Hash password with bcrypt
6. Create member user record (store `encrypted_family_key`)
7. Initialize Supabase Auth session
8. Store family key in IndexedDB (client-side)

---

#### POST /api/auth/login

**Authentication:** None (public endpoint)

**Request Schema (Zod):**
```typescript
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;
```

**Response Schema:**
```typescript
type LoginResponse = {
  success: true;
  user: {
    id: string;
    email: string;
    name: string;
    role: 'admin' | 'member';
    familyId: string;
    encryptedFamilyKey: string; // Base64 key for client storage
  };
  family: {
    id: string;
    name: string;
  };
  session: {
    accessToken: string;
    refreshToken: string;
  };
};
```

**Error Responses:**
- 400: Invalid input
- 401: Invalid credentials (email or password wrong)
- 500: Server error

**Rate Limiting:** 5 requests per 15 minutes per IP (prevent brute force)

**Implementation Logic:**
1. Validate input with Zod
2. Look up user by email
3. Verify password with bcrypt
4. Create Supabase Auth session
5. Return user data with `encryptedFamilyKey` (client stores in IndexedDB)

---

#### POST /api/auth/logout

**Authentication:** Required (JWT token)

**Request Schema:** None (empty body)

**Response Schema:**
```typescript
type LogoutResponse = {
  success: true;
};
```

**Error Responses:**
- 401: Not authenticated
- 500: Server error

**Rate Limiting:** None

**Implementation Logic:**
1. Verify JWT token
2. Invalidate Supabase Auth session
3. Clear HTTP-only cookies
4. Client clears IndexedDB keys (handled in client-side hook)

---

#### GET /api/auth/session

**Authentication:** Required (JWT token)

**Request Schema:** None (query params only)

**Response Schema:**
```typescript
type SessionResponse = {
  user: {
    id: string;
    email: string;
    name: string;
    role: 'admin' | 'member';
    familyId: string;
  };
  family: {
    id: string;
    name: string;
    avatar: string | null;
  };
} | null;
```

**Error Responses:**
- 401: Invalid or expired session
- 500: Server error

**Rate Limiting:** None (called frequently by client)

**Implementation Logic:**
1. Verify JWT token
2. Look up user and family data
3. Update `users.last_seen_at`
4. Return user and family info

---

### 3.3 Component Implementation Guide

#### Component: Login Screen

**File:** `app/(auth)/login/page.tsx`

**Props:** None (page component)

**State Management:**
```typescript
import { useState } from 'react';

type AuthMode = 'login' | 'create' | 'join';

const [authMode, setAuthMode] = useState<AuthMode>('login');
```

**Key Functions:**
- `handleLogin(email, password)` - Call POST /api/auth/login
- `handleCreate(email, password, familyName, userName)` - Call POST /api/auth/register
- `handleJoin(email, password, inviteCode, userName)` - Call POST /api/auth/join
- `storeSessionAndRedirect(response)` - Store JWT, load family key, redirect to /chat

**Integration Points:**
- API: `/api/auth/login`, `/api/auth/register`, `/api/auth/join`
- Hooks: `useAuth()` (custom hook for auth state)
- E2EE: `initializeFamilyKey(base64Key)` (Epic 7)
- Router: `router.push('/chat')` (Next.js App Router)

**Component Structure:**
```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LoginForm } from '@/components/auth/login-form';
import { CreateForm } from '@/components/auth/create-form';
import { JoinForm } from '@/components/auth/join-form';
import { initializeFamilyKey } from '@/lib/e2ee/key-management';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLoginSuccess = async (response: LoginResponse) => {
    try {
      // Store family key in IndexedDB
      await initializeFamilyKey(response.user.encryptedFamilyKey);

      // Redirect to chat
      router.push('/chat');
    } catch (error) {
      console.error('Failed to initialize session:', error);
      toast.error('Failed to initialize encryption. Please try again.');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-8 px-4">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Welcome to OurChat</h1>
          <p className="text-muted-foreground mt-2">
            Private family communication
          </p>
        </div>

        <Tabs defaultValue="login">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="create">Create Family</TabsTrigger>
            <TabsTrigger value="join">Join Family</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <LoginForm onSuccess={handleLoginSuccess} loading={loading} />
          </TabsContent>

          <TabsContent value="create">
            <CreateForm onSuccess={handleLoginSuccess} loading={loading} />
          </TabsContent>

          <TabsContent value="join">
            <JoinForm onSuccess={handleLoginSuccess} loading={loading} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
```

---

#### Component: Create Family Form

**File:** `components/auth/create-form.tsx`

**Props:**
```typescript
interface CreateFormProps {
  onSuccess: (response: RegisterResponse) => void;
  loading: boolean;
}
```

**State Management:** React Hook Form

**Key Functions:**
- `onSubmit(data)` - Validate and submit form
- `handleRegister(data)` - Call POST /api/auth/register
- `copyInviteCode()` - Copy invite code to clipboard

**Implementation:**
```tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, type RegisterInput } from '@/lib/validators/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export function CreateForm({ onSuccess, loading }: CreateFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterInput) => {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Registration failed');
      }

      const result: RegisterResponse = await response.json();

      // Show invite code to admin
      toast.success(
        `Family created! Share this invite code: ${result.family.inviteCode}`,
        { duration: 10000 }
      );

      onSuccess(result);
    } catch (error) {
      toast.error(error.message || 'Failed to create family');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="userName">Your Name</Label>
        <Input
          id="userName"
          {...register('userName')}
          placeholder="John Doe"
          disabled={isSubmitting || loading}
        />
        {errors.userName && (
          <p className="text-sm text-destructive mt-1">{errors.userName.message}</p>
        )}
      </div>

      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          {...register('email')}
          placeholder="john@example.com"
          disabled={isSubmitting || loading}
        />
        {errors.email && (
          <p className="text-sm text-destructive mt-1">{errors.email.message}</p>
        )}
      </div>

      <div>
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          {...register('password')}
          placeholder="At least 8 characters"
          disabled={isSubmitting || loading}
        />
        {errors.password && (
          <p className="text-sm text-destructive mt-1">{errors.password.message}</p>
        )}
      </div>

      <div>
        <Label htmlFor="familyName">Family Name</Label>
        <Input
          id="familyName"
          {...register('familyName')}
          placeholder="The Smiths"
          disabled={isSubmitting || loading}
        />
        {errors.familyName && (
          <p className="text-sm text-destructive mt-1">{errors.familyName.message}</p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting || loading}>
        {isSubmitting ? 'Creating Family...' : 'Create Family'}
      </Button>
    </form>
  );
}
```

---

#### Component: Join Family Form

**File:** `components/auth/join-form.tsx`

**Props:**
```typescript
interface JoinFormProps {
  onSuccess: (response: JoinResponse) => void;
  loading: boolean;
}
```

**State Management:** React Hook Form

**Key Functions:**
- `onSubmit(data)` - Validate and submit form
- `handleJoin(data)` - Call POST /api/auth/join
- `parseInviteCode(code)` - Validate invite code format

**Implementation:** Similar to CreateForm, but with `inviteCode` field instead of `familyName`.

---

### 3.4 Business Logic (lib/)

#### Module: Auth Utilities

**File:** `lib/auth/session.ts`

**Exports:**
```typescript
export async function createSession(userId: string): Promise<Session>;
export async function validateSession(token: string): Promise<User | null>;
export async function destroySession(token: string): Promise<void>;
export async function refreshSession(refreshToken: string): Promise<Session>;
```

**Usage Example:**
```typescript
import { createSession } from '@/lib/auth/session';

// In API route
const session = await createSession(user.id);
return NextResponse.json({ session });
```

---

#### Module: Invite Code Generator

**File:** `lib/auth/invite-codes.ts`

**Exports:**
```typescript
export function generateInviteCode(): string;
export function validateInviteCodeFormat(code: string): boolean;
```

**Implementation:**
```typescript
import { customAlphabet } from 'nanoid';

const nanoid = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 8);

export function generateInviteCode(): string {
  return `FAMILY-${nanoid()}`;
}

export function validateInviteCodeFormat(code: string): boolean {
  return /^FAMILY-[A-Z0-9]{4,8}:[A-Za-z0-9+/=]+$/.test(code);
}
```

---

## 4. Error Handling

### 4.1 Client-Side Errors

**Form Validation Errors:**
- Display inline under each field (React Hook Form + Zod)
- Example: "Email is required", "Password must be at least 8 characters"

**API Errors:**
- Toast notifications for user-facing errors
- Console logs for debugging
- Example:
  ```typescript
  try {
    const response = await fetch('/api/auth/register', { ... });
    if (!response.ok) throw new Error('Registration failed');
  } catch (error) {
    toast.error('Failed to create account. Please try again.');
    console.error('Registration error:', error);
  }
  ```

**Network Errors:**
- Retry logic for transient failures (3 retries with exponential backoff)
- Offline indicator if network unavailable

### 4.2 API Errors

**Error Response Format:**
```typescript
type ErrorResponse = {
  success: false;
  error: {
    code: string; // e.g., 'EMAIL_ALREADY_EXISTS'
    message: string; // User-facing message
    details?: any; // Optional debug info (dev mode only)
  };
};
```

**Common Error Codes:**
- `EMAIL_ALREADY_EXISTS` (409) - Email already registered
- `INVALID_INVITE_CODE` (404) - Invite code not found
- `FAMILY_FULL` (403) - Family has reached max_members
- `INVALID_CREDENTIALS` (401) - Email or password incorrect
- `VALIDATION_ERROR` (400) - Input validation failed

### 4.3 Edge Cases

| Edge Case | Handling |
|-----------|----------|
| **Invite code expired/revoked** | Return 404 "Invite code not found or expired" |
| **Concurrent registrations with same email** | Database unique constraint catches, return 409 |
| **Family key generation fails** | Retry 3 times, then return 500 with error log |
| **IndexedDB quota exceeded** | Fall back to sessionStorage (warn user: session-only) |
| **User closes browser during registration** | Transaction rollback (database) + client retry logic |
| **Admin deletes family during member join** | Foreign key constraint blocks, return 404 |

---

## 5. Testing Strategy

### 5.1 Unit Tests (Vitest)

**File:** `tests/unit/auth/invite-codes.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { generateInviteCode, validateInviteCodeFormat } from '@/lib/auth/invite-codes';

describe('Invite Code Generation', () => {
  it('should generate unique invite codes', () => {
    const codes = new Set();
    for (let i = 0; i < 100; i++) {
      codes.add(generateInviteCode());
    }
    expect(codes.size).toBe(100); // All unique
  });

  it('should generate codes in correct format', () => {
    const code = generateInviteCode();
    expect(code).toMatch(/^FAMILY-[A-Z0-9]{8}$/);
  });

  it('should validate correct invite code formats', () => {
    expect(validateInviteCodeFormat('FAMILY-A3X9K2P1:dGVzdA==')).toBe(true);
    expect(validateInviteCodeFormat('INVALID')).toBe(false);
    expect(validateInviteCodeFormat('FAMILY-ONLY')).toBe(false); // Missing key
  });
});
```

**File:** `tests/unit/auth/validation.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { registerSchema, joinSchema, loginSchema } from '@/lib/validators/auth';

describe('Auth Validation Schemas', () => {
  it('should validate correct registration input', () => {
    const input = {
      email: 'test@example.com',
      password: 'password123',
      familyName: 'Test Family',
      userName: 'Test User',
    };
    expect(registerSchema.parse(input)).toEqual(input);
  });

  it('should reject invalid email', () => {
    const input = { email: 'invalid-email', password: 'password123', familyName: 'Test', userName: 'Test' };
    expect(() => registerSchema.parse(input)).toThrow('Invalid email address');
  });

  it('should reject short password', () => {
    const input = { email: 'test@example.com', password: '123', familyName: 'Test', userName: 'Test' };
    expect(() => registerSchema.parse(input)).toThrow('Password must be at least 8 characters');
  });
});
```

### 5.2 Integration Tests

**File:** `tests/integration/auth/register-flow.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createSupabaseServerClient } from '@/lib/supabase/server';

describe('Registration Flow Integration', () => {
  let supabase;

  beforeAll(async () => {
    supabase = createSupabaseServerClient();
  });

  afterAll(async () => {
    // Clean up test data
    await supabase.from('users').delete().eq('email', 'test-admin@example.com');
  });

  it('should create family admin and generate invite code', async () => {
    const response = await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test-admin@example.com',
        password: 'password123',
        familyName: 'Test Family',
        userName: 'Test Admin',
      }),
    });

    expect(response.status).toBe(200);

    const result = await response.json();
    expect(result.success).toBe(true);
    expect(result.user.role).toBe('admin');
    expect(result.family.inviteCode).toMatch(/^FAMILY-[A-Z0-9]{8}:[A-Za-z0-9+/=]+$/);

    // Verify user created in database
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'test-admin@example.com')
      .single();

    expect(user).toBeTruthy();
    expect(user.role).toBe('admin');
    expect(user.encrypted_family_key).toBeTruthy();
  });
});
```

### 5.3 E2E Tests (Playwright)

**File:** `tests/e2e/auth/onboarding.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('User Onboarding Flow', () => {
  test('should create family and join as member', async ({ page, context }) => {
    // Step 1: Admin creates family
    await page.goto('/login');
    await page.click('button:text("Create Family")');
    await page.fill('[name="userName"]', 'Admin User');
    await page.fill('[name="email"]', 'admin@test.com');
    await page.fill('[name="password"]', 'password123');
    await page.fill('[name="familyName"]', 'Test Family');
    await page.click('button:text("Create Family")');

    // Wait for success and extract invite code
    await expect(page.locator('text=Family created!')).toBeVisible();
    const toast = page.locator('[data-sonner-toast]');
    const inviteCode = await toast.textContent();
    const code = inviteCode?.match(/FAMILY-[A-Z0-9]{8}:[A-Za-z0-9+/=]+/)?.[0];

    expect(code).toBeTruthy();

    // Step 2: Member joins family
    const memberPage = await context.newPage();
    await memberPage.goto('/login');
    await memberPage.click('button:text("Join Family")');
    await memberPage.fill('[name="userName"]', 'Member User');
    await memberPage.fill('[name="email"]', 'member@test.com');
    await memberPage.fill('[name="password"]', 'password123');
    await memberPage.fill('[name="inviteCode"]', code!);
    await memberPage.click('button:text("Join Family")');

    // Verify redirect to chat
    await expect(memberPage).toHaveURL('/chat');
    await expect(memberPage.locator('text=Test Family')).toBeVisible();
  });

  test('should persist session after page reload', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('[name="email"]', 'admin@test.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button:text("Login")');
    await expect(page).toHaveURL('/chat');

    // Reload page
    await page.reload();

    // Verify still logged in (no redirect to /login)
    await expect(page).toHaveURL('/chat');
    await expect(page.locator('text=Test Family')).toBeVisible();
  });

  test('should clear session on logout', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('[name="email"]', 'admin@test.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button:text("Login")');

    // Logout
    await page.click('button[aria-label="Settings"]');
    await page.click('button:text("Logout")');

    // Verify redirect to login
    await expect(page).toHaveURL('/login');

    // Verify cannot access protected route
    await page.goto('/chat');
    await expect(page).toHaveURL('/login'); // Redirected back
  });
});
```

### 5.4 Acceptance Criteria Validation

| AC | Test Type | Validation Method |
|----|-----------|-------------------|
| **AC1.1:** Admin provides family name, email, password | E2E | Fill form fields, verify submission success |
| **AC1.2:** System generates invite code with key | Integration | Verify invite code format in API response |
| **AC1.3:** Admin receives confirmation | E2E | Verify toast notification shows invite code |
| **AC2.1:** Member enters email + invite code | E2E | Fill join form, verify submission |
| **AC2.2:** System validates code and creates account | Integration | Verify user created in database with correct family_id |
| **AC2.3:** Member redirected to chat | E2E | Verify URL is `/chat` after join |
| **AC3.1:** Session tokens stored securely | Unit | Verify HTTP-only cookies, IndexedDB key storage |
| **AC3.2:** Auto-login on revisit | E2E | Reload page, verify no redirect to login |
| **AC3.3:** Logout clears session and keys | E2E | Logout, verify redirect to login and IndexedDB cleared |

---

## 6. Security Considerations

### 6.1 Password Security

**Hashing:** bcrypt with 10 rounds (OWASP recommendation)
```typescript
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

**Password Requirements:**
- Minimum 8 characters
- No maximum length (bcrypt truncates at 72 characters)
- No complexity requirements (NIST guidelines: length > complexity)

### 6.2 Session Management

**JWT Storage:**
- Access token: HTTP-only cookie (SameSite=Strict)
- Refresh token: HTTP-only cookie (SameSite=Strict)
- Never store tokens in localStorage or sessionStorage (XSS vulnerability)

**Session Expiry:**
- Access token: 1 hour
- Refresh token: 30 days
- Auto-refresh before expiry (silent refresh)

**CSRF Protection:**
- SameSite=Strict cookies
- CSRF tokens on state-changing requests (optional, Supabase handles this)

### 6.3 Rate Limiting

**Endpoints:**
- POST /api/auth/register: 5 requests/hour per IP
- POST /api/auth/login: 5 requests/15 minutes per IP
- POST /api/auth/join: 10 requests/hour per IP

**Implementation:**
```typescript
// middleware.ts (Next.js Edge Middleware)
import { rateLimiter } from '@/lib/rate-limiter';

export async function middleware(request: Request) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown';

  if (request.url.includes('/api/auth/login')) {
    const allowed = await rateLimiter.check(ip, 'login', 5, 15 * 60); // 5 per 15 min
    if (!allowed) {
      return new Response('Too many login attempts. Please try again later.', { status: 429 });
    }
  }

  return NextResponse.next();
}
```

### 6.4 Input Validation

**Server-Side Validation (Required):**
- All inputs validated with Zod schemas
- SQL injection prevented by parameterized queries (Supabase client)
- XSS prevented by React auto-escaping + Content Security Policy

**Client-Side Validation (UX):**
- React Hook Form + Zod for instant feedback
- Not a security measure (can be bypassed)

---

## 7. Performance Targets

| Operation | Target Latency | Acceptable Max |
|-----------|---------------|----------------|
| **Registration API** | < 500ms | < 1.5s |
| **Login API** | < 300ms | < 1s |
| **Join API** | < 500ms | < 1.5s |
| **Session validation** | < 100ms | < 300ms |
| **Family key initialization** | < 50ms | < 200ms |

**Optimization Strategies:**
- Database indexes on `users.email`, `families.invite_code`
- Connection pooling (Supabase PgBouncer)
- Edge functions for low-latency API routes (Vercel Edge Runtime)

---

## 8. Implementation Checklist

### Week 1: Backend Foundation
- [ ] Create database migrations (users, families tables)
- [ ] Implement RLS policies for users and families
- [ ] Implement POST /api/auth/register (family creation)
- [ ] Implement POST /api/auth/join (family join)
- [ ] Implement POST /api/auth/login (existing user login)
- [ ] Implement invite code generation and validation
- [ ] Write unit tests for auth utilities (95% coverage)

### Week 2: Frontend & Integration
- [ ] Implement login screen UI (tabs for login/create/join)
- [ ] Implement CreateForm component (React Hook Form + Zod)
- [ ] Implement JoinForm component
- [ ] Implement LoginForm component
- [ ] Integrate E2EE key initialization (call Epic 7 functions)
- [ ] Implement session persistence (IndexedDB + cookies)
- [ ] Implement logout flow (clear session + keys)
- [ ] Write integration tests (registration + join flows)
- [ ] Write E2E tests (Playwright onboarding scenarios)

### Week 2.5: Security & Polish
- [ ] Implement rate limiting middleware
- [ ] Security audit (password hashing, session storage, CSRF)
- [ ] Error handling and user-facing error messages
- [ ] Performance testing (API latency benchmarks)
- [ ] Accessibility testing (keyboard navigation, screen readers)

---

## 9. Dependencies & Risks

**Depends On:**
- Epic 7: E2EE key generation and storage functions

**Depended On By:**
- All other epics (authentication required for all features)

**Risks:**

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **Invite code leakage** | High | Medium | Educate users on secure sharing, implement code expiry (Phase 2) |
| **Supabase Auth service outage** | Critical | Low | Monitor Supabase status, implement retry logic |
| **IndexedDB quota exceeded** | Medium | Low | Fall back to sessionStorage, warn user |
| **Rate limiting too strict (UX impact)** | Low | Medium | Monitor false positives, adjust limits based on analytics |

---

## 10. Acceptance Criteria

### US-1.1: Create Family Account

- [ ] Admin fills form with family name, email, password, name
- [ ] System generates unique invite code (format: FAMILY-XXXX:KEY)
- [ ] Admin receives success toast with invite code
- [ ] Admin redirected to chat screen
- [ ] Family record created in database with invite code
- [ ] Admin user created with role='admin'
- [ ] Family key stored in user record (encrypted_family_key)

### US-1.2: Join via Invite Code

- [ ] Member fills form with email, invite code, password, name
- [ ] System validates invite code exists and is valid
- [ ] System checks family not full (< max_members)
- [ ] Member account created with role='member'
- [ ] Member redirected to chat screen
- [ ] Family key loaded from invite code and stored in IndexedDB
- [ ] Member can see family name in UI

### US-1.3: Session Persistence

- [ ] After login, session token stored in HTTP-only cookie
- [ ] Family key stored in IndexedDB
- [ ] Page reload does not require re-login (session valid)
- [ ] Logout clears cookies and IndexedDB
- [ ] After logout, accessing /chat redirects to /login
- [ ] Session expires after 1 hour (access token) - auto-refresh implemented

---

**Document History:**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-10-13 | Claude (Tech Spec Generator) | Initial tech spec for Epic 1 |

---

**Status:** ✅ Ready for Implementation

## Post-Review Follow-ups

- **Story 1.4 – Email Verification:**
  - Persist the generated family key by reading `pending_family_key` / `pending_family_invite`, calling `initializeFamilyKey()`, and clearing the temp storage during verification (`src/lib/contexts/auth-context.tsx`, `src/app/(auth)/verify-email/page.tsx`).
  - Emit a `requiresEmailVerification` flag from `login`, enforce `emailVerified` inside `JwtAuthGuard`, and redirect unverified logins to `/verification-pending` so AC5/AC6 remain satisfied (`apps/backend/src/auth/auth.service.ts`, `apps/backend/src/auth/guards/jwt-auth.guard.ts`, `src/components/auth/unified-login-screen.tsx`).
  - Add automated unit/integration/E2E tests covering register/join/verify/resend flows (`apps/backend/src/auth/**`, `apps/backend/test/**`, `tests/e2e/**`).
