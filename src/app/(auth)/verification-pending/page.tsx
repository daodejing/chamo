'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useMutation } from '@apollo/client/react';
import { ResendVerificationEmailDocument } from '@/lib/graphql/generated/graphql';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageCircle, Mail, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { useLanguage } from '@/lib/contexts/language-context';
import { t, Language } from '@/lib/translations';

function VerificationPendingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { language, setLanguage } = useLanguage();
  const email = searchParams.get('email') || '';
  const langParam = searchParams.get('lang');
  const [languageInitialized, setLanguageInitialized] = useState(false);

  // Set language from URL param (for invitees arriving from registration)
  useEffect(() => {
    if (langParam === 'ja' || langParam === 'en') {
      setLanguage(langParam as Language);
    }
    setLanguageInitialized(true);
  }, [langParam, setLanguage]);

  const [resendMutation, { loading }] = useMutation(ResendVerificationEmailDocument);
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');

  const handleResend = async () => {
    if (!email) {
      setError(t('verification.emailMissing', language));
      return;
    }

    try {
      setMessage('');
      setError('');

      const { data } = await resendMutation({
        variables: { email },
      });

      if (data?.resendVerificationEmail?.success) {
        setMessage(t('verification.resendSuccess', language));
      }
    } catch (err: unknown) {
      const error = err as Error;
      if (error.message?.includes('Too many resend attempts')) {
        setError(t('verification.tooManyAttempts', language));
      } else {
        setError(t('verification.resendError', language));
      }
    }
  };

  // Wait for language to be initialized before rendering
  if (!languageInitialized) {
    return null;
  }

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
            <CardTitle>{t('verification.title', language)}</CardTitle>
            <CardDescription className="mt-2">
              {t('verification.sentTo', language)}
            </CardDescription>
            <p className="mt-1 font-medium text-foreground">{email}</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Info box */}
          <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 p-4 flex gap-3">
            <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-blue-700 dark:text-blue-300">
              {t('verification.instructions', language)}
            </p>
          </div>

          {/* Success message */}
          {message && (
            <div className="rounded-xl bg-green-50 dark:bg-green-950/30 p-4 flex gap-3">
              <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm font-medium text-green-700 dark:text-green-300">{message}</p>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="rounded-xl bg-red-50 dark:bg-red-950/30 p-4 flex gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm font-medium text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          {/* Resend button */}
          <Button
            onClick={handleResend}
            disabled={loading}
            className="w-full bg-gradient-to-r from-[#B5179E] to-[#8B38BA] hover:from-[#9c1487] hover:to-[#7a2fa5] text-white rounded-[20px] h-12 shadow-lg"
          >
            <Mail className="w-4 h-4 mr-2" />
            {loading ? t('verification.sending', language) : t('verification.resendButton', language)}
          </Button>

          {/* Back to login button */}
          <Button
            onClick={() => router.push('/login')}
            variant="outline"
            className="w-full rounded-[20px] h-12 border-2 hover:bg-muted"
          >
            {t('verification.backToLogin', language)}
          </Button>

          {/* Help text */}
          <p className="text-center text-sm text-muted-foreground">
            {t('verification.checkSpam', language)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function VerificationPendingPage() {
  return (
    <Suspense fallback={null}>
      <VerificationPendingContent />
    </Suspense>
  );
}
