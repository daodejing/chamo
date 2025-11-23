'use client';

// Dynamic route: must not be statically exported
export const dynamic = 'force-dynamic';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { storePendingInviteCode } from '@/lib/invite/pending-invite';
import { parseInviteCode } from '@/lib/e2ee/key-management';

export default function JoinInviteRedirect() {
  const router = useRouter();
  const params = useParams<{ inviteCode?: string }>();

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const rawInvite = params?.inviteCode;

    if (!rawInvite) {
      router.replace('/join');
      return;
    }

    const inviteCandidate = decodeURIComponent(
      Array.isArray(rawInvite) ? rawInvite.join(':') : rawInvite,
    );

    try {
      // Validate format without exposing the key to backend
      parseInviteCode(inviteCandidate);
      storePendingInviteCode(inviteCandidate);
    } catch (error) {
      console.error('[JoinInviteRedirect] Invalid invite code', error);
    } finally {
      router.replace('/join');
    }
  }, [params, router]);

  return null;
}
