# Conditional Rendering Breaking Event Handlers

## Problem
Event handlers (onClick, onSubmit) that work in prototype fail in production when wrapped in page components with conditional rendering.

## Symptoms
- `button.onclick === null` in browser DevTools
- Console logs in handler never fire
- Handler code looks correct but never executes
- Works in test routes but fails in actual pages

## Root Cause
React 19 + Next.js 15 conditional rendering patterns (especially `if (condition) return null`) cause components to mount/unmount in ways that prevent event handler attachment to DOM elements.

## Example: Broken Pattern

```typescript
// ❌ BROKEN - Page wrapper with conditional returns
export default function LoginPage() {
  const { user, loading } = useAuth();

  if (loading) return null;  // Causes unmount/remount issues
  if (!user) return <LoginComponent />;  // Breaks handler attachment

  return null;
}
```

## Solution

```typescript
// ✅ FIXED - Always render, move logic to callbacks
export default function LoginPage() {
  const router = useRouter();

  return <LoginComponent onSuccess={() => {
    router.push('/chat');
  }} />;
}
```

## Key Principles
- Always render components, avoid conditional returns in page wrappers
- Move redirect/navigation logic to callbacks instead of useEffect watching state
- Use CSS visibility or conditional content rendering instead of conditional component mounting
- Keep page components as thin wrappers, not logic containers

## Detection
1. Check parent page component for `if (condition) return null` patterns
2. Use browser DevTools: `document.querySelector('button').onclick` should not be null
3. Create test route with same component - if it works there, issue is parent component

## Reference
See `/docs/troubleshooting/login-flow-issues.md` for real-world example from OurChat.
