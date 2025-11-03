'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/auth-context';
import { UnifiedLoginScreen } from '@/components/auth/unified-login-screen';
import { consumePendingInviteCode } from '@/lib/invite/pending-invite';

export default function JoinPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [initialInviteCode, setInitialInviteCode] = useState<string | null>(null);
  const [hasParsedLink, setHasParsedLink] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const hashParams = new URLSearchParams(
      window.location.hash.startsWith('#')
        ? window.location.hash.slice(1)
        : window.location.hash,
    );
    const searchParams = new URLSearchParams(window.location.search);

    const codeFromHash = hashParams.get('code');
    const codeFromSearch = searchParams.get('code');
    const pendingInvite = consumePendingInviteCode();
    const code = codeFromHash || codeFromSearch || pendingInvite;

    if (code) {
      setInitialInviteCode(code);
    }

    if (codeFromHash) {
      // Remove sensitive data from the URL while keeping history entry
      const cleanUrl = `${window.location.pathname}${window.location.search}`;
      window.history.replaceState(null, '', cleanUrl);
    } else if (pendingInvite) {
      window.history.replaceState(null, '', '/join');
    }

    setHasParsedLink(true);
  }, []);

  useEffect(() => {
    if (!loading && user) {
      router.push('/chat');
    }
  }, [loading, user, router]);

  if (loading || !hasParsedLink) {
    return null;
  }

  if (!user) {
    return (
      <UnifiedLoginScreen
        initialMode="join"
        initialInviteCode={initialInviteCode}
        onSuccess={() => router.push('/chat')}
      />
    );
  }

  return null;
}
