# Test-Driven Debugging for Prototype Integration

## When to Use
Prototype code fails in production but looks correct - need to isolate whether issue is code or environment.

## The Method

### 1. Create Minimal Test Route
Create a test page (e.g., `/test-form`) with simplified version of failing code:

```typescript
'use client';

import { useState } from 'react';

export default function TestFormPage() {
  const handleClick = () => {
    console.log('[TestForm] Handler fired!');
  };

  return <button onClick={handleClick}>Test</button>;
}
```

### 2. Verify Baseline
Confirm event handlers work in test environment. If they don't, you have a fundamental React 19 issue. If they do, proceed.

### 3. Progressive Feature Addition
Systematically add features from production to test:

**Step 1**: Add UI components
```typescript
import { Button } from '@/components/ui/button';
return <Button onClick={handleClick}>Test</Button>;
```

**Step 2**: Add context providers
```typescript
const { login } = useAuth();
const { language } = useLanguage();
```

**Step 3**: Add complex state management
```typescript
const [isPending, startTransition] = useTransition();
```

**Step 4**: Add form submission pattern
```typescript
startTransition(() => {
  performAsyncOperation();
});
```

### 4. Identify Failure Point
When test breaks, you've found the problematic pattern. Note exactly what you added last.

### 5. Isolate Root Cause
Remove features until it works again. The last thing you removed is the culprit.

## Why This Works
- Proves React 19 event handlers function correctly
- Isolates environmental vs. code issues
- Identifies architectural problems (like parent component interference)
- Provides working reference implementation

## Example from OurChat
Created `/test-form` route with identical login form code. Handlers worked perfectly in test, failed in `/login`. This proved the issue was the `/login` page component's conditional rendering, not the form code itself.

## Common Discoveries
- Parent component conditional rendering breaks child handlers
- Missing context providers cause undefined errors
- Form element without onSubmit confuses Next.js
- Too many re-renders from state updates

## Cleanup
Once debugged, remove test routes or commit them as integration test fixtures.
