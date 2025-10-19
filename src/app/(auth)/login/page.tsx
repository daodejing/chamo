'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/auth-context';
import { UnifiedLoginScreen } from '@/components/auth/unified-login-screen';

export default function LoginPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

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
    return <UnifiedLoginScreen onSuccess={() => router.push('/chat')} />;
  }

  return null;
}
