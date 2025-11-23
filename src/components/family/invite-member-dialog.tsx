'use client';

import { useState } from 'react';
import { useMutation, useLazyQuery } from '@apollo/client/react';
import { toast } from 'sonner';
import { Loader2, UserPlus, Mail } from 'lucide-react';
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
import { useAuth } from '@/lib/contexts/auth-context';
import { useLanguage } from '@/lib/contexts/language-context';
import { t } from '@/lib/translations';
import {
  GetUserPublicKeyDocument,
  CreateEncryptedInviteDocument,
  CreatePendingInviteDocument,
} from '@/lib/graphql/generated/graphql';
import { encryptFamilyKeyForRecipient } from '@/lib/e2ee/invite-encryption';
import { getFamilyKeyBase64, generateInviteCode } from '@/lib/e2ee/key-management';

interface InviteMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  familyId: string;
  familyName: string;
}

export function InviteMemberDialog({
  open,
  onOpenChange,
  familyId,
  familyName,
}: InviteMemberDialogProps) {
  const { user } = useAuth();
  const { language } = useLanguage();

  const [email, setEmail] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [userNotRegistered, setUserNotRegistered] = useState(false);

  const [getUserPublicKey] = useLazyQuery(GetUserPublicKeyDocument);
  const [createEncryptedInvite, { loading: isCreatingInvite }] = useMutation(
    CreateEncryptedInviteDocument
  );
  const [createPendingInvite, { loading: isCreatingPendingInvite }] = useMutation(
    CreatePendingInviteDocument
  );

  const handleClose = () => {
    setEmail('');
    setUserNotRegistered(false);
    onOpenChange(false);
  };

  const handleSendRegistrationLink = async () => {
    if (!email.trim()) {
      toast.error(t('toast.emailRequired', language));
      return;
    }

    if (!user) {
      toast.error(t('toast.notAuthenticated', language));
      return;
    }

    try {
      const { data } = await createPendingInvite({
        variables: {
          input: {
            familyId,
            inviteeEmail: email.trim().toLowerCase(),
          },
        },
      });

      if (data?.createPendingInvite) {
        toast.success(
          t('toast.pendingInviteCreated', language, {
            email: email.trim(),
          })
        );
        handleClose();
      }
    } catch (error) {
      console.error('Pending invite creation error:', error);
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error(t('toast.pendingInviteCreationFailed', language));
      }
    }
  };

  const handleCheckAndInvite = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      toast.error(t('toast.emailRequired', language));
      return;
    }

    if (!user) {
      toast.error(t('toast.notAuthenticated', language));
      return;
    }

    setIsChecking(true);
    setUserNotRegistered(false);

    try {
      // Step 1: Check if invitee has a public key (is registered)
      const { data } = await getUserPublicKey({
        variables: { email: email.trim().toLowerCase() },
      });

      const publicKey = data?.getUserPublicKey;

      if (!publicKey) {
        // User is not registered
        setUserNotRegistered(true);
        setIsChecking(false);
        return;
      }

      // Step 2: Get family key from storage
      const familyKeyBase64 = await getFamilyKeyBase64(familyId);
      if (!familyKeyBase64) {
        toast.error(t('toast.familyKeyNotFound', language));
        setIsChecking(false);
        return;
      }

      // Step 3: Encrypt family key with invitee's public key
      const { encryptedKey, nonce } = await encryptFamilyKeyForRecipient(
        familyKeyBase64,
        publicKey,
        user.id
      );

      // Step 4: Generate invite code
      const inviteCode = generateInviteCode();

      // Step 5: Calculate expiration (7 days from now)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      // Step 6: Create encrypted invite in database
      const { data: inviteData } = await createEncryptedInvite({
        variables: {
          input: {
            familyId,
            inviteeEmail: email.trim().toLowerCase(),
            encryptedFamilyKey: encryptedKey,
            nonce,
            inviteCode,
            expiresAt: expiresAt.toISOString(),
          },
        },
      });

      if (inviteData?.createEncryptedInvite) {
        toast.success(
          t('toast.inviteCreated', language, {
            email: email.trim(),
          })
        );
        handleClose();
      }
    } catch (error) {
      console.error('Invite creation error:', error);
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error(t('toast.inviteCreationFailed', language));
      }
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            {t('inviteDialog.title', language)}
          </DialogTitle>
          <DialogDescription>
            {t('inviteDialog.description', language, { familyName })}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleCheckAndInvite} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">
              {t('inviteDialog.emailLabel', language)}
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder={t('inviteDialog.emailPlaceholder', language)}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isChecking || isCreatingInvite}
                className="pl-9"
                required
              />
            </div>
            {userNotRegistered && (
              <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md space-y-3">
                <div>
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    {t('inviteDialog.userNotRegistered', language, { email })}
                  </p>
                  <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                    {t('inviteDialog.userNotRegisteredHint', language)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSendRegistrationLink}
                  disabled={isCreatingPendingInvite}
                  className="w-full"
                >
                  {isCreatingPendingInvite ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      {t('inviteDialog.sendingRegistrationLink', language)}
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4 mr-2" />
                      {t('inviteDialog.sendRegistrationLink', language)}
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isChecking || isCreatingInvite || isCreatingPendingInvite}
            >
              {t('chat.cancel', language)}
            </Button>
            {!userNotRegistered && (
              <Button
                type="submit"
                disabled={isChecking || isCreatingInvite || !email.trim()}
              >
                {isChecking || isCreatingInvite ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {isChecking
                      ? t('inviteDialog.checking', language)
                      : t('inviteDialog.creating', language)}
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    {t('inviteDialog.sendInvite', language)}
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
