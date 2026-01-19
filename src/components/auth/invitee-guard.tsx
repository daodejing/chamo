'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/auth-context';
import { isInviteeFlowActive } from '@/lib/invite/invitee-flow';

// Pages that invitees are allowed to access
const ALLOWED_PATHS_FOR_INVITEES = ['/family-setup', '/accept-invite'];

// Pages that don't require auth and should be accessible to everyone
const PUBLIC_PATHS = ['/login', '/register', '/verification-pending', '/verify-email'];

interface InviteeGuardProps {
  children: React.ReactNode;
}

/**
 * Guard component that redirects invitees (User B) to the waiting page.
 * Invitees can ONLY access /family-setup until their invite is ready.
 */
export function InviteeGuard({ children }: InviteeGuardProps) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // Don't redirect while loading auth state
    if (loading) return;

    // Don't check if user is not authenticated
    if (!user) return;

    // Check if this is an invitee
    const isInvitee = isInviteeFlowActive();
    if (!isInvitee) return;

    // Allow public paths
    if (PUBLIC_PATHS.some(path => pathname.startsWith(path))) return;

    // If invitee is trying to access a non-allowed path, redirect to family-setup
    const isAllowedPath = ALLOWED_PATHS_FOR_INVITEES.some(path => pathname.startsWith(path));
    if (!isAllowedPath) {
      router.replace('/family-setup');
    }
  }, [user, loading, pathname, router]);

  return <>{children}</>;
}
