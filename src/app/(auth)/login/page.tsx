'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/lib/contexts/auth-context';
import { useLanguage } from '@/lib/contexts/language-context';
import { t } from '@/lib/translations';
import { UnifiedLoginScreen } from '@/components/auth/unified-login-screen';
import { markInviteeFlowActive } from '@/lib/invite/invitee-flow';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { language } = useLanguage();
  const verifiedStatus = searchParams.get('verified');
  const emailParam = searchParams.get('email');
  const searchParamsString = searchParams.toString();
  const modeParam = searchParams.get('mode');
  const lockModeParam = searchParams.get('lockMode');
  const returnUrlParam = searchParams.get('returnUrl');
  const [initialEmail, setInitialEmail] = useState<string | null>(null);
  const [initialMode, setInitialMode] = useState<'login' | 'create' | 'join' | undefined>();
  const [modeLocked, setModeLocked] = useState(false);

  useEffect(() => {
    if (emailParam) {
      setInitialEmail(emailParam);
    }
  }, [emailParam]);

  useEffect(() => {
    if (modeParam === 'create' || modeParam === 'join' || modeParam === 'login') {
      setInitialMode(modeParam);
    } else {
      setInitialMode(undefined);
    }
  }, [modeParam]);

  useEffect(() => {
    if (lockModeParam === 'invitee') {
      setModeLocked(true);
      markInviteeFlowActive();
    } else {
      setModeLocked(false);
    }
  }, [lockModeParam]);

  useEffect(() => {
    if (verifiedStatus === 'success') {
      toast.success(t('toast.emailVerified', language));
      const params = new URLSearchParams(searchParamsString);
      params.delete('verified');
      const returnUrl = params.get('returnUrl');
      const newSearch = params.toString();
      router.replace(newSearch ? `/login?${newSearch}` : '/login');
      if (returnUrl) {
        router.push(returnUrl);
      }
    }
  }, [verifiedStatus, language, router, searchParamsString]);

  // Auto-redirect: if already authenticated, redirect to /chat
  useEffect(() => {
    if (!authLoading && user) {
      if (returnUrlParam) {
        router.push(returnUrlParam);
      } else {
        router.push('/chat');
      }
    }
  }, [user, authLoading, router, returnUrlParam]);

  // Show nothing while checking auth status
  if (authLoading) {
    return null;
  }

  // Only show login screen if not authenticated
  if (!user) {
    return (
      <UnifiedLoginScreen
        onSuccess={() => router.push('/chat')}
        initialEmail={initialEmail}
        initialMode={initialMode}
        modeLocked={modeLocked}
        returnUrl={returnUrlParam}
      />
    );
  }

  return null;
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
