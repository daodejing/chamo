'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/lib/contexts/auth-context';
import { useLanguage } from '@/lib/contexts/language-context';
import { t } from '@/lib/translations';
import { UnifiedLoginScreen } from '@/components/auth/unified-login-screen';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { language } = useLanguage();
  const verifiedStatus = searchParams.get('verified');
  const emailParam = searchParams.get('email');
  const searchParamsString = searchParams.toString();
  const [initialEmail, setInitialEmail] = useState<string | null>(null);

  useEffect(() => {
    if (emailParam) {
      setInitialEmail(emailParam);
    }
  }, [emailParam]);

  useEffect(() => {
    if (verifiedStatus === 'success') {
      toast.success(t('toast.emailVerified', language));
      const params = new URLSearchParams(searchParamsString);
      params.delete('verified');
      const newSearch = params.toString();
      router.replace(newSearch ? `/login?${newSearch}` : '/login');
    }
  }, [verifiedStatus, language, router, searchParamsString]);

  // Auto-redirect: if already authenticated, redirect to /chat
  useEffect(() => {
    if (!authLoading && user) {
      console.log('[LoginPage] User authenticated, redirecting to /chat');
      router.push('/chat');
    }
  }, [user, authLoading, router]);

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
      />
    );
  }

  return null;
}
