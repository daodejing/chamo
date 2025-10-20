# Missing Production Dependencies

## Problem
Prototype uses mocked or inline functions that don't exist as exports in production modules.

## Symptoms
- Runtime error: "X is not a function"
- Import error: "X is not exported from Y"
- TypeScript error during compilation
- Works in prototype, crashes in production

## Example from OurChat

**Prototype**: Had auth logic inline or mocked
**Production**: Needed `getAuthHeader()` export from GraphQL client

```typescript
// ❌ GraphQL client was missing this export
export const apolloClient = new ApolloClient({...});
export function setAuthToken(token: string | null) {...}
// getAuthHeader() was MISSING!

// ✅ Had to add missing export
export function getAuthHeader() {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('accessToken');
  return token ? { authorization: `Bearer ${token}` } : {};
}
```

**Error seen**:
```
TypeError: getAuthHeader is not a function
Attempted import error: 'getAuthHeader' is not exported from 'src/lib/graphql/client.ts'
```

## Detection Strategies

### 1. TypeScript Compilation
```bash
npx tsc --noEmit
```
Catches missing exports at build time.

### 2. Browser Console
Check for import errors during runtime:
- "X is not exported from Y"
- "Cannot read property of undefined"

### 3. End-to-End Testing
Test complete user flows to catch missing dependencies in action.

### 4. Static Analysis
```bash
# Search for imports of specific function
rg "import.*getAuthHeader" --type ts

# Search for exports in module
rg "export.*function" src/lib/graphql/client.ts
```

## Common Missing Dependencies

### Authentication Headers
```typescript
export function getAuthHeader() {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('accessToken');
  return token ? { authorization: `Bearer ${token}` } : {};
}
```

### Utility Functions
```typescript
export function formatDate(date: Date): string {
  // Prototype had inline, production needs export
}
```

### Type Definitions
```typescript
export interface LoginInput {
  email: string;
  password: string;
}
```

### Constants
```typescript
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
```

## Prevention

### 1. Document Required Exports
When planning prototype integration, list all functions/types needed:

```markdown
## Required Exports
- src/lib/graphql/client.ts: getAuthHeader()
- src/lib/utils.ts: formatDate(), parseDate()
- src/types/auth.ts: LoginInput, AuthResponse
```

### 2. Create Stubs First
Add function signatures before implementation:

```typescript
export function getAuthHeader() {
  throw new Error('Not implemented');
}
```

### 3. Integration Tests
Write tests that import and use all required functions:

```typescript
import { getAuthHeader } from '@/lib/graphql/client';

describe('Auth headers', () => {
  it('should provide auth header', () => {
    expect(getAuthHeader).toBeDefined();
  });
});
```

## Resolution Steps

1. **Identify missing export**: Check error message for function name and module
2. **Locate module**: Find the file that should contain the export
3. **Add export**: Implement the missing function
4. **Verify TypeScript**: Run `npx tsc --noEmit`
5. **Test runtime**: Verify in browser console
6. **Test flow**: Complete end-to-end user flow

## Red Flags

- Prototype has utility functions but no utilities file in production
- Prototype has type definitions inline but no types file in production
- Prototype has constants hardcoded but no constants file in production
- Import statements in your adapted code but functions not exported in target module
