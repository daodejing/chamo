'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { SettingsScreen } from '@/components/settings-screen';
import { useAuth } from '@/lib/contexts/auth-context';
import { useLanguage } from '@/lib/contexts/language-context';
import { useQuery, useMutation } from '@apollo/client/react';
import { GET_FAMILY_MEMBERS_QUERY, REMOVE_FAMILY_MEMBER_MUTATION, PROMOTE_TO_ADMIN_MUTATION, DELETE_FAMILY_MUTATION, DEREGISTER_SELF_MUTATION } from '@/lib/graphql/operations';
import { useChannels } from '@/lib/hooks/use-channels';
import { t } from '@/lib/translations';
import type { TranslationLanguage } from '@/components/settings/translation-language-selector';
import { DEFAULT_TRANSLATION_LANGUAGE, isSupportedTranslationLanguage } from '@/lib/translation/languages';
import type {
  RemoveFamilyMemberMutation,
  RemoveFamilyMemberMutationVariables,
  GetFamilyMembersQuery,
  GetFamilyMembersQueryVariables,
  PromoteToAdminMutation,
  PromoteToAdminMutationVariables,
  DeleteFamilyMutation,
  DeleteFamilyMutationVariables,
  DeregisterSelfMutation,
  DeregisterSelfMutationVariables,
} from '@/lib/graphql/generated/graphql';

type SettingsFamilyMember = {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: 'admin' | 'member';
  joinedAt: string;
};

type SettingsChannel = {
  id: string;
  name: string;
  description: string;
  icon: string;
  createdAt: string;
  createdBy: string;
};

