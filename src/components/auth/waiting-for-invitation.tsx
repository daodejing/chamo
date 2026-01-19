'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@apollo/client/react';
import { Clock, Users, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useLanguage } from '@/lib/contexts/language-context';
import { t } from '@/lib/translations';
import { GetMyPendingInvitesDocument } from '@/lib/graphql/generated/graphql';
import { clearInviteeFlowFlag } from '@/lib/invite/invitee-flow';

export function WaitingForInvitation() {
  const { language } = useLanguage();
  const router = useRouter();

  const { data, loading, refetch } = useQuery(GetMyPendingInvitesDocument, {
    pollInterval: 30000, // Check every 30 seconds for invite status changes
  });

  const pendingInvites = useMemo(
    () => data?.getMyPendingInvites ?? [],
    [data?.getMyPendingInvites]
  );
  const hasPendingInvites = pendingInvites.length > 0;

  // If invites become ready (status = PENDING with encrypted key), redirect to family setup
  useEffect(() => {
    const hasReadyInvite = pendingInvites.some(
      (invite) => invite.status === 'PENDING'
    );
    if (hasReadyInvite) {
      // An invite is ready - clear the flag and redirect to family setup
      clearInviteeFlowFlag();
      router.push('/family-setup');
    }
  }, [pendingInvites, router]);

  return (
    <Card className="w-full max-w-md shadow-xl rounded-[20px]">
      <CardHeader className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-gradient-to-br from-[#B5179E] to-[#5518C1] rounded-[20px] flex items-center justify-center shadow-lg">
            <Clock className="w-8 h-8 text-white" />
          </div>
        </div>
        <div>
          <CardTitle>{t('waitingInvite.title', language)}</CardTitle>
          <CardDescription className="mt-2">
            {t('waitingInvite.description', language)}
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Pending Invites List */}
        {loading ? (
          <div className="text-center text-muted-foreground text-sm">
            {t('waitingInvite.loading', language)}
          </div>
        ) : hasPendingInvites ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t('waitingInvite.waitingFrom', language)}
            </p>
            {pendingInvites.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-muted/50"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#B5179E]/20 to-[#5518C1]/20 flex items-center justify-center">
                  <Users className="w-5 h-5 text-[#B5179E]" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">{invite.family.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('waitingInvite.invitedBy', language, {
                      name: invite.inviter.name,
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-muted-foreground text-sm p-4 rounded-xl bg-muted/30">
            {t('waitingInvite.noInvites', language)}
          </div>
        )}

        {/* Status Message */}
        <div className="text-center p-4 rounded-xl bg-indigo-50 border border-indigo-100">
          <p className="text-sm text-indigo-700">
            {t('waitingInvite.statusMessage', language)}
          </p>
        </div>

        {/* Check Status Button */}
        <div className="pt-2">
          <Button
            variant="outline"
            className="w-full rounded-xl h-11"
            onClick={() => refetch()}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            {t('waitingInvite.checkStatus', language)}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
