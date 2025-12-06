'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageCircle, Fingerprint } from 'lucide-react';
import { toast } from 'sonner';
import { t, translations } from '@/lib/translations';
import { useLanguage } from '@/lib/contexts/language-context';
import { useAuth } from '@/lib/contexts/auth-context';
import { isInviteeFlowActive } from '@/lib/invite/invitee-flow';

type AuthMode = 'login' | 'create' | 'join';

interface UnifiedLoginScreenProps {
  onSuccess: () => void;
  initialMode?: AuthMode;
  initialInviteCode?: string | null;
  initialEmail?: string | null;
  modeLocked?: boolean;
  returnUrl?: string | null;
}

export function UnifiedLoginScreen({
  onSuccess,
  initialMode,
  initialInviteCode,
  initialEmail,
  modeLocked = false,
  returnUrl,
}: UnifiedLoginScreenProps) {
  const { language } = useLanguage();
  const { login, register: registerUser, joinFamily } = useAuth();
  const router = useRouter();

  // Form state
  const [authMode, setAuthMode] = useState<AuthMode>(initialMode ?? 'login');
  const [email, setEmail] = useState(initialEmail ?? '');
  const [password, setPassword] = useState('');
  const [userName, setUserName] = useState('');
  const [inviteCode, setInviteCode] = useState(initialInviteCode ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isGeneratingKeys, setIsGeneratingKeys] = useState(false);

  useEffect(() => {
    if (initialMode) {
      setAuthMode(initialMode);
    }
  }, [initialMode]);

  useEffect(() => {
    if (initialInviteCode && !modeLocked) {
      setInviteCode(initialInviteCode);
      setAuthMode('join');
    }
  }, [initialInviteCode, modeLocked]);

  useEffect(() => {
    if (initialEmail) {
      setEmail(initialEmail);
    }
  }, [initialEmail]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!email || !password) {
      toast.error(t('toast.fillAllFields', language));
      return;
    }

    if (authMode === 'create' && !userName) {
      toast.error(t('toast.fillAllFields', language));
      return;
    }

    if (authMode === 'join' && (!userName || !inviteCode)) {
      toast.error(t('toast.fillAllFields', language));
      return;
    }

    const needsKeyGeneration = authMode === 'create' || authMode === 'join';

    setIsSubmitting(true);
    if (needsKeyGeneration) {
      setIsGeneratingKeys(true);
    }
    try {
      if (authMode === 'login') {
        const loginResult = await login({ email, password });
        if (loginResult?.requiresVerification) {
          toast.info(t('toast.verifyEmailRequired', language));
          router.push(`/verification-pending?email=${encodeURIComponent(loginResult.email)}&lang=${language}`);
          return;
        }
        toast.success(t('toast.loginSuccess', language));
        if (returnUrl) {
          router.push(returnUrl);
        } else if (isInviteeFlowActive()) {
          router.push('/family-setup');
        } else {
          onSuccess();
        }
      } else if (authMode === 'create') {
        const result = await registerUser({
          email,
          password,
          name: userName,
        });

        if (result?.requiresVerification) {
          // Redirect to verification pending page
          router.push(`/verification-pending?email=${encodeURIComponent(result.email)}&lang=${language}`);
          return; // Don't call onSuccess(), user needs to verify email first
        }
      } else if (authMode === 'join') {
        const result = await joinFamily({
          email,
          password,
          name: userName,
          inviteCode,
        });

        if (result?.requiresVerification) {
          // Redirect to verification pending page
          router.push(`/verification-pending?email=${encodeURIComponent(result.email)}&lang=${language}`);
          return; // Don't call onSuccess(), user needs to verify email first
        }
      }
    } catch (error: unknown) {
      const err = error as Error & { translationKey?: string };
      console.error('Auth error:', err);
      const translationKey =
        err.translationKey ||
        (typeof err.message === 'string' && err.message.startsWith('toast.')
          ? err.message
          : null);
      const message = translationKey
        ? t(translationKey as keyof typeof translations['en'], language)
        : err.message || t('toast.authFailed', language);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
      if (needsKeyGeneration) {
        setIsGeneratingKeys(false);
      }
    }
  };

  const handleBiometricAuth = async () => {
    setIsAuthenticating(true);

    try {
      toast.loading(t('toast.authenticating', language), { id: 'biometric-auth' });

      // Simulate biometric authentication
      await new Promise(resolve => setTimeout(resolve, 1500));

      toast.success(t('toast.authSuccess', language), { id: 'biometric-auth' });

      // In a real app, this would use Web Authentication API
      // For now, just show success
      onSuccess();
    } catch {
      toast.error(t('toast.authFailed', language), { id: 'biometric-auth' });
    } finally {
      setIsAuthenticating(false);
    }
  };

  const getTitle = () => {
    switch (authMode) {
      case 'create':
        return t('login.createAccount', language);
      case 'join':
        return t('login.joinFamily', language);
      default:
        return t('login.loginTitle', language);
    }
  };

  const getButtonText = () => {
    if (isGeneratingKeys) {
      return t('login.generatingKeys', language);
    }

    if (isSubmitting) {
      switch (authMode) {
        case 'create':
          return t('login.creating', language);
        case 'join':
          return t('login.joining', language);
        default:
          return t('login.loggingIn', language);
      }
    }

    switch (authMode) {
      case 'create':
        return t('login.createAccountButton', language);
      case 'join':
        return t('login.joinFamilyButton', language);
      default:
        return t('login.loginButton', language);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4" data-testid="auth-screen-container">
      <Card className="w-full max-w-md shadow-xl rounded-[20px]">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-gradient-to-br from-[#B5179E] to-[#5518C1] rounded-[20px] flex items-center justify-center shadow-lg">
              <MessageCircle className="w-8 h-8 text-white" />
            </div>
          </div>
          <div>
            <CardTitle data-testid="auth-screen-title">{t('login.title', language)}</CardTitle>
              <CardDescription data-testid="auth-screen-mode">{getTitle()}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name field - for create and join modes */}
            {(authMode === 'create' || authMode === 'join') && (
              <div className="space-y-2">
                <Label htmlFor="userName">{t('login.userName', language)}</Label>
                <Input
                  id="userName"
                  name="userName"
                  type="text"
                  placeholder={t('login.userNamePlaceholder', language)}
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  required
              disabled={isSubmitting || isGeneratingKeys}
              className="rounded-xl"
            />
              </div>
            )}

            {/* Email field - all modes */}
            <div className="space-y-2">
              <Label htmlFor="email">{t('login.email', language)}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isSubmitting}
                className="rounded-xl"
              />
            </div>

            {/* Password field - all modes */}
            <div className="space-y-2">
              <Label htmlFor="password">{t('login.password', language)}</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder={t('login.passwordPlaceholder', language)}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isSubmitting}
                className="rounded-xl"
              />
            </div>

            {/* Invite code field - join mode only */}
            {authMode === 'join' && (
              <div className="space-y-2">
                <Label htmlFor="inviteCode">{t('login.inviteCode', language)}</Label>
                <Input
                  id="inviteCode"
                  name="inviteCode"
                  type="text"
                  placeholder="CODE-XXXX-YYYY"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  required
                  disabled={isSubmitting}
                  className="rounded-xl"
                />
                <p className="text-sm text-muted-foreground">
                  {t('login.inviteCodeDescription', language)}
                </p>
              </div>
            )}

            {/* Invitee banner */}
            {modeLocked && authMode === 'create' && (
              <div className="rounded-md bg-indigo-50 p-4 text-sm text-indigo-900">
                {t('login.inviteeBanner', language)}
              </div>
            )}

            {/* Submit button */}
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-[#B5179E] to-[#8B38BA] hover:from-[#9c1487] hover:to-[#7a2fa5] text-white rounded-[20px] h-12 shadow-lg"
              disabled={isSubmitting || isGeneratingKeys}
            >
              {getButtonText()}
            </Button>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">{t('login.or', language)}</span>
              </div>
            </div>

            {/* Biometric Login Button */}
            <Button
              type="button"
              onClick={handleBiometricAuth}
              disabled={isAuthenticating}
              variant="outline"
              className="w-full rounded-[20px] h-12 border-2 hover:bg-muted"
            >
              <Fingerprint className="w-5 h-5 mr-2" />
              {isAuthenticating ? t('login.authenticating', language) : t('login.faceId', language)}
            </Button>

            {!modeLocked && (
              <div className="text-center space-y-2">
                {authMode === 'login' && (
                  <>
                    <button
                      type="button"
                      onClick={() => setAuthMode('create')}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors block w-full"
                    >
                      {t('login.switchToCreate', language)}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuthMode('join')}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors block w-full"
                    >
                      {t('login.switchToJoin', language)}
                    </button>
                  </>
                )}
                {authMode === 'create' && (
                  <>
                    <button
                      type="button"
                      onClick={() => setAuthMode('login')}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors block w-full"
                    >
                      {t('login.switchToLogin', language)}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuthMode('join')}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors block w-full"
                    >
                      {t('login.switchToJoin', language)}
                    </button>
                  </>
                )}
                {authMode === 'join' && (
                  <>
                    <button
                      type="button"
                      onClick={() => setAuthMode('login')}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors block w-full"
                    >
                      {t('login.switchToLogin', language)}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuthMode('create')}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors block w-full"
                    >
                      {t('login.switchToCreate', language)}
                    </button>
                  </>
                )}
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
