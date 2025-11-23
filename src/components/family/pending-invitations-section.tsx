'use client';

import { useState, useEffect } from 'react';
import { useQuery, useLazyQuery, useMutation } from '@apollo/client/react';
import { toast } from 'sonner';
import { Loader2, Mail, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/contexts/auth-context';
import { useLanguage } from '@/lib/contexts/language-context';
import { t, Language } from '@/lib/translations';
import {
  GetPendingInvitesDocument,
  GetUserPublicKeyDocument,
  CreateEncryptedInviteDocument,
} from '@/lib/graphql/generated/graphql';
import { encryptFamilyKeyForRecipient } from '@/lib/e2ee/invite-encryption';
import { getFamilyKeyBase64, generateInviteCode } from '@/lib/e2ee/key-management';

interface PendingInvitationsSectionProps {
  familyId: string;
  autoCompleteEmail?: string | null;
}

export function PendingInvitationsSection({ familyId, autoCompleteEmail }: PendingInvitationsSectionProps) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [completingInviteId, setCompletingInviteId] = useState<string | null>(null);
  const [autoCompleteHandled, setAutoCompleteHandled] = useState(false);

  const { data, loading, refetch } = useQuery(GetPendingInvitesDocument, {
    variables: { familyId },
    skip: !familyId,
  });

  const [getUserPublicKey] = useLazyQuery(GetUserPublicKeyDocument);
  const [createEncryptedInvite] = useMutation(CreateEncryptedInviteDocument);

  const pendingInvites = data?.getPendingInvites || [];
  const normalizedAutoEmail = autoCompleteEmail?.toLowerCase() ?? null;

  const handleCompleteInvite = async (inviteeEmail: string, inviteId: string) => {
    if (!user) {
      toast.error(t('toast.notAuthenticated', language));
      return;
    }

    setCompletingInviteId(inviteId);

    try {
      // Step 1: Get invitee's public key
      const { data: keyData } = await getUserPublicKey({
        variables: { email: inviteeEmail },
      });

      const publicKey = keyData?.getUserPublicKey;

      if (!publicKey) {
        toast.error(t('toast.userStillNotRegistered', language));
        setCompletingInviteId(null);
        return;
      }

      // Step 2: Get family key from storage
      const familyKeyBase64 = await getFamilyKeyBase64(familyId);
      if (!familyKeyBase64) {
        toast.error(t('toast.familyKeyNotFound', language));
        setCompletingInviteId(null);
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
            inviteeEmail,
            encryptedFamilyKey: encryptedKey,
            nonce,
            inviteCode,
            expiresAt: expiresAt.toISOString(),
          },
        },
      });

      if (inviteData?.createEncryptedInvite) {
        toast.success(
          t('toast.inviteCompleted', language, {
            email: inviteeEmail,
          })
        );
        // Refetch to update the list
        await refetch();
      }
    } catch (error) {
      console.error('Complete invite error:', error);
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error(t('toast.inviteCompletionFailed', language));
      }
    } finally {
      setCompletingInviteId(null);
    }
  };

  useEffect(() => {
    if (!normalizedAutoEmail || autoCompleteHandled || loading || !pendingInvites.length) {
      return;
    }
    const match = pendingInvites.find(
      (invite: any) => invite.inviteeEmail?.toLowerCase() === normalizedAutoEmail,
    );
    if (!match) {
      return;
    }
    setAutoCompleteHandled(true);
    handleCompleteInvite(match.inviteeEmail, match.id).catch(() => {
      // errors handled in handleCompleteInvite; no-op here
    });
  }, [normalizedAutoEmail, autoCompleteHandled, loading, pendingInvites]);

  const checkIfRegistered = async (email: string) => {
    try {
      const { data: keyData } = await getUserPublicKey({
        variables: { email },
      });
      return !!keyData?.getUserPublicKey;
    } catch {
      return false;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            {t('pendingInvites.title', language)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (pendingInvites.length === 0) {
    return null; // Don't show the section if there are no pending invites
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          {t('pendingInvites.title', language)}
        </CardTitle>
        <CardDescription>{t('pendingInvites.description', language)}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {pendingInvites.map((invite: any) => (
            <PendingInviteCard
              key={invite.id}
              invite={invite}
              isCompleting={completingInviteId === invite.id}
              onComplete={handleCompleteInvite}
              checkIfRegistered={checkIfRegistered}
              language={language}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface PendingInviteCardProps {
  invite: any;
  isCompleting: boolean;
  onComplete: (email: string, id: string) => void;
  checkIfRegistered: (email: string) => Promise<boolean>;
  language: Language;
}

function PendingInviteCard({
  invite,
  isCompleting,
  onComplete,
  checkIfRegistered,
  language,
}: PendingInviteCardProps) {
  const [isRegistered, setIsRegistered] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const handleCheckStatus = async () => {
    setIsChecking(true);
    const registered = await checkIfRegistered(invite.inviteeEmail);
    setIsRegistered(registered);
    setIsChecking(false);
  };

  const isPendingRegistration = invite.status === 'PENDING_REGISTRATION';

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg bg-card">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <p className="text-sm font-medium truncate">{invite.inviteeEmail}</p>
        </div>
        <div className="flex items-center gap-2">
          {isPendingRegistration ? (
            <>
              <Badge variant="secondary" className="text-xs">
                <Clock className="w-3 h-3 mr-1" />
                {t('pendingInvites.waitingForRegistration', language)}
              </Badge>
              {isRegistered === true && (
                <Badge variant="default" className="text-xs bg-green-500">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  {t('pendingInvites.readyToComplete', language)}
                </Badge>
              )}
            </>
          ) : (
            <Badge variant="outline" className="text-xs">
              <AlertCircle className="w-3 h-3 mr-1" />
              {t('pendingInvites.pending', language)}
            </Badge>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 ml-4">
        {isPendingRegistration && isRegistered === null && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleCheckStatus}
            disabled={isChecking}
          >
            {isChecking ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                {t('pendingInvites.checking', language)}
              </>
            ) : (
              t('pendingInvites.checkStatus', language)
            )}
          </Button>
        )}
        {isPendingRegistration && isRegistered === true && (
          <Button
            variant="default"
            size="sm"
            onClick={() => onComplete(invite.inviteeEmail, invite.id)}
            disabled={isCompleting}
          >
            {isCompleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                {t('pendingInvites.completing', language)}
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                {t('pendingInvites.completeInvite', language)}
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
