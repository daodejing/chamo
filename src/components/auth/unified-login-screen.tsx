'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageCircle, Fingerprint, Copy, X } from 'lucide-react';
import { toast } from 'sonner';
import { t } from '@/lib/translations';
import { useLanguage } from '@/lib/contexts/language-context';
import { useAuth } from '@/lib/contexts/auth-context';
import QRCode from 'react-qr-code';

type AuthMode = 'login' | 'create' | 'join';

interface UnifiedLoginScreenProps {
  onSuccess: () => void;
  initialMode?: AuthMode;
  initialInviteCode?: string | null;
}

export function UnifiedLoginScreen({
  onSuccess,
  initialMode,
  initialInviteCode,
}: UnifiedLoginScreenProps) {
  const { language } = useLanguage();
  const { login, register: registerUser, joinFamily } = useAuth();

  // Form state
  const [authMode, setAuthMode] = useState<AuthMode>(initialMode ?? 'login');
  const [email, setEmail] = useState('');
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
        await login({ email, password });
        toast.success(t('toast.loginSuccess', language));
      } else if (authMode === 'create') {
        const family = await registerUser({
          email,
          password,
          name: userName,
          familyName,
        });
          // Display invite code in toast for sharing (AC3 from Story 1.1)
        if (family?.inviteCode) {
          // Display full invite code (FAMILY-XXXXXXXX:BASE64KEY) for sharing
          // Members need both parts: code for backend, key for decryption
          // Persist until user explicitly closes it (critical information)
          const inviteCode = family.inviteCode;
          const origin =
            typeof window !== 'undefined' ? window.location.origin : '';
          const shareLink = origin
            ? `${origin}/join#code=${encodeURIComponent(inviteCode)}`
            : '';

          // Create dismiss callback that will be populated with toast ID
          const dismissToast = { current: () => {} };

          const toastContent = (
            <div className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <div className="font-semibold">
                  Family Created! Share this invite code:
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => dismissToast.current()}
                  className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-muted px-3 py-2 rounded text-sm font-mono select-text">
                  {inviteCode}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await navigator.clipboard.writeText(inviteCode);
                    toast.success('Copied to clipboard!', { duration: 2000 });
                  }}
                  className="shrink-0"
                >
                  <Copy className="w-4 h-4" />
                </Button>
                </div>
              <div className="text-xs text-muted-foreground">
                This code contains the family ID and encryption key. Keep it safe!
              </div>
              <div className="mt-2 flex flex-col items-center gap-2 rounded-lg border border-dashed border-muted-foreground/40 bg-muted/40 p-3">
                <span className="text-xs font-medium text-muted-foreground">
                  Prefer scanning? Show this QR code.
                </span>
                <div className="rounded-md bg-background p-3 shadow-sm">
                  <QRCode
                    value={shareLink || inviteCode}
                    size={168}
                    style={{ height: '168px', width: '168px' }}
                    viewBox="0 0 256 256"
                  />
                </div>
                <span className="text-[11px] text-muted-foreground">
                  Invitees can open their camera or QR scanner and paste the code automatically.
                </span>
              </div>
              {shareLink && (
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-muted px-3 py-2 rounded text-xs font-mono break-all">
                    {shareLink}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await navigator.clipboard.writeText(shareLink);
                      toast.success('Invite link copied!', { duration: 2000 });
                    }}
                    className="shrink-0"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          );

          // Show toast and capture ID for manual dismissal
          const toastId = toast.success(toastContent, {
            duration: Infinity,
            className: 'invite-code-toast',
          });

          // Set dismiss callback now that we have the toast ID
          dismissToast.current = () => toast.dismiss(toastId);
        } else {
          toast.success(t('toast.familyCreated', language), { duration: Infinity });
        }
      } else if (authMode === 'join') {
        await joinFamily({
          email,
          password,
          name: userName,
          inviteCode,
        });
        toast.success(t('toast.joinSuccess', language));
      }

      onSuccess();
    } catch (error: any) {
      console.error('Auth error:', error);
      toast.error(error.message || t('toast.authFailed', language));
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
    } catch (error) {
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
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-xl rounded-[20px]">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-gradient-to-br from-[#B5179E] to-[#5518C1] rounded-[20px] flex items-center justify-center shadow-lg">
              <MessageCircle className="w-8 h-8 text-white" />
            </div>
          </div>
          <div>
            <CardTitle>{t('login.title', language)}</CardTitle>
            <CardDescription>{getTitle()}</CardDescription>
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
