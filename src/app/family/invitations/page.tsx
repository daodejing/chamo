'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@apollo/client/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCcw } from 'lucide-react';
import { useAuth } from '@/lib/contexts/auth-context';
import { useLanguage } from '@/lib/contexts/language-context';
import { t } from '@/lib/translations';
import { GetFamilyInvitesDocument } from '@/lib/graphql/generated/graphql';

type InviteStatus = 'PENDING_REGISTRATION' | 'PENDING' | 'ACCEPTED';

const STATUS_CONFIG: Record<
  InviteStatus,
  { translationKey: string; variant: 'secondary' | 'default' | 'outline' }
> = {
  PENDING_REGISTRATION: {
    translationKey: 'invitesList.status.notRegistered',
    variant: 'secondary',
  },
  PENDING: {
    translationKey: 'invitesList.status.pending',
    variant: 'outline',
  },
  ACCEPTED: {
    translationKey: 'invitesList.status.accepted',
    variant: 'default',
  },
};

export default function FamilyInvitationsPage() {
  const router = useRouter();
  const { language } = useLanguage();
  const { user, loading } = useAuth();
  const familyId = user?.activeFamily?.id ?? null;

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login?returnUrl=/family/invitations');
    }
  }, [loading, user, router]);

  const { data, loading: invitesLoading, refetch } = useQuery(GetFamilyInvitesDocument, {
    variables: { familyId: familyId! },
    skip: !familyId,
    fetchPolicy: 'cache-and-network',
  });

  if (loading || !user) {
    return null;
  }

  if (!familyId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>{t('invitesList.title', language)}</CardTitle>
            <CardDescription>{t('invitesList.noFamily', language)}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const invites = data?.getFamilyInvites ?? [];

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-2xl shadow-xl rounded-[20px]">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>{t('invitesList.title', language)}</CardTitle>
            <CardDescription>{t('invitesList.description', language)}</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={invitesLoading}>
            {invitesLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                {t('invitesList.refreshing', language)}
              </>
            ) : (
              <>
                <RefreshCcw className="w-4 h-4 mr-2" />
                {t('invitesList.refresh', language)}
              </>
            )}
          </Button>
        </CardHeader>
        <CardContent>
          {invitesLoading && invites.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : invites.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('invitesList.empty', language)}</p>
          ) : (
            <div className="space-y-4">
              {invites.map((invite: any) => {
                const statusConfig =
                  STATUS_CONFIG[invite.status as InviteStatus] ?? STATUS_CONFIG.PENDING;
                return (
                  <div
                    key={invite.id}
                    className="rounded-xl border bg-card px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium">{invite.inviteeEmail}</p>
                      <p className="text-xs text-muted-foreground">
                        {t('invitesList.created', language, {
                          date: new Date(invite.createdAt).toLocaleString(),
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={statusConfig.variant}>
                        {t(statusConfig.translationKey, language)}
                      </Badge>
                      {invite.status === 'PENDING_REGISTRATION' && (
                        <span className="text-xs text-muted-foreground">
                          {t('invitesList.awaitingRegistration', language)}
                        </span>
                      )}
                      {invite.status === 'PENDING' && (
                        <span className="text-xs text-muted-foreground">
                          {t('invitesList.awaitingAcceptance', language)}
                        </span>
                      )}
                      {invite.status === 'ACCEPTED' && (
                        <span className="text-xs text-muted-foreground">
                          {t('invitesList.acceptedOn', language, {
                            date: new Date(invite.acceptedAt).toLocaleString(),
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
