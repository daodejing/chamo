'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, UserPlus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { InviteMemberDialog } from '@/components/family/invite-member-dialog';
import { PendingInvitationsSection } from '@/components/family/pending-invitations-section';
import { useAuth } from '@/lib/contexts/auth-context';
import { useLanguage } from '@/lib/contexts/language-context';

function FamilySettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { language } = useLanguage();
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const autoCompleteEmail = searchParams.get('completeInvite');

  useEffect(() => {
    if (!user?.activeFamily) {
      router.push('/family-setup');
    }
  }, [user, router]);

  if (!user?.activeFamily) {
    return null;
  }

  const { activeFamily } = user;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/chat')}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Chat
          </Button>
        </div>

        {/* Family Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              {activeFamily.name}
            </CardTitle>
            <CardDescription>
              Family Settings and Member Management
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Encrypted Invite Section (Story 1.8) */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-1">
                <h3 className="font-medium">Encrypted Family Invite</h3>
                <p className="text-sm text-muted-foreground">
                  Send an encrypted invite to registered members
                </p>
              </div>
              <Button
                onClick={() => setInviteDialogOpen(true)}
                className="gap-2"
              >
                <UserPlus className="w-4 h-4" />
                Invite
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Pending Invitations */}
        <PendingInvitationsSection
          familyId={activeFamily.id}
          autoCompleteEmail={autoCompleteEmail}
        />
      </div>

      {/* Encrypted Invite Dialog (Story 1.8) */}
      <InviteMemberDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        familyId={activeFamily.id}
        familyName={activeFamily.name}
      />
    </div>
  );
}

export default function FamilySettingsPage() {
  return (
    <Suspense fallback={null}>
      <FamilySettingsContent />
    </Suspense>
  );
}
