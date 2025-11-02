/**
 * Chat Page (Story 2.1)
 * Main chat screen with channel selection, message list, and E2EE messaging
 * Uses the professional prototype ChatScreen component
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ChatScreen } from '@/components/chat-screen';
import { SettingsScreen } from '@/components/settings-screen';
import { useMessages, useSendMessage, useEditMessage, useDeleteMessage, useMessageSubscription } from '@/lib/hooks/use-messages';
import { useChannels } from '@/lib/hooks/use-channels';
import { useAuth } from '@/lib/contexts/auth-context';
import { useLanguage } from '@/lib/contexts/language-context';
import { encryptMessage, decryptMessage } from '@/lib/e2ee/encryption';
import { getFamilyKey } from '@/lib/e2ee/key-management';
import { t } from '@/lib/translations';
import { formatDateTime } from '@/lib/utils/date-format';
import type { TranslationLanguage } from '@/components/settings/translation-language-selector';

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

const SUPPORTED_TRANSLATION_LANGUAGES: TranslationLanguage[] = [
  'en',
  'ja',
  'es',
  'fr',
  'de',
  'zh',
  'ko',
  'pt',
  'ru',
  'ar',
  'it',
  'nl',
  'pl',
  'tr',
  'vi',
  'th',
  'id',
  'hi',
  'sv',
  'no',
];

const isSupportedTranslationLanguage = (value: unknown): value is TranslationLanguage => {
  return typeof value === 'string' && SUPPORTED_TRANSLATION_LANGUAGES.includes(value as TranslationLanguage);
};

export default function ChatPage() {
  const router = useRouter();
  const { user, family, loading: authLoading, logout } = useAuth();
  const { language } = useLanguage();

  // State
  const [currentChannelId, setCurrentChannelId] = useState<string | null>(null);
  const [displayMessages, setDisplayMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [familyKey, setFamilyKey] = useState<CryptoKey | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsFamilyName, setSettingsFamilyName] = useState(family?.name ?? '');
  const [settingsFamilyAvatar, setSettingsFamilyAvatar] = useState(family?.avatar ?? '');
  const [settingsMaxMembers, setSettingsMaxMembers] = useState(family?.maxMembers ?? 0);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [fontSize, setFontSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
  const [quietHoursStart, setQuietHoursStart] = useState('22:00');
  const [quietHoursEnd, setQuietHoursEnd] = useState('07:00');
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [autoSync, setAutoSync] = useState(false);
  const [preferredTranslationLanguage, setPreferredTranslationLanguage] = useState<TranslationLanguage>('en');
  const [settingsChannels, setSettingsChannels] = useState<SettingsChannel[]>([]);
  const [settingsFamilyMembers, setSettingsFamilyMembers] = useState<SettingsFamilyMember[]>([]);

  // GraphQL hooks
  const { channels, loading: channelsLoading } = useChannels();
  const { messages: rawMessages, loading: messagesLoading } = useMessages({
    channelId: currentChannelId || '',
  });
  const { send } = useSendMessage();
  const { edit } = useEditMessage();
  const { remove } = useDeleteMessage();

  // Subscribe to real-time updates
  const { messageAdded, messageEdited, messageDeleted } = useMessageSubscription(currentChannelId || '');

  // Sync settings data when panel is open and source data changes
  useEffect(() => {
    if (!isSettingsOpen) {
      return;
    }

    const nextFamilyName = family?.name ?? '';
    const nextFamilyAvatar = family?.avatar ?? '';
    const nextMaxMembers = family?.maxMembers ?? 0;

    setSettingsFamilyName((prev) => (prev === nextFamilyName ? prev : nextFamilyName));
    setSettingsFamilyAvatar((prev) => (prev === nextFamilyAvatar ? prev : nextFamilyAvatar));
    setSettingsMaxMembers((prev) => (prev === nextMaxMembers ? prev : nextMaxMembers));
  }, [isSettingsOpen, family?.name, family?.avatar, family?.maxMembers]);

  useEffect(() => {
    if (!isSettingsOpen) {
      return;
    }

    if (!user) {
      setSettingsFamilyMembers((prev) => (prev.length === 0 ? prev : []));
      return;
    }

    setSettingsFamilyMembers((prev) => {
      const joinedAt =
        prev[0]?.joinedAt ??
        (typeof (user as any)?.createdAt === 'string'
          ? (user as any).createdAt
          : new Date().toISOString());

      const nextMembers: SettingsFamilyMember[] = [
        {
          id: user.id,
          name: user.name,
          email: user.email,
          avatar: user.avatar ?? '',
          role: user.role?.toUpperCase() === 'ADMIN' ? 'admin' : 'member',
          joinedAt,
        },
      ];

      if (prev.length === nextMembers.length && prev.every((member, index) => {
        const next = nextMembers[index];
        return (
          member.id === next.id &&
          member.name === next.name &&
          member.email === next.email &&
          member.avatar === next.avatar &&
          member.role === next.role
        );
      })) {
        return prev;
      }
      return nextMembers;
    });
  }, [isSettingsOpen, user?.id, user?.name, user?.email, user?.avatar, user?.role]);

  useEffect(() => {
    if (!isSettingsOpen) {
      return;
    }

    setSettingsChannels((prev) => {
      const nextChannels: SettingsChannel[] = (channels || []).map((channel, index) => ({
        id: channel.id,
        name: channel.name,
        description: channel.description ?? '',
        icon: channel.icon ?? '💬',
        createdAt: channel.createdAt
          ? new Date(channel.createdAt).toISOString()
          : prev[index]?.createdAt ?? '',
        createdBy: channel.createdById || 'system',
      }));

      if (
        prev.length === nextChannels.length &&
        prev.every((channel, index) => {
          const next = nextChannels[index];
          return (
            channel.id === next.id &&
            channel.name === next.name &&
            channel.description === next.description &&
            channel.icon === next.icon &&
            channel.createdAt === next.createdAt &&
            channel.createdBy === next.createdBy
          );
        })
      ) {
        return prev;
      }
      return nextChannels;
    });
  }, [isSettingsOpen, channels]);

  useEffect(() => {
    const preferred = user?.preferences?.preferredLanguage;
    if (isSupportedTranslationLanguage(preferred)) {
      setPreferredTranslationLanguage(preferred);
    }
  }, [user?.preferences?.preferredLanguage]);

  // Initialize: Check auth and load family key
  useEffect(() => {
    const initialize = async () => {
      if (authLoading) return;

      if (!user) {
        toast.error('Please log in to access chat');
        router.push('/login');
        return;
      }

      // Load family key from IndexedDB
      const key = await getFamilyKey();
      if (!key) {
        // TODO: Implement proper family key distribution from backend
        // For now, just show a warning and allow access without encryption
        console.warn('[ChatPage] Family key not found in IndexedDB. E2EE will not work.');
        toast.error('Encryption key missing. Messages will not be encrypted.');
        // Continue without key - this allows chat to load
      } else {
        setFamilyKey(key);
      }
      setLoading(false);
    };

    initialize();
  }, [user, authLoading, router]);

  // Select default channel when channels load
  useEffect(() => {
    if (channelsLoading || channels.length === 0 || currentChannelId) return;

    // Select default channel (first one, usually "General")
    const defaultChannel = channels.find((c) => c.isDefault) || channels[0];
    if (defaultChannel) {
      setCurrentChannelId(defaultChannel.id);
    } else {
      toast.error('No channels available');
    }
  }, [channels, channelsLoading, currentChannelId]);

  // Decrypt messages when raw messages change
  useEffect(() => {
    if (!rawMessages || rawMessages.length === 0) {
      if (displayMessages.length > 0) {
        setDisplayMessages([]);
      }
      return;
    }

    const decryptMessages = async () => {
      const decrypted = await Promise.all(
        rawMessages.map(async (msg) => {
          try {
            // If no family key, show encrypted content as placeholder
            const plaintext = familyKey
              ? await decryptMessage(msg.encryptedContent, familyKey)
              : '[Encrypted - Key Missing]';

            return {
              id: msg.id,
              userId: msg.userId,
              userName: msg.user.name,
              userAvatar: msg.user.avatar || '',
              message: plaintext,
              translation: '', // TODO: Add translation support
              timestamp: formatDateTime(msg.timestamp, language),
              isMine: msg.userId === user?.id,
              isEdited: msg.isEdited,
            };
          } catch (error) {
            console.error('Failed to decrypt message:', error);
            return {
              id: msg.id,
              userId: msg.userId,
              userName: msg.user.name,
              userAvatar: msg.user.avatar || '',
              message: '[Decryption Failed]',
              translation: '',
              timestamp: formatDateTime(msg.timestamp, language),
              isMine: msg.userId === user?.id,
              isEdited: msg.isEdited,
            };
          }
        })
      );

      // Use query result as source of truth, removing any temp optimistic messages
      setDisplayMessages(decrypted);
    };

    decryptMessages();
  }, [rawMessages, familyKey, user]);

  // Handle real-time message added
  useEffect(() => {
    if (!messageAdded || !familyKey) return;

    const processNewMessage = async () => {
      try {
        const plaintext = await decryptMessage(messageAdded.encryptedContent, familyKey);

        const newMessage = {
          id: messageAdded.id,
          userId: messageAdded.userId,
          userName: messageAdded.user.name,
          userAvatar: messageAdded.user.avatar || '',
          message: plaintext,
          translation: '',
          timestamp: formatDateTime(messageAdded.timestamp, language),
          isMine: messageAdded.userId === user?.id,
          isEdited: messageAdded.isEdited,
        };

        setDisplayMessages((prev) => {
          // Avoid duplicates - check if message already exists
          const exists = prev.some((m) => m.id === newMessage.id);
          if (exists) {
            console.log('[Subscription] Skipping duplicate message:', newMessage.id);
            return prev;
          }
          console.log('[Subscription] Adding new message:', newMessage.id);
          return [...prev, newMessage];
        });
      } catch (error) {
        console.error('Failed to process new message:', error);
      }
    };

    processNewMessage();
  }, [messageAdded, familyKey, user]);

  // Handle real-time message edited
  useEffect(() => {
    if (!messageEdited || !familyKey) return;

    const processEditedMessage = async () => {
      try {
        const plaintext = await decryptMessage(messageEdited.encryptedContent, familyKey);

        setDisplayMessages((prev) =>
          prev.map((m) =>
            m.id === messageEdited.id
              ? {
                  ...m,
                  message: plaintext,
                  isEdited: messageEdited.isEdited,
                }
              : m
          )
        );
      } catch (error) {
        console.error('Failed to process edited message:', error);
      }
    };

    processEditedMessage();
  }, [messageEdited, familyKey]);

  // Handle real-time message deleted
  useEffect(() => {
    if (!messageDeleted) return;

    setDisplayMessages((prev) => prev.filter((m) => m.id !== messageDeleted.messageId));
  }, [messageDeleted]);

  // Handler: Send message
  const handleSendMessage = async (message: string) => {
    if (!currentChannelId || sending || !user) return;

    if (!familyKey) {
      toast.error('Cannot send messages: Encryption key missing. Please log in again.');
      return;
    }

    try {
      setSending(true);

      // Encrypt message
      const encryptedContent = await encryptMessage(message, familyKey);

      // Optimistically add message to UI
      const optimisticMessage = {
        id: `temp-${Date.now()}`,
        userId: user.id,
        userName: user.name,
        userAvatar: user.avatar || '',
        message: message,
        translation: '',
        timestamp: formatDateTime(new Date(), language),
        isMine: true,
        isEdited: false,
      };

      setDisplayMessages((prev) => [...prev, optimisticMessage]);

      // Send via GraphQL
      await send(currentChannelId, encryptedContent);

      // Query will refetch and replace the optimistic message automatically
    } catch (error) {
      console.error('Send message error:', error);
      toast.error('Failed to send message');
      // Remove optimistic message on error
      setDisplayMessages((prev) => prev.filter((m) => !m.id.startsWith('temp-')));
    } finally {
      setSending(false);
    }
  };

  // Handler: Edit message
  const handleEditMessage = async (messageId: string, newText: string) => {
    if (!familyKey) {
      toast.error('Cannot edit messages: Encryption key missing.');
      return;
    }

    try {
      // Encrypt new content
      const encryptedContent = await encryptMessage(newText, familyKey);

      await edit(messageId, encryptedContent);

      // Update local state optimistically
      setDisplayMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? {
                ...m,
                message: newText,
                isEdited: true,
              }
            : m
        )
      );

      toast.success('Message edited');
    } catch (error) {
      console.error('Edit message error:', error);
      toast.error('Failed to edit message');
    }
  };

  // Handler: Delete message
  const handleDeleteMessage = async (messageId: string) => {
    try {
      await remove(messageId);

      // Remove from local state
      setDisplayMessages((prev) => prev.filter((m) => m.id !== messageId));
      toast.success('Message deleted');
    } catch (error) {
      console.error('Delete message error:', error);
      toast.error('Failed to delete message');
    }
  };

  // Handler: Schedule message
  const handleScheduleMessage = async (message: string, scheduledTime: Date) => {
    // TODO: Implement scheduled messages in backend
    toast.info('Scheduled messages will be implemented soon!');
  };

  // Handler: Cancel scheduled message
  const handleCancelScheduledMessage = async (messageId: string) => {
    // TODO: Implement in backend
    toast.info('Cancel scheduled messages will be implemented soon!');
  };

  // Handler: Channel change
  const handleChannelChange = (channelId: string) => {
    setCurrentChannelId(channelId);
    setDisplayMessages([]); // Clear messages when switching channels
  };

  // Handler: Settings click
  const handleSettingsClick = () => {
    setIsSettingsOpen(true);
  };

  const handleCloseSettings = () => {
    setIsSettingsOpen(false);
  };

  // Handler: Logout click
  const handleLogoutClick = async () => {
    try {
      setIsSettingsOpen(false);
      await logout();
      toast.success(t('toast.logoutSuccess', language));
      // Redirect to login page after logout
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Logout failed');
    }
  };

  const handleFamilyNameChange = (name: string) => {
    setSettingsFamilyName(name);
  };

  const handleFamilyAvatarChange = (avatar: string) => {
    setSettingsFamilyAvatar(avatar);
  };

  const handleMaxMembersChange = (max: number) => {
    setSettingsMaxMembers(max);
  };

  const handleQuietHoursToggle = (enabled: boolean) => {
    setQuietHoursEnabled(enabled);
  };

  const handleQuietHoursStartChange = (time: string) => {
    setQuietHoursStart(time);
  };

  const handleQuietHoursEndChange = (time: string) => {
    setQuietHoursEnd(time);
  };

  const handleRemoveMember = (memberId: string) => {
    setSettingsFamilyMembers((prev) => prev.filter((member) => member.id !== memberId));
    toast.success(t('toast.memberRemoved', language));
  };

  const handleCreateChannel = (channel: SettingsChannel) => {
    setSettingsChannels((prev) => [...prev, channel]);
    toast.success(t('toast.channelCreated', language, { name: channel.name }));
  };

  const handleDeleteChannel = (channelId: string) => {
    setSettingsChannels((prev) => prev.filter((channel) => channel.id !== channelId));
    toast.success(t('toast.channelDeleted', language));
  };

  const handleConnectGoogle = () => {
    setGoogleConnected(true);
    setGoogleEmail(user?.email ?? null);
    setLastSyncTime(new Date());
    toast.success(t('toast.googleConnected', language));
  };

  const handleDisconnectGoogle = () => {
    setGoogleConnected(false);
    setGoogleEmail(null);
    toast.success(t('toast.googleDisconnected', language));
  };

  const handleSyncGoogle = () => {
    if (!googleConnected) {
      toast.error(t('toast.syncError', language));
      return;
    }

    setLastSyncTime(new Date());
    toast.success(t('toast.syncSuccess', language, { count: '0' }));
  };

  const handleThemeToggle = () => {
    setIsDarkMode((prev) => !prev);
  };

  const handleFontSizeChange = (size: 'small' | 'medium' | 'large') => {
    setFontSize(size);
  };

  const handleAutoSyncToggle = (enabled: boolean) => {
    setAutoSync(enabled);
    if (enabled) {
      toast.info(t('toast.syncing', language));
    }
  };

  const handlePreferredTranslationLanguageChange = (lang: TranslationLanguage) => {
    setPreferredTranslationLanguage(lang);
  };

  // Handler: Add calendar event
  const handleAddEvent = (event: any) => {
    toast.info('Calendar events will be implemented soon!');
  };

  // Handler: Edit calendar event
  const handleEditEvent = (eventId: string, event: any) => {
    toast.info('Calendar events will be implemented soon!');
  };

  // Handler: Delete calendar event
  const handleDeleteEvent = (eventId: string) => {
    toast.info('Calendar events will be implemented soon!');
  };

  // Handler: Add photo
  const handleAddPhoto = (photo: any) => {
    toast.info('Photo gallery will be implemented soon!');
  };

  // Handler: Delete photo
  const handleDeletePhoto = (photoId: string) => {
    toast.info('Photo gallery will be implemented soon!');
  };

  // Handler: Like photo
  const handleLikePhoto = (photoId: string, userId: string) => {
    toast.info('Photo likes will be implemented soon!');
  };

  // Handler: Add photo comment
  const handleAddPhotoComment = (photoId: string, comment: any) => {
    toast.info('Photo comments will be implemented soon!');
  };

  // Handler: Create folder
  const handleCreateFolder = (folder: any) => {
    toast.info('Photo folders will be implemented soon!');
  };

  // Handler: Delete folder
  const handleDeleteFolder = (folderId: string) => {
    toast.info('Photo folders will be implemented soon!');
  };

  // Handler: Rename folder
  const handleRenameFolder = (folderId: string, newName: string) => {
    toast.info('Photo folders will be implemented soon!');
  };

  // Handler: Move photo to folder
  const handleMovePhotoToFolder = (photoId: string, folderId: string) => {
    toast.info('Photo folders will be implemented soon!');
  };

  // Transform channels to ChatScreen format
  const transformedChannels = useMemo(
    () =>
      channels.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description || '',
        icon: '💬',
        createdAt: new Date(c.createdAt || new Date()).toISOString(),
        createdBy: c.createdById || 'system',
      })),
    [channels]
  );

  // Get family info
  const familyName = settingsFamilyName || family?.name || 'Loading...';
  const familyAvatar = settingsFamilyAvatar || family?.avatar || '';
  const familyMemberCount = settingsFamilyMembers.length || 0;

  if (authLoading || (loading && !currentChannelId)) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading chat...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <ChatScreen
        chatName={familyName}
        chatAvatar={familyAvatar}
        chatMembers={familyMemberCount}
        messages={displayMessages}
        channels={transformedChannels}
        currentChannelId={currentChannelId || ''}
        scheduledMessages={[]}
        calendarEvents={[]}
        photos={[]}
        photoFolders={[]}
        familyMembers={settingsFamilyMembers}
        currentUserId={user?.id || ''}
        currentUserName={user?.name || ''}
        language={language}
        onSettingsClick={handleSettingsClick}
        onLogoutClick={handleLogoutClick}
        onChannelChange={handleChannelChange}
        onSendMessage={handleSendMessage}
        onScheduleMessage={handleScheduleMessage}
        onDeleteMessage={handleDeleteMessage}
        onEditMessage={handleEditMessage}
        onCancelScheduledMessage={handleCancelScheduledMessage}
        onAddEvent={handleAddEvent}
        onEditEvent={handleEditEvent}
        onDeleteEvent={handleDeleteEvent}
        onAddPhoto={handleAddPhoto}
        onDeletePhoto={handleDeletePhoto}
        onLikePhoto={handleLikePhoto}
        onAddPhotoComment={handleAddPhotoComment}
        onCreateFolder={handleCreateFolder}
        onDeleteFolder={handleDeleteFolder}
        onRenameFolder={handleRenameFolder}
        onMovePhotoToFolder={handleMovePhotoToFolder}
      />

      {isSettingsOpen && user && (
        <div className="fixed inset-0 z-50 bg-background">
          <SettingsScreen
            userName={user.name}
            userEmail={user.email}
            userAvatar={user.avatar ?? ''}
            familyName={settingsFamilyName || familyName}
            familyAvatar={settingsFamilyAvatar || familyAvatar}
            familyMembers={settingsFamilyMembers}
            maxMembers={settingsMaxMembers}
            channels={settingsChannels}
            inviteCode={family?.inviteCode ?? ''}
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
            onBack={handleCloseSettings}
            onLogout={handleLogoutClick}
            onThemeToggle={handleThemeToggle}
            onFontSizeChange={handleFontSizeChange}
            onFamilyNameChange={handleFamilyNameChange}
            onFamilyAvatarChange={handleFamilyAvatarChange}
            onMaxMembersChange={handleMaxMembersChange}
            onQuietHoursToggle={handleQuietHoursToggle}
            onQuietHoursStartChange={handleQuietHoursStartChange}
            onQuietHoursEndChange={handleQuietHoursEndChange}
            onRemoveMember={handleRemoveMember}
            onCreateChannel={handleCreateChannel}
            onDeleteChannel={handleDeleteChannel}
            onConnectGoogle={handleConnectGoogle}
            onDisconnectGoogle={handleDisconnectGoogle}
            onSyncGoogle={handleSyncGoogle}
            onAutoSyncToggle={handleAutoSyncToggle}
            preferredTranslationLanguage={preferredTranslationLanguage}
            onPreferredTranslationLanguageChange={handlePreferredTranslationLanguageChange}
          />
        </div>
      )}
    </>
  );
}
