# Implementation Checklist

Use this checklist when adapting prototype code to production.

## Pre-Integration

- [ ] Review prototype code structure
- [ ] Identify all custom hooks used in prototype
- [ ] List all utility functions used in prototype
- [ ] Note all type definitions needed
- [ ] Check production architecture patterns
- [ ] Plan where adapted code will live in production

## Code Adaptation

### React 19 + Next.js 15 Requirements
- [ ] Add 'use client' directive to all interactive components
- [ ] Wrap async operations in startTransition
- [ ] Change form onSubmit to button onClick
- [ ] Use type="button" on buttons (not type="submit")
- [ ] Remove conditional returns from page components

### Production Dependencies
- [ ] Verify all utility functions are exported
- [ ] Check all custom hooks are available
- [ ] Ensure type definitions exist
- [ ] Confirm authentication utilities exported
- [ ] Validate API client functions exist

### Component Structure
- [ ] Keep page components as thin wrappers
- [ ] Move logic to callbacks, not useEffect
- [ ] Always render components (no conditional mounting)
- [ ] Use proper error boundaries
- [ ] Add loading states

## Testing

### Build-Time Testing
- [ ] Run TypeScript compilation: `npx tsc --noEmit`
- [ ] Check for linting errors: `pnpm lint`
- [ ] Verify no import errors

### Runtime Testing
- [ ] Create test route to verify handlers work
- [ ] Test event handlers fire (check console logs)
- [ ] Verify form submission works
- [ ] Check authentication flow completes
- [ ] Test redirect/navigation logic
- [ ] Verify error handling works
- [ ] Test loading states appear correctly

### Integration Testing
- [ ] Test complete user flow end-to-end
- [ ] Verify browser console has no errors
- [ ] Check network tab for failed requests
- [ ] Confirm data persists correctly
- [ ] Test with real backend (not mocked)

## Debugging Steps

If integration fails:

- [ ] Clear `.next` cache: `rm -rf .next`
- [ ] Restart dev server
- [ ] Check browser DevTools console for errors
- [ ] Verify handler attachment: `document.querySelector('button').onclick !== null`
- [ ] Create test route with isolated code
- [ ] Review parent page component for conditional rendering
- [ ] Check for missing exports with: `rg "export.*function" path/to/module.ts`
- [ ] Add strategic console logs to trace execution

## Post-Integration

- [ ] Remove test routes (or keep as fixtures)
- [ ] Add integration tests for adapted features
- [ ] Document any deviations from prototype
- [ ] Update CLAUDE.md with new patterns discovered
- [ ] Create troubleshooting docs for issues encountered
- [ ] Review with team

## Red Flags

Stop and investigate if you see:

- [ ] Event handlers not firing
- [ ] `button.onclick === null` in DevTools
- [ ] "X is not a function" errors
- [ ] "X is not exported from Y" errors
- [ ] Works in test route but not in production
- [ ] Changes don't appear after save
- [ ] Old errors persist after fixes
- [ ] Form resets unexpectedly

## Success Criteria

Consider integration successful when:

- [x] All event handlers fire consistently
- [x] No console errors about missing imports/exports
- [x] Complete user flows work end-to-end
- [x] TypeScript compilation passes without errors
- [x] No conditional rendering in page wrappers
- [x] Test coverage confirms functionality
- [x] Code follows production architecture patterns
- [x] Performance is acceptable (no blocking operations)

## Reference Documents

- [Conditional Rendering Issues](conditional-rendering.md)
- [Test-Driven Debugging](test-driven-debugging.md)
- [React 19 + Next.js 15 Patterns](compatibility-patterns.md)
- [Missing Production Dependencies](missing-dependencies.md)
- [Cache Management](cache-management.md)
- `/docs/troubleshooting/login-flow-issues.md` (OurChat example)
