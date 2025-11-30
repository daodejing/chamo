'use client';

import { useState } from 'react';
import { useMutation } from '@apollo/client/react';
import { toast } from 'sonner';
import { Loader2, UserPlus, Mail, Copy, Check, Globe } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { useLanguage } from '@/lib/contexts/language-context';
import { t } from '@/lib/translations';
import { CREATE_INVITE_MUTATION } from '@/lib/graphql/operations';
import { InviteLanguageSelector, type InviteLanguageCode } from '@/components/settings/invite-language-selector';

interface EmailBoundInviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  familyName: string;
}

interface CreateInviteResponse {
  createInvite: {
    inviteCode: string;
    inviteeEmail: string;
    inviteeLanguage: string;
    expiresAt: string;
  };
}

export function EmailBoundInviteDialog({
  open,
  onOpenChange,
  familyName,
}: EmailBoundInviteDialogProps) {
  const { language } = useLanguage();

  const [email, setEmail] = useState('');
  // Story 1.13: Default to UI language, or English if UI language not in supported list
  const [inviteeLanguage, setInviteeLanguage] = useState<InviteLanguageCode>(
    language === 'ja' || language === 'en' ? language : 'en'
  );
  const [inviteResult, setInviteResult] = useState<CreateInviteResponse['createInvite'] | null>(null);
  const [copied, setCopied] = useState(false);

  const [createInvite, { loading: isCreating }] = useMutation<CreateInviteResponse>(
    CREATE_INVITE_MUTATION
  );

  const handleClose = () => {
    setEmail('');
    setInviteeLanguage(language === 'ja' || language === 'en' ? language : 'en');
    setInviteResult(null);
    setCopied(false);
    onOpenChange(false);
  };

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      toast.error(t('toast.emailRequired', language));
      return;
    }

    try {
      const { data } = await createInvite({
        variables: {
          input: {
            inviteeEmail: email.trim().toLowerCase(),
            inviteeLanguage,
          },
        },
      });

      if (data?.createInvite) {
        setInviteResult(data.createInvite);
        toast.success(t('toast.inviteCreated', language, { email: email.trim() }));
      }
    } catch (error) {
      console.error('Invite creation error:', error);
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error(t('toast.inviteCreationFailed', language));
      }
    }
  };

  const handleCopyInviteCode = async () => {
    if (!inviteResult) return;

    try {
      await navigator.clipboard.writeText(inviteResult.inviteCode);
      setCopied(true);
      toast.success(t('toast.inviteCodeCopied', language));
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Copy error:', error);
      toast.error(t('toast.copyFailed', language));
    }
  };

  const formatExpirationDate = (isoDate: string) => {
    const date = new Date(isoDate);
    return date.toLocaleDateString(language, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            {t('emailInvite.title', language)}
          </DialogTitle>
          <DialogDescription>
            {t('emailInvite.description', language, { familyName })}
          </DialogDescription>
        </DialogHeader>

        {!inviteResult ? (
          <form onSubmit={handleCreateInvite} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">
                {t('emailInvite.emailLabel', language)}
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder={t('emailInvite.emailPlaceholder', language)}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isCreating}
                  className="pl-9"
                  required
                />
              </div>
            </div>

            {/* Story 1.13: Language selector for invite email */}
            <div className="space-y-2">
              <Label htmlFor="inviteeLanguage" className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-muted-foreground" />
                {t('emailInvite.languageLabel', language)}
              </Label>
              <InviteLanguageSelector
                value={inviteeLanguage}
                onValueChange={setInviteeLanguage}
                disabled={isCreating}
                currentUiLanguage={language}
              />
              <p className="text-xs text-muted-foreground">
                {t('emailInvite.languageHelp', language)}
              </p>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isCreating}
              >
                {t('chat.cancel', language)}
              </Button>
              <Button
                type="submit"
                disabled={isCreating || !email.trim()}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    {t('emailInvite.generating', language)}
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4 mr-2" />
                    {t('emailInvite.generateCode', language)}
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4">
            <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-green-900 dark:text-green-100">
                    {t('emailInvite.inviteCodeLabel', language)}
                  </Label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-green-300 dark:border-green-700 rounded-md text-sm font-mono select-all">
                      {inviteResult.inviteCode}
                    </code>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleCopyInviteCode}
                      className="shrink-0"
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-green-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-sm text-green-900 dark:text-green-100">
                    <strong>{t('emailInvite.inviteeLabel', language)}:</strong>{' '}
                    {inviteResult.inviteeEmail}
                  </p>
                  <p className="text-sm text-green-900 dark:text-green-100">
                    <strong>{t('emailInvite.expiresLabel', language)}:</strong>{' '}
                    {formatExpirationDate(inviteResult.expiresAt)}
                  </p>
                </div>

                <div className="pt-2 border-t border-green-200 dark:border-green-800">
                  <p className="text-sm text-green-800 dark:text-green-200">
                    {t('emailInvite.instructions', language, {
                      email: inviteResult.inviteeEmail,
                    })}
                  </p>
                </div>
              </CardContent>
            </Card>

            <DialogFooter>
              <Button
                type="button"
                variant="default"
                onClick={handleClose}
              >
                {t('emailInvite.done', language)}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
