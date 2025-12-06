'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/lib/contexts/auth-context';
import { useLanguage } from '@/lib/contexts/language-context';
import { t, Language } from '@/lib/translations';
import { UnifiedLoginScreen } from '@/components/auth/unified-login-screen';
import { markInviteeFlowActive } from '@/lib/invite/invitee-flow';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageCircle, LogOut } from 'lucide-react';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading, logout } = useAuth();
  const { language, setLanguage } = useLanguage();
  const verifiedStatus = searchParams.get('verified');
  const emailParam = searchParams.get('email');
  const langParam = searchParams.get('lang');
  const searchParamsString = searchParams.toString();
  const modeParam = searchParams.get('mode');
  const lockModeParam = searchParams.get('lockMode');
  const returnUrlParam = searchParams.get('returnUrl');
  const [initialEmail, setInitialEmail] = useState<string | null>(null);
  const [initialMode, setInitialMode] = useState<'login' | 'create' | 'join' | undefined>();
  const [modeLocked, setModeLocked] = useState(false);
  const [languageInitialized, setLanguageInitialized] = useState(false);

  // Set language from URL param immediately (for invitees arriving from email)
  useEffect(() => {
    if (langParam === 'ja' || langParam === 'en') {
      setLanguage(langParam as Language);
    }
    setLanguageInitialized(true);
  }, [langParam, setLanguage]);

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

  // Auto-redirect: if already authenticated and NOT in invitee mode, redirect to /chat
  useEffect(() => {
    if (!authLoading && user && lockModeParam !== 'invitee') {
      if (returnUrlParam) {
        router.push(returnUrlParam);
      } else {
        router.push('/chat');
      }
    }
  }, [user, authLoading, router, returnUrlParam, lockModeParam]);

  // Show nothing while checking auth status or initializing language
  if (authLoading || !languageInitialized) {
    return null;
  }

  // If user is logged in AND this is an invitee link, show a warning
  // The invitee needs to register a new account, but there's already a session
  if (user && lockModeParam === 'invitee') {
    const handleLogoutAndContinue = async () => {
      await logout();
      // The page will re-render with user=null, showing the registration form
    };

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md shadow-xl rounded-[20px]">
          <CardHeader className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-gradient-to-br from-[#B5179E] to-[#5518C1] rounded-[20px] flex items-center justify-center shadow-lg">
                <MessageCircle className="w-8 h-8 text-white" />
              </div>
            </div>
            <div>
              <CardTitle>{t('login.alreadyLoggedInTitle', language)}</CardTitle>
              <CardDescription className="mt-2">
                {t('login.alreadyLoggedInDescription', language, { name: user.name })}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={handleLogoutAndContinue}
              className="w-full bg-gradient-to-r from-[#B5179E] to-[#8B38BA] hover:from-[#9c1487] hover:to-[#7a2fa5] text-white rounded-[20px] h-12 shadow-lg"
            >
              <LogOut className="w-4 h-4 mr-2" />
              {t('login.logoutAndContinue', language)}
            </Button>
            <Button
              onClick={() => router.push('/chat')}
              variant="outline"
              className="w-full rounded-[20px] h-12 border-2 hover:bg-muted"
            >
              {t('login.backToChat', language)}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show login screen if not authenticated
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
