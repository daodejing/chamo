'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageCircle, Fingerprint } from 'lucide-react';
import { toast } from 'sonner';
import { t } from '@/lib/translations';
import { useLanguage } from '@/lib/contexts/language-context';
import { useAuth } from '@/lib/contexts/auth-context';

type AuthMode = 'login' | 'create' | 'join';

interface UnifiedLoginScreenProps {
  onSuccess: () => void;
  initialMode?: AuthMode;
  initialInviteCode?: string | null;
  initialEmail?: string | null;
}

export function UnifiedLoginScreen({
  onSuccess,
  initialMode,
  initialInviteCode,
  initialEmail,
}: UnifiedLoginScreenProps) {
  const { language } = useLanguage();
  const { login, register: registerUser, joinFamily } = useAuth();
  const router = useRouter();

  // Form state
  const [authMode, setAuthMode] = useState<AuthMode>(initialMode ?? 'login');
  const [email, setEmail] = useState(initialEmail ?? '');
  const [password, setPassword] = useState('');
  const [userName, setUserName] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [inviteCode, setInviteCode] = useState(initialInviteCode ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  useEffect(() => {
    if (initialMode) {
      setAuthMode(initialMode);
    }
  }, [initialMode]);

  useEffect(() => {
    if (initialInviteCode) {
      setInviteCode(initialInviteCode);
      setAuthMode('join');
    }
  }, [initialInviteCode]);

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

    if (authMode === 'create' && (!userName || !familyName)) {
      toast.error(t('toast.fillAllFields', language));
      return;
    }

    if (authMode === 'join' && (!userName || !inviteCode)) {
      toast.error(t('toast.fillAllFields', language));
      return;
    }

    setIsSubmitting(true);
    try {
      if (authMode === 'login') {
        const loginResult = await login({ email, password });
        if (loginResult?.requiresVerification) {
          toast.info(t('toast.verifyEmailRequired', language));
          router.push(`/verification-pending?email=${encodeURIComponent(loginResult.email)}`);
          return;
        }
        toast.success(t('toast.loginSuccess', language));
        onSuccess();
      } else if (authMode === 'create') {
        const result = await registerUser({
          email,
          password,
          name: userName,
          familyName,
        });

        if (result?.requiresVerification) {
          // Redirect to verification pending page
          router.push(`/verification-pending?email=${encodeURIComponent(result.email)}`);
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
          router.push(`/verification-pending?email=${encodeURIComponent(result.email)}`);
          return; // Don't call onSuccess(), user needs to verify email first
        }
      }
    } catch (error: unknown) {
      const err = error as Error;
      console.error('Auth error:', err);
      toast.error(err.message || t('toast.authFailed', language));
    } finally {
      setIsSubmitting(false);
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
        return t('login.createFamily', language);
      case 'join':
        return t('login.joinFamily', language);
      default:
        return t('login.loginTitle', language);
    }
  };

  const getButtonText = () => {
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
        return t('login.createFamilyButton', language);
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
                  disabled={isSubmitting}
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

            {/* Family name field - create mode only */}
            {authMode === 'create' && (
              <div className="space-y-2">
                <Label htmlFor="familyName">{t('login.familyName', language)}</Label>
                <Input
                  id="familyName"
                  name="familyName"
                  type="text"
                  placeholder={t('login.familyNamePlaceholder', language)}
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                  required
                  disabled={isSubmitting}
                  className="rounded-xl"
                />
              </div>
            )}

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

            {/* Submit button */}
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-[#B5179E] to-[#8B38BA] hover:from-[#9c1487] hover:to-[#7a2fa5] text-white rounded-[20px] h-12 shadow-lg"
              disabled={isSubmitting}
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

            {/* Mode toggle buttons */}
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
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
