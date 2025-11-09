'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, UserPlus, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/lib/contexts/auth-context';
import { useLanguage } from '@/lib/contexts/language-context';
import { t } from '@/lib/translations';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function AcceptInvitePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, acceptInvite } = useAuth();
  const { language } = useLanguage();

  const [isAccepting, setIsAccepting] = useState(false);
  const [acceptedFamily, setAcceptedFamily] = useState<{
    name: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const inviteCode = searchParams.get('code');

  useEffect(() => {
    // Redirect to login if not authenticated
    if (!user) {
      const returnUrl = inviteCode
        ? `/accept-invite?code=${encodeURIComponent(inviteCode)}`
        : '/accept-invite';
      router.push(`/login?returnUrl=${encodeURIComponent(returnUrl)}`);
      return;
    }

    // Auto-accept if we have an invite code and haven't started accepting yet
    if (inviteCode && !isAccepting && !acceptedFamily && !error) {
      handleAcceptInvite(inviteCode);
    }
  }, [user, inviteCode, isAccepting, acceptedFamily, error]);

  const handleAcceptInvite = async (code: string) => {
    setIsAccepting(true);
    setError(null);

    try {
      const result = await acceptInvite(code);
      setAcceptedFamily({ name: result.familyName });
      toast.success(t('toast.inviteAccepted', language, { familyName: result.familyName }));

      // Redirect to chat after a moment
      setTimeout(() => {
        router.push('/chat');
      }, 2000);
    } catch (err) {
      console.error('Accept invite error:', err);
      const errorMessage = err instanceof Error ? err.message : t('toast.inviteAcceptFailed', language);
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsAccepting(false);
    }
  };

  if (!user) {
    return null; // Will redirect to login
  }

  if (!inviteCode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>{t('acceptInvite.noCodeTitle', language)}</CardTitle>
            <CardDescription>{t('acceptInvite.noCodeDescription', language)}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/family-setup')} className="w-full">
              {t('acceptInvite.goToFamilySetup', language)}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            {t('acceptInvite.title', language)}
          </CardTitle>
          <CardDescription>{t('acceptInvite.description', language)}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isAccepting && (
            <div className="flex flex-col items-center justify-center py-8 space-y-3">
              <Loader2 className="w-12 h-12 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                {t('acceptInvite.accepting', language)}
              </p>
            </div>
          )}

          {acceptedFamily && (
            <div className="flex flex-col items-center justify-center py-8 space-y-3">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <div className="text-center space-y-1">
                <p className="font-medium text-green-800">
                  {t('acceptInvite.successTitle', language)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t('acceptInvite.successMessage', language, { familyName: acceptedFamily.name })}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('acceptInvite.redirecting', language)}
              </p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800 font-medium mb-2">
                {t('acceptInvite.errorTitle', language)}
              </p>
              <p className="text-xs text-red-700">{error}</p>
              <div className="mt-4 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push('/family-setup')}
                  className="flex-1"
                >
                  {t('acceptInvite.goToFamilySetup', language)}
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleAcceptInvite(inviteCode)}
                  className="flex-1"
                >
                  {t('acceptInvite.retry', language)}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
