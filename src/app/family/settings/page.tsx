'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, UserPlus, Users, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { InviteMemberDialog } from '@/components/family/invite-member-dialog';
import { EmailBoundInviteDialog } from '@/components/family/email-bound-invite-dialog';
import { PendingInvitationsSection } from '@/components/family/pending-invitations-section';
import { useAuth } from '@/lib/contexts/auth-context';
import { useLanguage } from '@/lib/contexts/language-context';

export default function FamilySettingsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { language } = useLanguage();
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [emailInviteDialogOpen, setEmailInviteDialogOpen] = useState(false);

  if (!user?.activeFamily) {
    router.push('/family-setup');
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
            {/* Email-Bound Invite Section (Story 1.5) */}
            <div className="flex items-center justify-between p-4 border rounded-lg bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800">
              <div className="space-y-1">
                <h3 className="font-medium flex items-center gap-2">
                  <Mail className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  Email-Bound Invite
                </h3>
                <p className="text-sm text-muted-foreground">
                  Create a secure invite code for a specific email address
                </p>
              </div>
              <Button
                onClick={() => setEmailInviteDialogOpen(true)}
                className="gap-2"
                variant="outline"
              >
                <Mail className="w-4 h-4" />
                Create Invite
              </Button>
            </div>

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
        <PendingInvitationsSection familyId={activeFamily.id} />
      </div>

      {/* Encrypted Invite Dialog (Story 1.8) */}
      <InviteMemberDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        familyId={activeFamily.id}
        familyName={activeFamily.name}
      />

      {/* Email-Bound Invite Dialog (Story 1.5) */}
      <EmailBoundInviteDialog
        open={emailInviteDialogOpen}
        onOpenChange={setEmailInviteDialogOpen}
        familyName={activeFamily.name}
      />
    </div>
  );
}
