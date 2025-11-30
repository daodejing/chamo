'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { UserPlus, Users, Mail } from 'lucide-react';
import { toast } from 'sonner';
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
import { MainHeader } from '@/components/main-header';
import { useAuth } from '@/lib/contexts/auth-context';
import { useLanguage } from '@/lib/contexts/language-context';
import { t } from '@/lib/translations';

function FamilySettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading, logout, switchActiveFamily } = useAuth();
  const { language } = useLanguage();
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [emailInviteDialogOpen, setEmailInviteDialogOpen] = useState(false);
  const autoCompleteEmail = searchParams.get('completeInvite');

  useEffect(() => {
    // Wait for auth loading to complete before checking activeFamily
    if (!loading && !user?.activeFamily) {
      router.push('/family-setup');
    }
  }, [user, loading, router]);

  const handleLogout = async () => {
    try {
      await logout();
      toast.success(t('toast.logoutSuccess', language));
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Logout failed');
    }
  };

  const handleSettingsClick = () => {
    router.push('/chat');
  };

  // Show nothing while loading or if no active family
  if (loading || !user?.activeFamily) {
    return null;
  }

  const { activeFamily } = user;
  // Member count not available on activeFamily - use maxMembers as fallback
  const memberCount = 0;

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Persistent Header */}
      <MainHeader
        familyName={activeFamily.name}
        familyAvatar={activeFamily.avatar ?? ''}
        memberCount={memberCount}
        currentView="family-settings"
        memberships={user.memberships ?? []}
        activeFamilyId={user.activeFamilyId ?? null}
        onSwitchFamily={switchActiveFamily}
        onChatClick={() => router.push('/chat')}
        onSettingsClick={handleSettingsClick}
        onLogoutClick={handleLogout}
        onInviteClick={() => setInviteDialogOpen(true)}
        language={language}
      />

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-gradient-to-br from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800 p-4">
        <div className="max-w-2xl mx-auto space-y-4">
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

              {/* Email-Bound Invite Section (Story 1.5/1.13) */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-1">
                  <h3 className="font-medium">{t('emailInvite.title', language)}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t('emailInvite.description', language, { familyName: activeFamily.name })}
                  </p>
                </div>
                <Button
                  onClick={() => setEmailInviteDialogOpen(true)}
                  className="gap-2"
                  variant="secondary"
                >
                  <Mail className="w-4 h-4" />
                  Email-Bound Invite
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
      </div>

      {/* Encrypted Invite Dialog (Story 1.8) */}
      <InviteMemberDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        familyId={activeFamily.id}
        familyName={activeFamily.name}
      />

      {/* Email-Bound Invite Dialog (Story 1.5/1.13) */}
      <EmailBoundInviteDialog
        open={emailInviteDialogOpen}
        onOpenChange={setEmailInviteDialogOpen}
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
