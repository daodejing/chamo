# Port Allocation Strategy

## Overview
This document defines the port allocation strategy for the OurChat project to prevent conflicts between different services and development environments.

## Port Assignments

| Port | Service | Command | Purpose |
|------|---------|---------|---------|
| 3000 | Reserved | - | Reserved for other local services (NestJS backend, etc.) |
| 3001 | Reserved | - | Reserved for other local services |
| 3002 | Next.js Dev | `pnpm dev` | Primary development server for frontend |
| 4000 | Next.js Test | `pnpm dev:test` | Development server for E2E testing with Turbopack |
| 5432 | PostgreSQL | - | Local PostgreSQL database (if running locally) |
| 54321 | Supabase | `supabase start` | Local Supabase instance |

## Best Practices

1. **Always use explicit ports**: Never rely on default port 3000 as it commonly conflicts with other services
2. **Document new ports**: Add any new services to this file immediately
3. **Use npm scripts**: Always use package.json scripts rather than direct commands to ensure consistent ports
4. **Environment-specific ports**: Use different port ranges for different purposes:
   - 3001-3099: Development servers
   - 4000-4099: Testing environments
   - 5000-5999: Backend services
   - 54321+: External services (Supabase, etc.)

## Commands

### Development
```bash
# Primary development
pnpm dev  # Port 3002

# Testing with Turbopack
pnpm dev:test  # Port 4000
```

### Checking Port Usage
```bash
# Check what's using a specific port
lsof -i :3002

# Find Next.js processes
ps aux | grep "next dev"
```

## Troubleshooting

If you encounter port conflicts:

1. Check this document for the assigned port
2. Verify no other process is using the port
3. Use the appropriate npm script from package.json
4. Never manually kill processes unless you're certain of the service

## History

- 2025-10-13: Initial port allocation strategy created
- Port 3002 assigned as primary development port (3001 also in use)
- Port 4000 confirmed for E2E testing
- Resolved blank page issue caused by port 3000 conflict
