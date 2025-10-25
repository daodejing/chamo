# SECURITY ISSUE: E2EE Family Key Leak to Backend

## Severity
**CRITICAL** - Breaks End-to-End Encryption guarantee

## Date Identified
2025-10-25

## Issue Summary
The family encryption key (`familyKeyBase64`) is currently being sent to the backend server during registration, violating the fundamental principle of End-to-End Encryption (E2EE). In true E2EE, encryption keys must never leave the client device.

## Current Problematic Flow

### 1. Frontend (src/lib/contexts/auth-context.tsx:107-139)
```typescript
const register = async (input: {...}) => {
  // Generate family encryption key client-side (E2EE)
  const { familyKey, base64Key } = await generateFamilyKey();

  // ❌ PROBLEM: Sending the key to backend
  const { data } = await registerMutation({
    variables: {
      input: {
        ...input,
        familyKeyBase64: base64Key, // ⚠️ KEY SENT TO SERVER
      },
    },
  });
}
```

### 2. Backend Input (apps/backend/src/auth/dto/register.input.ts:25-27)
```typescript
@Field()
@IsString()
familyKeyBase64: string; // ❌ Server receives encryption key
```

### 3. Backend Service (apps/backend/src/auth/auth.service.ts:33-38)
```typescript
// ❌ Backend creates invite code WITH the key
const inviteCodeWithKey = this.generateInviteCodeWithKey(familyKeyBase64);

// Backend then strips the key for database storage
const { code: inviteCode } = this.parseInviteCode(inviteCodeWithKey);
```

### 4. Backend Response (apps/backend/src/auth/auth.service.ts:85-88)
```typescript
// ❌ Backend returns invite code with embedded key
const familyWithFullInviteCode = {
  ...family,
  inviteCode: inviteCodeWithKey, // Format: FAMILY-XXXXXXXX:BASE64KEY
};
```

## Security Implications

1. **Server has access to encryption keys** - The backend can decrypt all family messages
2. **Man-in-the-middle vulnerability** - Compromised server can intercept encryption keys
3. **Database breach impact** - If logs or temporary storage capture the key, all messages are compromised
4. **False E2EE claims** - Marketing the app as E2EE while keys transit through server is misleading

## Correct E2EE Implementation

### Frontend Should:
1. Generate family encryption key client-side
2. Store key in IndexedDB (never send to backend)
3. Request invite code from backend (code only, no key)
4. Combine code + key locally for display: `FAMILY-XXXXXXXX:BASE64KEY`
5. When sharing, user copies the combined code:key string

### Backend Should:
1. Generate only the invite code portion (`FAMILY-XXXXXXXX`)
2. Store only the code in database
3. Return only the code (without key) in API responses
4. Never receive, process, or store family encryption keys

### Updated Flow

```typescript
// Frontend
const register = async (input: {...}) => {
  // 1. Generate key locally
  const { familyKey, base64Key } = await generateFamilyKey();

  // 2. Call backend WITHOUT key
  const { data } = await registerMutation({
    variables: {
      input: {
        email,
        password,
        name,
        familyName,
        // ✅ No familyKeyBase64 sent
      },
    },
  });

  // 3. Store key locally only
  await initializeFamilyKey(base64Key);

  // 4. Combine code + key for display
  const inviteCodeFromBackend = data.register.family.inviteCode; // FAMILY-XXXXXXXX
  const fullInviteCode = `${inviteCodeFromBackend}:${base64Key}`; // FAMILY-XXXXXXXX:KEY

  // 5. Show in toast
  toast.success(`Invite Code: ${fullInviteCode}`);
};
```

```typescript
// Backend
async register(email, password, name, familyName) {
  // 1. Generate only the code portion
  const inviteCode = this.generateInviteCode(); // Returns: FAMILY-XXXXXXXX

  // 2. Store only the code
  const family = await this.prisma.family.create({
    data: {
      name: familyName,
      inviteCode, // Only code, no key
    },
  });

  // 3. Return only the code
  return {
    user,
    family, // family.inviteCode = FAMILY-XXXXXXXX (no key)
    accessToken,
    refreshToken,
  };
}
```

## Files Requiring Changes

### Backend
- [ ] `apps/backend/src/auth/dto/register.input.ts` - Remove `familyKeyBase64` field
- [ ] `apps/backend/src/auth/auth.service.ts` - Remove key handling logic
- [ ] `apps/backend/src/auth/auth.service.ts` - Generate only code portion
- [ ] `apps/backend/src/auth/auth.service.ts` - Return only code (no key)

### Frontend
- [ ] `src/lib/contexts/auth-context.tsx` - Remove `familyKeyBase64` from mutation
- [ ] `src/lib/contexts/auth-context.tsx` - Combine code + key locally
- [ ] `src/components/auth/unified-login-screen.tsx` - Update toast to use combined code
- [ ] `src/lib/graphql/operations.ts` - No changes needed (already correct)

### Tests
- [x] `tests/e2e/auth-onboarding.spec.ts` - AC3 test updated for correct behavior
- [x] `tests/e2e/messaging.spec.ts` - AC3 test updated for correct behavior

## Testing Strategy

1. **Unit Tests** - Verify backend never receives/returns keys
2. **Integration Tests** - Verify key stays in IndexedDB only
3. **E2E Tests** - Verify toast shows combined code:key format
4. **Security Audit** - Verify no key leakage in network traffic, logs, or database

## Migration Considerations

⚠️ **Breaking Change**: Existing families created with the old flow will have:
- Keys stored on backend (security breach)
- Need migration strategy to rotate keys

### Migration Options:
1. **Force key rotation** - All existing families regenerate keys
2. **Grandfather clause** - Old families keep current (insecure) setup, new families use correct E2EE
3. **Opt-in migration** - Offer users ability to rotate to secure E2EE

**Recommendation**: Option 1 (Force key rotation) for security integrity

## References
- E2EE Best Practices: https://signal.org/docs/specifications/doubleratchet/
- Zero-Knowledge Architecture: https://proton.me/blog/zero-access-encryption
- OWASP Cryptographic Storage: https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html

## Status
- [x] Issue identified
- [x] Tests updated for correct behavior
- [ ] Backend implementation fixed
- [ ] Frontend implementation fixed
- [ ] Security audit completed
- [ ] Migration plan executed
