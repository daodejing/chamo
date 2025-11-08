'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/lib/contexts/auth-context';
import { UnifiedLoginScreen } from '@/components/auth/unified-login-screen';
import { consumePendingInviteCode } from '@/lib/invite/pending-invite';
import { parseInviteCode } from '@/lib/e2ee/key-management';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/lib/contexts/language-context';
import { t } from '@/lib/translations';

export default function JoinPage() {
  const router = useRouter();
  const { language } = useLanguage();
  const { user, family, loading, joinFamilyExisting } = useAuth();
  const [initialInviteCode, setInitialInviteCode] = useState<string | null>(null);
  const [hasParsedLink, setHasParsedLink] = useState(false);
  const [shouldPrompt, setShouldPrompt] = useState(false);

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
      if (initialInviteCode) {
        setShouldPrompt(true);
      } else {
        router.push('/chat');
      }
    }
  }, [loading, user, initialInviteCode, router]);

  const inviteCodeFragment = useMemo(() => {
    if (!initialInviteCode) return null;
    try {
      const { code } = parseInviteCode(initialInviteCode);
      return code;
    } catch {
      return initialInviteCode.split(':')[0] ?? initialInviteCode;
    }
  }, [initialInviteCode]);

  const handleJoinAndSwitch = async () => {
    if (!initialInviteCode) return;
    try {
      await joinFamilyExisting(initialInviteCode, { makeActive: true });
      toast.success(t('toast.multiFamilyJoinSwitch', language));
      router.push('/chat');
      setShouldPrompt(false);
    } catch (error) {
      console.error('Failed to join family', error);
      toast.error(t('toast.multiFamilyJoinError', language));
    }
  };

  const handleJoinWithoutSwitch = async () => {
    if (!initialInviteCode) return;
    try {
      await joinFamilyExisting(initialInviteCode, { makeActive: false });
      toast.success(t('toast.multiFamilyJoinOnly', language));
      router.push('/chat');
      setShouldPrompt(false);
    } catch (error) {
      console.error('Failed to join family', error);
      toast.error(t('toast.multiFamilyJoinError', language));
    }
  };

  const handleCancel = () => {
    setShouldPrompt(false);
    router.push('/chat');
  };

  if (loading || !hasParsedLink) {
    return null;
  }

  if (user && shouldPrompt && initialInviteCode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-xl shadow-xl">
          <CardHeader>
            <CardTitle>{t('multiFamily.promptTitle', language)}</CardTitle>
            <CardDescription>
              {family?.name
                ? t('multiFamily.promptSummary', language, { currentFamily: family.name })
                : t('multiFamily.promptSummaryAnonymous', language)}
              {' '}
              {t('multiFamily.promptDescription', language, {
                code: inviteCodeFragment ?? '',
              })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>{t('multiFamily.helpSwitch', language)}</p>
              <p>{t('multiFamily.helpJoinOnly', language)}</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button onClick={handleJoinAndSwitch} className="flex-1">
                {t('multiFamily.joinSwitch', language)}
              </Button>
              <Button
                onClick={handleJoinWithoutSwitch}
                variant="secondary"
                className="flex-1"
              >
                {t('multiFamily.joinOnly', language)}
              </Button>
              <Button onClick={handleCancel} variant="ghost" className="flex-1">
                {t('multiFamily.cancel', language)}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
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
