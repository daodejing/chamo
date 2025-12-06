'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/lib/contexts/auth-context';
import { useLanguage } from '@/lib/contexts/language-context';
import { t } from '@/lib/translations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useMutation, useLazyQuery } from '@apollo/client/react';
import {
  CreatePendingInviteDocument,
  CreateEncryptedInviteDocument,
  GetUserPublicKeyDocument,
} from '@/lib/graphql/generated/graphql';
import { encryptFamilyKeyForRecipient } from '@/lib/e2ee/invite-encryption';
import { getFamilyKeyBase64, generateInviteCode } from '@/lib/e2ee/key-management';
import { isInviteeFlowActive, clearInviteeFlowFlag } from '@/lib/invite/invitee-flow';
import { InviteLanguageSelector, type InviteLanguageCode } from '@/components/settings/invite-language-selector';

interface MemberInvite {
  email: string;
  language: InviteLanguageCode;
}

export default function FamilySetupPage() {
  const router = useRouter();
  const { createFamily, joinFamilyExisting, user } = useAuth();
  const { language } = useLanguage();

  const [createPendingInvite] = useMutation(CreatePendingInviteDocument);
  const [createEncryptedInvite] = useMutation(CreateEncryptedInviteDocument);
  const [getUserPublicKey] = useLazyQuery(GetUserPublicKeyDocument);

  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [showInviteeNotice, setShowInviteeNotice] = useState(false);

  // Default language for invites based on UI language
  const defaultInviteLanguage: InviteLanguageCode = language === 'ja' || language === 'en' ? language : 'en';

  // Create family state
  const [familyName, setFamilyName] = useState('');
  const [memberInvites, setMemberInvites] = useState<MemberInvite[]>([
    { email: '', language: defaultInviteLanguage }
  ]);
  const [inviteStatuses, setInviteStatuses] = useState<Record<string, { status: 'pending' | 'sending' | 'sent' | 'error', message?: string }>>({});

  // Join family state
  const [inviteCode, setInviteCode] = useState('');

  useEffect(() => {
    if (isInviteeFlowActive()) {
      setShowInviteeNotice(true);
    }
  }, []);

  // Helper functions for member invite management
  const addMemberInviteField = () => {
    setMemberInvites([...memberInvites, { email: '', language: defaultInviteLanguage }]);
  };

  const removeMemberInviteField = (index: number) => {
    const newInvites = memberInvites.filter((_, i) => i !== index);
    setMemberInvites(newInvites.length > 0 ? newInvites : [{ email: '', language: defaultInviteLanguage }]);
  };

  const updateMemberEmail = (index: number, value: string) => {
    const newInvites = [...memberInvites];
    newInvites[index] = { ...newInvites[index], email: value };
    setMemberInvites(newInvites);
  };

  const updateMemberLanguage = (index: number, value: InviteLanguageCode) => {
    const newInvites = [...memberInvites];
    newInvites[index] = { ...newInvites[index], language: value };
    setMemberInvites(newInvites);
  };

  const sendInvitesToMembers = async (familyId: string) => {
    if (!user) {
      toast.error(t('toast.notAuthenticated', language));
      return;
    }

    const inviterId = user.id;

    const validInvites = memberInvites.filter(invite => invite.email.trim() && invite.email.includes('@'));
    if (validInvites.length === 0) return;

    // Filter out the current user's email
    const currentUserEmail = user?.email?.toLowerCase();
    const filteredInvites = validInvites.filter(invite =>
      invite.email.trim().toLowerCase() !== currentUserEmail
    );

    if (filteredInvites.length === 0) {
      toast.info(t('familySetup.cannotInviteSelf', language));
      return;
    }

    for (const invite of filteredInvites) {
      const trimmedEmail = invite.email.trim();
      setInviteStatuses(prev => ({ ...prev, [trimmedEmail]: { status: 'sending' } }));

      try {
        const normalizedEmail = trimmedEmail.toLowerCase();
        const { data } = await getUserPublicKey({
          variables: { email: normalizedEmail },
        });
        const publicKey = data?.getUserPublicKey;

        if (publicKey) {
          const familyKeyBase64 = await getFamilyKeyBase64(familyId);
          if (!familyKeyBase64) {
            toast.error(t('toast.familyKeyNotFound', language));
            setInviteStatuses(prev => ({
              ...prev,
              [trimmedEmail]: { status: 'error', message: t('toast.familyKeyNotFound', language) },
            }));
            continue;
          }

          const { encryptedKey, nonce } = await encryptFamilyKeyForRecipient(
            familyKeyBase64,
            publicKey,
            inviterId
          );
          const inviteCodeGenerated = generateInviteCode();
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 7);

          await createEncryptedInvite({
            variables: {
              input: {
                familyId,
                inviteeEmail: normalizedEmail,
                encryptedFamilyKey: encryptedKey,
                nonce,
                inviteCode: inviteCodeGenerated,
                expiresAt: expiresAt.toISOString(),
              },
            },
          });
          setInviteStatuses(prev => ({
            ...prev,
            [trimmedEmail]: {
              status: 'sent',
              message: t('familySetup.inviteSent', language),
            },
          }));
          toast.success(
            t('toast.inviteCreated', language, {
              email: trimmedEmail,
            }),
          );
        } else {
          await createPendingInvite({
            variables: {
              input: {
                familyId,
                inviteeEmail: normalizedEmail,
                inviteeLanguage: invite.language,
              },
            },
          });
          setInviteStatuses(prev => ({
            ...prev,
            [trimmedEmail]: {
              status: 'sent',
              message: t('familySetup.registrationLinkSent', language),
            },
          }));
          toast.info(
            t('toast.pendingInviteCreated', language, {
              email: trimmedEmail,
            }),
          );
        }
      } catch (error) {
        console.error(`Failed to send invite to ${trimmedEmail}:`, error);
        setInviteStatuses(prev => ({
          ...prev,
          [trimmedEmail]: {
            status: 'error',
            message: t('familySetup.inviteFailed', language)
          }
        }));
      }
    }
  };

  const handleCreateFamily = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!familyName.trim()) {
      toast.error(t('toast.familyNameRequired', language));
      return;
    }

    setIsCreating(true);

    try {
      const result = await createFamily(familyName.trim());

      toast.success(t('toast.familyCreated', language));
      clearInviteeFlowFlag();
      setShowInviteeNotice(false);

      // Show invite code with encryption key for sharing (AC3: Admin receives invite code)
      if (result?.inviteCodeWithKey) {
        toast(result.inviteCodeWithKey, {
          duration: 30000, // Keep visible for 30 seconds for copying
          className: 'invite-code-toast',
        });
      }

      // Send invites to all specified members
      if (result?.family?.id) {
        await sendInvitesToMembers(result.family.id);
      }

      // Show summary of sent invites if any
      const validInvites = memberInvites.filter(invite => invite.email.trim() && invite.email.includes('@'));
      if (validInvites.length > 0) {
        toast.success(
          t('familySetup.invitesSummary', language, {
            count: validInvites.length,
          }),
        );
      }

      // Redirect to chat after a brief delay to show invite statuses
      setTimeout(() => {
        router.push('/chat');
      }, 3000);
    } catch (error) {
      console.error('Create family error:', error);
      toast.error(t('toast.familyCreationFailed', language));
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinFamily = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!inviteCode.trim()) {
      toast.error(t('toast.inviteCodeRequired', language));
      return;
    }

    setIsJoining(true);

    try {
      await joinFamilyExisting(inviteCode.trim());

      toast.success(t('toast.familyJoined', language));
      clearInviteeFlowFlag();

      // Redirect to chat
      router.push('/chat');
    } catch (error) {
      console.error('Join family error:', error);
      toast.error(t('toast.familyJoinFailed', language));
    } finally {
      setIsJoining(false);
    }
  };

  const dismissInviteeNotice = () => {
    clearInviteeFlowFlag();
    setShowInviteeNotice(false);
  };

  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [user, router]);

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-xl rounded-[20px]">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-gradient-to-br from-[#B5179E] to-[#5518C1] rounded-[20px] flex items-center justify-center shadow-lg">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
          <div>
            <CardTitle>{t('familySetup.title', language)}</CardTitle>
            <CardDescription>{t('familySetup.description', language)}</CardDescription>
          </div>
        </CardHeader>
       <CardContent>
          {showInviteeNotice && (
            <div className="mb-6 rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-900 space-y-3">
              <div>
                <p className="font-semibold">{t('familySetup.inviteeNoticeTitle', language)}</p>
                <p className="text-sm mt-1">{t('familySetup.inviteeNoticeBody', language)}</p>
              </div>
              <div className="flex flex-col gap-2">
                <Button variant="outline" onClick={dismissInviteeNotice}>
                  {t('familySetup.inviteeNoticeWait', language)}
                </Button>
                <Button onClick={dismissInviteeNotice}>
                  {t('familySetup.inviteeNoticeCreate', language)}
                </Button>
              </div>
            </div>
          )}
          <Tabs defaultValue="create" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="create">{t('familySetup.createTab', language)}</TabsTrigger>
              <TabsTrigger value="join">{t('familySetup.joinTab', language)}</TabsTrigger>
            </TabsList>

            <TabsContent value="create">
              <form onSubmit={handleCreateFamily} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="familyName">
                      {t('familySetup.familyNameLabel', language)}
                    </Label>
                    <Input
                      id="familyName"
                      type="text"
                      placeholder={t('familySetup.familyNamePlaceholder', language)}
                      value={familyName}
                      onChange={(e) => setFamilyName(e.target.value)}
                      disabled={isCreating}
                      required
                      className="rounded-xl"
                    />
                  </div>

                  {/* Member Email Inputs with Language Selector */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>{t('familySetup.inviteMembersLabel', language)}</Label>
                      <span className="text-xs text-muted-foreground">
                        {t('familySetup.optional', language)}
                      </span>
                    </div>
                    <div className="space-y-3">
                      {memberInvites.map((invite, index) => (
                        <div key={index} className="space-y-2 p-3 rounded-xl bg-muted/50">
                          <div className="flex gap-2">
                            <div className="flex-1 relative">
                              <Input
                                type="email"
                                placeholder={t('familySetup.memberEmailPlaceholder', language)}
                                value={invite.email}
                                onChange={(e) => updateMemberEmail(index, e.target.value)}
                                disabled={isCreating}
                                className="rounded-xl pr-8"
                              />
                              {inviteStatuses[invite.email.trim()] && (
                                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                  {inviteStatuses[invite.email.trim()].status === 'sending' && (
                                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                                  )}
                                  {inviteStatuses[invite.email.trim()].status === 'sent' && (
                                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                                  )}
                                  {inviteStatuses[invite.email.trim()].status === 'error' && (
                                    <AlertCircle className="w-4 h-4 text-red-500" />
                                  )}
                                </div>
                              )}
                            </div>
                            {memberInvites.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeMemberInviteField(index)}
                                disabled={isCreating}
                                className="rounded-xl"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Label className="text-xs text-muted-foreground shrink-0">
                              {t('emailInvite.languageLabel', language)}:
                            </Label>
                            <div className="flex-1">
                              <InviteLanguageSelector
                                value={invite.language}
                                onValueChange={(value) => updateMemberLanguage(index, value)}
                                disabled={isCreating}
                                currentUiLanguage={language}
                              />
                            </div>
                          </div>
                          {inviteStatuses[invite.email.trim()]?.message && (
                            <p className="text-xs text-muted-foreground">
                              {inviteStatuses[invite.email.trim()].message}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addMemberInviteField}
                      disabled={isCreating}
                      className="w-full rounded-xl"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      {t('familySetup.addAnotherMember', language)}
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      {t('familySetup.inviteMembersHelp', language)}
                    </p>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-[#B5179E] to-[#8B38BA] hover:from-[#9c1487] hover:to-[#7a2fa5] text-white rounded-[20px] h-12 shadow-lg"
                    disabled={isCreating}
                  >
                    {isCreating
                      ? t('familySetup.creating', language)
                      : t('familySetup.createFamily', language)}
                  </Button>
                </form>
            </TabsContent>

            <TabsContent value="join">
              <form onSubmit={handleJoinFamily} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="inviteCode">
                    {t('familySetup.inviteCodeLabel', language)}
                  </Label>
                  <Input
                    id="inviteCode"
                    type="text"
                    placeholder={t('familySetup.inviteCodePlaceholder', language)}
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    disabled={isJoining}
                    required
                    className="rounded-xl"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('familySetup.inviteCodeHelp', language)}
                  </p>
                </div>
                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-[#B5179E] to-[#8B38BA] hover:from-[#9c1487] hover:to-[#7a2fa5] text-white rounded-[20px] h-12 shadow-lg"
                  disabled={isJoining}
                >
                  {isJoining
                    ? t('familySetup.joining', language)
                    : t('familySetup.joinFamily', language)}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
        <CardFooter className="flex justify-center">
          <button
            type="button"
            onClick={() => router.push('/login')}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {t('familySetup.backToLogin', language)}
          </button>
        </CardFooter>
      </Card>
    </div>
  );
}
