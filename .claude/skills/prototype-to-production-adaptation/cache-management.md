# Next.js Cache Management

## Problem
Code changes don't appear in browser due to aggressive Next.js caching.

## When This Happens
- Event handler changes don't take effect
- Still seeing old error messages after fixes
- Component structure changes not reflected (form → div)
- Adding/removing 'use client' directives
- After fixing syntax errors

## Solution

### Full Cache Clear + Restart
```bash
# Kill all dev servers
lsof -ti:3002 | xargs kill -9 2>/dev/null

# Clear cache and restart
rm -rf .next && pnpm dev
```

### Alternative (if port in use)
```bash
# Find and kill process on port
lsof -ti:3002 | xargs kill -9

# Wait a moment
sleep 2

# Clear cache and start
rm -rf .next && pnpm dev
```

## Affected Files
Next.js caches compiled versions of:
- Page components (`app/**/page.tsx`)
- Layout components (`app/**/layout.tsx`)
- Client components (anything with 'use client')
- Server components (default in App Router)
- Route handlers (`app/api/**/route.ts`)

## Browser Cache vs Next.js Cache

### Next.js Cache (`.next/` directory)
- Compiled JavaScript bundles
- Optimized assets
- Route manifest
- **Must be deleted** for structural changes

### Browser Cache
- Downloaded assets (JS, CSS, images)
- Usually auto-refreshes in dev mode
- Can force refresh with Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)

## When NOT to Clear Cache

Don't clear cache for:
- Simple content changes (text, styles)
- Adding new files (not modifying existing)
- Environment variable changes (restart dev server is enough)
- Data changes (API responses, etc.)

## Cache Issues Checklist

If changes aren't appearing:

1. **Check dev server is running**: `lsof -i:3002`
2. **Check for syntax errors**: Look at terminal output
3. **Force browser refresh**: Cmd+Shift+R or Ctrl+Shift+R
4. **Restart dev server**: `pkill -f "next dev" && pnpm dev`
5. **Clear Next.js cache**: `rm -rf .next && pnpm dev`
6. **Check if file saved**: Verify last modified time
7. **Check correct port**: Ensure browser pointing to right localhost port

## Debugging Cache Issues

### Check What's Cached
```bash
# See what's in cache
ls -la .next/

# Check cache size
du -sh .next/
```

### Monitor File Changes
```bash
# Watch for file modification
watch -n 1 'ls -lt src/components/auth/*.tsx | head -5'
```

### Verify Server Restarts
Dev server should show:
```
- ready started server on 0.0.0.0:3002
- compiled client and server successfully in X ms
```

## Production Builds

For production builds, always clear cache:
```bash
rm -rf .next && pnpm build
```

Production builds have different caching behavior and should always start fresh.

## Quick Reference

| Symptom | Solution |
|---------|----------|
| Handler not firing | Clear cache + restart |
| Old error still shown | Clear cache + restart |
| 'use client' not working | Clear cache + restart |
| Form changes not reflected | Clear cache + restart |
| Import errors persist | Check file, then clear cache |
| Styles not updating | Browser hard refresh first |