export default function SettingsPage() {
  const router = useRouter();
  const { user, family, loading: authLoading, logout } = useAuth();
  const { language } = useLanguage();

  // Settings state
  const [settingsFamilyName, setSettingsFamilyName] = useState(family?.name ?? '');
  const [settingsFamilyAvatar, setSettingsFamilyAvatar] = useState(family?.avatar ?? '');
  const [settingsMaxMembers, setSettingsMaxMembers] = useState(family?.maxMembers ?? 10);
  const [settingsFamilyMembers, setSettingsFamilyMembers] = useState<SettingsFamilyMember[]>([]);
  const [settingsChannels, setSettingsChannels] = useState<SettingsChannel[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [fontSize, setFontSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
  const [quietHoursStart, setQuietHoursStart] = useState('22:00');
  const [quietHoursEnd, setQuietHoursEnd] = useState('07:00');
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [autoSync, setAutoSync] = useState(false);
  const [preferredTranslationLanguage, setPreferredTranslationLanguage] =
    useState<TranslationLanguage>(DEFAULT_TRANSLATION_LANGUAGE);
  const [showAbout, setShowAbout] = useState(false);

  const hasFamily = !!family;

  // Queries - only run when user has a family
  const { data: familyMembersData } = useQuery<GetFamilyMembersQuery, GetFamilyMembersQueryVariables>(
    GET_FAMILY_MEMBERS_QUERY,
    {
      variables: { familyId: family?.id ?? '' },
      skip: !family?.id,
    }
  );

  const { channels } = useChannels();

  // Mutations
  const [removeFamilyMember] = useMutation<RemoveFamilyMemberMutation, RemoveFamilyMemberMutationVariables>(
    REMOVE_FAMILY_MEMBER_MUTATION
  );
  const [promoteToAdmin] = useMutation<PromoteToAdminMutation, PromoteToAdminMutationVariables>(
    PROMOTE_TO_ADMIN_MUTATION
  );
  const [deleteFamily] = useMutation<DeleteFamilyMutation, DeleteFamilyMutationVariables>(
    DELETE_FAMILY_MUTATION
  );
  const [deregisterSelf] = useMutation<DeregisterSelfMutation, DeregisterSelfMutationVariables>(
    DEREGISTER_SELF_MUTATION
  );

  // Determine admin status from user's membership in the active family
  const isAdmin = user?.memberships?.find(m => m.familyId === family?.id)?.role === 'ADMIN' || false;

  // Update family members when data changes
  useEffect(() => {
    if (familyMembersData?.getFamilyMembers) {
      const members: SettingsFamilyMember[] = familyMembersData.getFamilyMembers.map((m) => ({
        id: m.id,
        name: m.name,
        email: m.email,
        avatar: m.avatar ?? '',
        role: m.role.toLowerCase() as 'admin' | 'member',
        joinedAt: m.joinedAt,
      }));
      setSettingsFamilyMembers(members);
    }
  }, [familyMembersData]);

  // Update channels when data changes
  useEffect(() => {
    if (channels) {
      const settingsChannelData: SettingsChannel[] = channels.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description ?? '',
        icon: c.icon ?? '💬',
        createdAt: c.createdAt ?? new Date().toISOString(),
        createdBy: c.createdById ?? '',
      }));
      setSettingsChannels(settingsChannelData);
    }
  }, [channels]);

  // Update family settings when family changes
  useEffect(() => {
    if (family) {
      setSettingsFamilyName(family.name);
      setSettingsFamilyAvatar(family.avatar ?? '');
      setSettingsMaxMembers(family.maxMembers ?? 10);
    }
  }, [family]);

  // Load dark mode from localStorage
  useEffect(() => {
    const darkMode = localStorage.getItem('darkMode') === 'true';
    setIsDarkMode(darkMode);
    if (darkMode) {
      document.documentElement.classList.add('dark');
    }
  }, []);

  // Load preferred translation language
  useEffect(() => {
    const stored = localStorage.getItem('preferredTranslationLanguage');
    if (stored && isSupportedTranslationLanguage(stored)) {
      setPreferredTranslationLanguage(stored);
    }
  }, []);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  if (authLoading || !user) {
    return null;
  }

  const handleBack = () => {
    router.back();
  };

  const handleThemeToggle = () => {
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);
    localStorage.setItem('darkMode', String(newDarkMode));
    if (newDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handlePreferredTranslationLanguageChange = (lang: TranslationLanguage) => {
    setPreferredTranslationLanguage(lang);
    localStorage.setItem('preferredTranslationLanguage', lang);
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!family) return;
    try {
      await removeFamilyMember({
        variables: { input: { familyId: family.id, userId: memberId } },
      });
      toast.success(t('toast.memberRemoved', language));
      setSettingsFamilyMembers((prev) => prev.filter((m) => m.id !== memberId));
    } catch (error) {
      console.error('Remove member error:', error);
      toast.error(t('toast.error', language));
    }
  };

  const handlePromoteMember = async (memberId: string) => {
    if (!family) return;
    try {
      await promoteToAdmin({
        variables: { input: { familyId: family.id, userId: memberId } },
      });
      toast.success(t('toast.memberPromoted', language));
      setSettingsFamilyMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role: 'admin' as const } : m))
      );
    } catch (error) {
      console.error('Promote member error:', error);
      toast.error(t('toast.error', language));
    }
  };

  const handleDeleteFamily = async () => {
    if (!family) return;
    try {
      await deleteFamily({ variables: { input: { familyId: family.id } } });
      toast.success(t('toast.familyDeleted', language));
      router.push('/family-setup');
    } catch (error) {
      console.error('Delete family error:', error);
      toast.error(t('toast.error', language));
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await deregisterSelf();
      toast.success(t('settings.deleteAccountSuccess', language));
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('Delete account error:', error);
      toast.error(t('toast.error', language));
    }
  };

  const handleCreateChannel = (channel: SettingsChannel) => {
    setSettingsChannels((prev) => [...prev, channel]);
    toast.success(t('toast.channelCreated', language));
  };

  const handleDeleteChannel = (channelId: string) => {
    setSettingsChannels((prev) => prev.filter((c) => c.id !== channelId));
    toast.success(t('toast.channelDeleted', language));
  };

  const handleConnectGoogle = () => {
    toast.info(t('settings.googleCalendarComingSoon', language));
  };

  const handleDisconnectGoogle = () => {
    setGoogleConnected(false);
    setGoogleEmail(null);
    toast.success(t('settings.googleDisconnected', language));
  };

  const handleSyncGoogle = () => {
    setLastSyncTime(new Date());
    toast.success(t('settings.googleSynced', language));
  };

  return (
    <SettingsScreen
      userName={user.name}
      userEmail={user.email}
      userAvatar={user.avatar ?? ''}
      // Family props - optional, passed only when user has a family
      familyName={hasFamily ? settingsFamilyName : undefined}
      familyAvatar={hasFamily ? settingsFamilyAvatar : undefined}
      familyMembers={hasFamily ? settingsFamilyMembers : undefined}
      maxMembers={hasFamily ? settingsMaxMembers : undefined}
      channels={hasFamily ? settingsChannels : undefined}
      inviteCode={hasFamily ? family?.inviteCode ?? '' : undefined}
      familyId={family?.id}
      currentUserRole={isAdmin ? 'admin' : 'member'}
      // Settings props
      isDarkMode={isDarkMode}
      fontSize={fontSize}
      language={language}
      quietHoursEnabled={quietHoursEnabled}
      quietHoursStart={quietHoursStart}
      quietHoursEnd={quietHoursEnd}
      googleConnected={googleConnected}
      googleEmail={googleEmail}
      lastSyncTime={lastSyncTime}
      autoSync={autoSync}
      preferredTranslationLanguage={preferredTranslationLanguage}
      // Callbacks
      onBack={handleBack}
      onDeleteAccount={handleDeleteAccount}
      onThemeToggle={handleThemeToggle}
      onFontSizeChange={setFontSize}
      onFamilyNameChange={hasFamily ? setSettingsFamilyName : undefined}
      onFamilyAvatarChange={hasFamily ? setSettingsFamilyAvatar : undefined}
      onMaxMembersChange={hasFamily ? setSettingsMaxMembers : undefined}
      onQuietHoursToggle={setQuietHoursEnabled}
      onQuietHoursStartChange={setQuietHoursStart}
      onQuietHoursEndChange={setQuietHoursEnd}
      onRemoveMember={hasFamily ? handleRemoveMember : undefined}
      onPromoteMember={hasFamily ? handlePromoteMember : undefined}
      onDeleteFamily={hasFamily && isAdmin ? handleDeleteFamily : undefined}
      onCreateChannel={hasFamily ? handleCreateChannel : undefined}
      onDeleteChannel={hasFamily ? handleDeleteChannel : undefined}
      onConnectGoogle={handleConnectGoogle}
      onDisconnectGoogle={handleDisconnectGoogle}
      onSyncGoogle={handleSyncGoogle}
      onAutoSyncToggle={setAutoSync}
      onPreferredTranslationLanguageChange={handlePreferredTranslationLanguageChange}
      showAbout={showAbout}
      onAboutOpen={() => setShowAbout(true)}
      onAboutClose={() => setShowAbout(false)}
    />
  );
}
