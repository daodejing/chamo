# React 19 + Next.js 15 Compatibility Patterns

## Required Patterns for Prototype Adaptation

### 1. 'use client' Directive

Always include at top of interactive components:

```typescript
'use client';

import { useState } from 'react';
// ... rest of component
```

**Why**: Next.js 15 App Router defaults to Server Components. Interactive features require Client Components.

### 2. startTransition for Form Submissions

Prevents form reset in Next.js 15:

```typescript
import { useTransition } from 'react';

const [isPending, startTransition] = useTransition();

const handleSubmit = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.preventDefault();

  startTransition(() => {
    // Async operations here
    performLogin();
  });
};
```

**Why**: Next.js 15 changed form handling behavior. Without startTransition, forms may reset prematurely.

### 3. Prefer onClick Over onSubmit

```typescript
// ❌ Can be problematic in Next.js 15
<form onSubmit={handleSubmit}>
  <button type="submit">Submit</button>
</form>

// ✅ More reliable
<div>
  <button type="button" onClick={handleSubmit}>Submit</button>
</div>
```

**Why**: Next.js 15 App Router has special handling for form elements that can interfere with React 19's synthetic event system.

### 4. Async Handler Pattern

```typescript
const handleSubmit = async (e: React.MouseEvent<HTMLButtonElement>) => {
  e.preventDefault();

  try {
    await performAsyncOperation();
    onSuccess();
  } catch (error) {
    handleError(error);
  }
};
```

**Why**: React 19 expects proper async/await patterns for async state updates.

### 5. State Updates in Transitions

```typescript
startTransition(() => {
  setIsSubmitting(true);

  const performAuth = async () => {
    try {
      await login({ email, password });
      onSuccess();
    } finally {
      setIsSubmitting(false);
    }
  };

  performAuth();
});
```

**Why**: Wrapping async operations in transitions prevents UI blocking.

## Common Prototype Patterns to Avoid

### ❌ Direct Form onSubmit
```typescript
<form onSubmit={handleSubmit}>
```

### ❌ Conditional Component Mounting
```typescript
if (loading) return null;
```

### ❌ Missing 'use client'
```typescript
// File starts with imports, no directive
import { useState } from 'react';
```

### ❌ Blocking Async Operations
```typescript
const handleSubmit = async () => {
  await fetch(...);  // Blocks UI
};
```

## Adaptation Checklist

When converting prototype to production:

- [ ] Add 'use client' to all interactive components
- [ ] Wrap form submissions in startTransition
- [ ] Change form onSubmit to button onClick
- [ ] Use type="button" on buttons (not type="submit")
- [ ] Wrap async operations properly
- [ ] Add error boundaries
- [ ] Add loading states
- [ ] Test in production build (not just dev)
