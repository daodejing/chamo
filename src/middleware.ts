/**
 * Next.js Middleware for route protection and session management.
 * Checks JWT token on protected routes and redirects unauthenticated users.
 *
 * NOTE: Currently simplified during GraphQL migration.
 * TODO: Implement proper JWT validation once auth is fully migrated.
 */

import { type NextRequest, NextResponse } from 'next/server';

// Routes that require authentication
const PROTECTED_ROUTES = ['/chat', '/settings', '/profile'];

// Routes that should redirect to /chat if already authenticated
const AUTH_ROUTES = ['/login'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // For now, allow all routes during GraphQL migration
  // TODO: Re-enable proper JWT validation after migration is complete
  return NextResponse.next();

  // Future implementation with JWT validation:
  // - Check for accessToken cookie
  // - Validate JWT signature
  // - Redirect based on authentication status
}

// Configure which routes the middleware runs on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api routes (handled separately)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
