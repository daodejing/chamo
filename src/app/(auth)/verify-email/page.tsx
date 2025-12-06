'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useMutation } from '@apollo/client/react';
import { VerifyEmailDocument } from '@/lib/graphql/generated/graphql';
import { initializeFamilyKey } from '@/lib/e2ee/key-management';
import { clearPendingFamilySecrets, getPendingFamilySecrets } from '@/lib/contexts/auth-context';
import { storePersistentPendingInviteCode } from '@/lib/invite/pending-invite';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageCircle, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useLanguage } from '@/lib/contexts/language-context';
import { t, Language } from '@/lib/translations';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { language, setLanguage } = useLanguage();
  const token = searchParams.get('token') || '';
  const langParam = searchParams.get('lang');
  const [languageInitialized, setLanguageInitialized] = useState(false);

  // Set language from URL param (for invitees arriving from verification email)
  useEffect(() => {
    if (langParam === 'ja' || langParam === 'en') {
      setLanguage(langParam as Language);
    }
    setLanguageInitialized(true);
  }, [langParam, setLanguage]);

  const [verifyMutation, { loading }] = useMutation(VerifyEmailDocument);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState(false);
  const redirectScheduledRef = useRef(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError(t('verification.tokenMissing', language));
      return;
    }

    const verify = async () => {
      try {
        console.log('[VERIFY] Starting verification with token:', token);
        const { data } = await verifyMutation({
          variables: { token },
        });
        console.log('[VERIFY] Mutation response:', JSON.stringify(data, null, 2));

        if (data?.verifyEmail) {
          const familyId = data.verifyEmail.family?.id ?? null;
          const pendingSecrets = getPendingFamilySecrets();
          const pendingInviteFromServer = data.verifyEmail.pendingInviteCode ?? null;

          if (pendingSecrets?.base64Key && familyId) {
            try {
              await initializeFamilyKey(pendingSecrets.base64Key, familyId);
            } catch (keyError) {
              console.error('Failed to persist family key after verification', keyError);
            }
          }
          if (pendingInviteFromServer) {
            storePersistentPendingInviteCode(pendingInviteFromServer);
          } else {
            storePersistentPendingInviteCode(null);
          }
          const inviteToDisplay = pendingSecrets?.inviteCode ?? pendingInviteFromServer ?? null;
          if (inviteToDisplay) {
            setInviteCode(inviteToDisplay);
          }

          console.log('[VERIFY] Setting success and scheduling redirect');
          setSuccess(true);
          if (!redirectScheduledRef.current) {
            redirectScheduledRef.current = true;
            const redirectUrl = `/login?verified=success&email=${encodeURIComponent(data.verifyEmail.user.email)}`;
            console.log('[VERIFY] Will redirect to:', redirectUrl);
            setTimeout(() => {
              console.log('[VERIFY] Redirecting now to:', redirectUrl);
              router.replace(redirectUrl);
            }, 2500);
          }
        }
      } catch (err: unknown) {
        const error = err as Error;
        console.error('[VERIFY] Verification error:', error);
        if (error.message?.includes('already been used')) {
          setError(t('verification.alreadyUsed', language));
        } else if (error.message?.includes('expired')) {
          setError(t('verification.expired', language));
        } else {
          setError(t('verification.invalid', language));
        }
        clearPendingFamilySecrets();
      }
    };

    verify();
  }, [token, verifyMutation, router, language]);

  // Wait for language to be initialized before rendering
  if (!languageInitialized) {
    return null;
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md shadow-xl rounded-[20px]">
          <CardHeader className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-gradient-to-br from-[#B5179E] to-[#5518C1] rounded-[20px] flex items-center justify-center shadow-lg">
                <MessageCircle className="w-8 h-8 text-white" />
              </div>
            </div>
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-[#B5179E]" />
              <CardTitle>{t('verification.verifying', language)}</CardTitle>
            </div>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md shadow-xl rounded-[20px]">
          <CardHeader className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <div>
              <CardTitle>{t('verification.success', language)}</CardTitle>
              <CardDescription className="mt-2">
                {t('verification.successMessage', language)}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {inviteCode && (
              <div className="rounded-xl bg-muted p-4 text-center">
                <p className="text-sm text-muted-foreground mb-1">
                  {t('verification.saveInviteCode', language)}
                </p>
                <p className="font-mono text-sm font-medium">{inviteCode}</p>
              </div>
            )}

            <Button
              onClick={() => router.replace('/login')}
              className="w-full bg-gradient-to-r from-[#B5179E] to-[#8B38BA] hover:from-[#9c1487] hover:to-[#7a2fa5] text-white rounded-[20px] h-12 shadow-lg"
            >
              {t('verification.continueToLogin', language)}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error) {
    const isExpired = error.includes('expired') || error === t('verification.expired', language);

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md shadow-xl rounded-[20px]">
          <CardHeader className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                <AlertCircle className="w-10 h-10 text-red-600 dark:text-red-400" />
              </div>
            </div>
            <div>
              <CardTitle>{t('verification.failed', language)}</CardTitle>
              <CardDescription className="mt-2">{error}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {isExpired && (
              <Button
                onClick={() => router.push('/verification-pending')}
                className="w-full bg-gradient-to-r from-[#B5179E] to-[#8B38BA] hover:from-[#9c1487] hover:to-[#7a2fa5] text-white rounded-[20px] h-12 shadow-lg"
              >
                {t('verification.requestNew', language)}
              </Button>
            )}

            <Button
              onClick={() => router.push('/login')}
              variant="outline"
              className="w-full rounded-[20px] h-12 border-2 hover:bg-muted"
            >
              {t('verification.backToLogin', language)}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}
