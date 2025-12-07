/**
 * Chat Page (Story 2.1)
 * Main chat screen with channel selection, message list, and E2EE messaging
 * Uses the professional prototype ChatScreen component
 */

'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ChatScreen } from '@/components/chat-screen';
import { SettingsScreen } from '@/components/settings-screen';
import { MainHeader, type MainHeaderView } from '@/components/main-header';
import { InviteMemberDialog } from '@/components/family/invite-member-dialog';
import { useMessages, useSendMessage, useEditMessage, useDeleteMessage, useMessageSubscription } from '@/lib/hooks/use-messages';
import { useChannels } from '@/lib/hooks/use-channels';
import { useMutation, useQuery } from '@apollo/client/react';
import { REMOVE_FAMILY_MEMBER_MUTATION, DEREGISTER_SELF_MUTATION, GET_FAMILY_MEMBERS_QUERY } from '@/lib/graphql/operations';
import type {
  RemoveFamilyMemberMutation,
  RemoveFamilyMemberMutationVariables,
  DeregisterSelfMutation,
  DeregisterSelfMutationVariables,
  GetFamilyMembersQuery,
  GetFamilyMembersQueryVariables,
} from '@/lib/graphql/generated/graphql';
import { useAuth } from '@/lib/contexts/auth-context';
import { useLanguage } from '@/lib/contexts/language-context';
import { encryptMessage, decryptMessage } from '@/lib/e2ee/encryption';
import { getFamilyKey } from '@/lib/e2ee/key-management';
import { t } from '@/lib/translations';
import { formatDateTime } from '@/lib/utils/date-format';
import type { TranslationLanguage } from '@/components/settings/translation-language-selector';
import {
  DEFAULT_TRANSLATION_LANGUAGE,
  isSupportedTranslationLanguage,
} from '@/lib/translation/languages';

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

type DisplayMessage = {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  message: string;
  timestamp: string;
  isMine: boolean;
  isEdited: boolean;
};

type ChannelData = {
  processedIds: Set<string>;
  lastAccessed: number;
};

type SetStateCacheEntry = {
  prevRef: DisplayMessage[];
  result: DisplayMessage[];
};

export default function ChatPage() {
  const router = useRouter();
  const { user, family, loading: authLoading, logout, switchActiveFamily } = useAuth();
  const { language } = useLanguage();

  // State
  const [currentChannelId, setCurrentChannelId] = useState<string | null>(null);
  const [displayMessages, setDisplayMessages] = useState<DisplayMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [familyKey, setFamilyKey] = useState<CryptoKey | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [currentView, setCurrentView] = useState<MainHeaderView>('chat');

  // Header state (lifted from ChatScreen for persistent header)
  const [showPhotos, setShowPhotos] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showTranslation, setShowTranslation] = useState(true);
  const [autoTranslate, setAutoTranslate] = useState(true);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
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
  const [preferredTranslationLanguage, setPreferredTranslationLanguage] =
    useState<TranslationLanguage>(DEFAULT_TRANSLATION_LANGUAGE);
  const [settingsChannels, setSettingsChannels] = useState<SettingsChannel[]>([]);
  const [settingsFamilyMembers, setSettingsFamilyMembers] = useState<SettingsFamilyMember[]>([]);

  // Instrumentation refs for debugging double-subscription issue
  const executionCounterRef = useRef(0);
  const objectIdentityMap = useRef(new WeakMap<object, number>());
  const nextIdentityIdRef = useRef(0);

  // Helper to track object identity changes (reveals Apollo cache creating new references)
  const getObjectId = (obj: object | null | undefined) => {
    if (!obj) return null;
    if (!objectIdentityMap.current.has(obj)) {
      objectIdentityMap.current.set(obj, nextIdentityIdRef.current++);
    }
    return objectIdentityMap.current.get(obj);
  };

  // Per-channel deduplication to prevent double-processing (StrictMode + other edge cases)
  const processedMessagesByChannel = useRef<Map<string, ChannelData>>(new Map());

  // Track setState results per message keyed by previous state reference
  // This avoids creating a second array when StrictMode re-invokes the updater with the same prev ref.
  const setStateResultsRef = useRef<Map<string, SetStateCacheEntry>>(new Map());

  // Get channel identifier with fallback for single-room flows
  const getChannelKey = (channelId: string | null | undefined, familyId: string | null | undefined) => {
    return channelId || familyId || 'default';
  };

  // Get or create channel data with recency tracking
  const getChannelData = (channelKey: string): ChannelData => {
    if (!processedMessagesByChannel.current.has(channelKey)) {
      processedMessagesByChannel.current.set(channelKey, {
        processedIds: new Set(),
        lastAccessed: Date.now(),
      });
    }
    const data = processedMessagesByChannel.current.get(channelKey)!;
    data.lastAccessed = Date.now(); // Update access time
    return data;
  };

  // Prune old channels based on recency (keep current + 2 most recent)
  const pruneOldChannels = (currentChannelKey: string) => {
    const entries = Array.from(processedMessagesByChannel.current.entries());
    if (entries.length <= 3) return; // Keep at least 3

    // Sort by lastAccessed (most recent first)
    entries.sort((a, b) => b[1].lastAccessed - a[1].lastAccessed);

    // Keep current channel + 2 most recent others
    const toKeep = new Set([
      currentChannelKey,
      ...entries.slice(0, 3).map(([key]) => key),
    ]);

    // Delete old channels
    entries.forEach(([key]) => {
      if (!toKeep.has(key)) {
        processedMessagesByChannel.current.delete(key);
      }
    });
  };

  // GraphQL hooks
  const { channels, loading: channelsLoading } = useChannels();
  const { messages: rawMessages } = useMessages({
    channelId: currentChannelId || '',
  });
  const { send } = useSendMessage();
  const { edit } = useEditMessage();
  const { remove } = useDeleteMessage();
  const [removeFamilyMemberMutation] = useMutation<
    RemoveFamilyMemberMutation,
    RemoveFamilyMemberMutationVariables
  >(REMOVE_FAMILY_MEMBER_MUTATION);
  const [deregisterSelfMutation] = useMutation<
    DeregisterSelfMutation,
    DeregisterSelfMutationVariables
  >(DEREGISTER_SELF_MUTATION);

  // Query family members (needed for header member count and Settings panel)
  const { data: familyMembersData, refetch: refetchFamilyMembers } = useQuery<
    GetFamilyMembersQuery,
    GetFamilyMembersQueryVariables
  >(GET_FAMILY_MEMBERS_QUERY, {
    variables: { familyId: family?.id || '' },
    skip: !family?.id,
    fetchPolicy: 'cache-and-network',
  });

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

  // Sync family members from GraphQL query when settings is open
  useEffect(() => {
    if (!isSettingsOpen) {
      return;
    }

    if (!familyMembersData?.getFamilyMembers) {
      return;
    }

    setSettingsFamilyMembers((prev) => {
      const nextMembers: SettingsFamilyMember[] = familyMembersData.getFamilyMembers.map((member) => ({
        id: member.id,
        name: member.name,
        email: member.email,
        avatar: member.avatar ?? '',
        role: member.role.toUpperCase() === 'ADMIN' ? 'admin' : 'member',
        joinedAt: member.joinedAt,
      }));

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
  }, [isSettingsOpen, familyMembersData]);

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
    if (!isSettingsOpen) {
      setSettingsFamilyName(family?.name ?? '');
      setSettingsFamilyAvatar(family?.avatar ?? '');
      setSettingsMaxMembers(family?.maxMembers ?? 0);
    }
  }, [family?.id, family?.name, family?.avatar, family?.maxMembers, isSettingsOpen]);

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

      if (!family?.id) {
        // User doesn't have a family yet - redirect to family setup
        console.log('[ChatPage] User logged in without family. Redirecting to family setup.');
        router.push('/family-setup');
        return;
      }

      // Load family key from IndexedDB
      const key = await getFamilyKey(family.id);
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
  }, [user, family, authLoading, router]);

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
    console.log('[Decrypt] Effect triggered:', {
      rawMessagesCount: rawMessages?.length ?? 0,
      hasFamilyKey: !!familyKey,
      hasUser: !!user,
    });

    if (!rawMessages || rawMessages.length === 0) {
      console.log('[Decrypt] No raw messages, clearing display');
      setDisplayMessages((prev) => prev.length === 0 ? prev : []);
      return;
    }

    let cancelled = false;

    const decryptMessages = async () => {
      console.log('[Decrypt] Starting decryption of', rawMessages.length, 'messages');
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
              timestamp: formatDateTime(msg.timestamp, language),
              isMine: msg.userId === user?.id,
              isEdited: msg.isEdited,
            };
          }
        })
      );

      if (cancelled) {
        console.log('[Decrypt] Cancelled, not updating display');
        return;
      }

      console.log('[Decrypt] Setting display messages to', decrypted.length, 'decrypted messages');
      console.log('[Decrypt] Message IDs:', decrypted.map(m => m.id));

      // Use query result as source of truth, removing any temp optimistic messages
      setDisplayMessages((prev) => {
        console.log('[Decrypt] Previous display messages:', prev.length);
        console.log('[Decrypt] Previous IDs:', prev.map(m => m.id));
        console.log('[Decrypt] New IDs:', decrypted.map(m => m.id));

        // Smart merge: preserve existing message objects AND subscription messages
        const prevMap = new Map(prev.filter(m => !m.id.startsWith('temp-')).map(m => [m.id, m]));
        const decryptedMap = new Map(decrypted.map(m => [m.id, m]));

        // Start with decrypted messages, reusing existing objects where unchanged
        const merged = decrypted.map(newMsg => {
          const existing = prevMap.get(newMsg.id);
          // If message already exists and content hasn't changed, reuse the existing object reference
          if (existing &&
              existing.message === newMsg.message &&
              existing.isEdited === newMsg.isEdited) {
            return existing;
          }
          return newMsg;
        });

        // Add any subscription-only messages that aren't in the query yet (race condition protection)
        prev.forEach(prevMsg => {
          if (!prevMsg.id.startsWith('temp-') && !decryptedMap.has(prevMsg.id)) {
            console.log('[Decrypt] Preserving subscription message not yet in query:', prevMsg.id);
            merged.push(prevMsg);
          }
        });

        // Only update if there are actual changes (new messages, edited messages, or different order)
        if (merged.length === prev.length &&
            merged.every((msg, idx) => msg === prev[idx])) {
          console.log('[Decrypt] No changes detected, keeping previous state');
          return prev;
        }

        return merged;
      });
    };

    decryptMessages();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawMessages, familyKey, user?.id, language]);

  // Handle real-time message added
  useEffect(() => {
    const execId = ++executionCounterRef.current;
    const messageObjId = getObjectId(messageAdded);

    console.log(`[Subscription:${execId}] Effect triggered`, {
      messageId: messageAdded?.id,
      messageObjId, // Track object identity - changes reveal new references
      familyKeyPresent: !!familyKey,
      userId: user?.id,
      language,
      timestamp: Date.now(),
    });

    if (!messageAdded || !familyKey) {
      console.log(`[Subscription:${execId}] Skipping - missing deps`);
      return;
    }

    // Deduplication: prevent processing same message multiple times
    const channelKey = getChannelKey(currentChannelId, family?.id);
    const channelData = getChannelData(channelKey);

    if (channelData.processedIds.has(messageAdded.id)) {
      console.log(`[Subscription:${execId}] ⚠️ Already processed:`, messageAdded.id, 'in channel:', channelKey);
      return;
    }

    // Mark as processed before async operations
    channelData.processedIds.add(messageAdded.id);
    pruneOldChannels(channelKey);

    const processNewMessage = async () => {
      try {
        console.log(`[Subscription:${execId}] Processing new message:`, messageAdded.id);
        const plaintext = await decryptMessage(messageAdded.encryptedContent, familyKey);
        console.log(`[Subscription:${execId}] Message decrypted successfully`);

        const newMessage: DisplayMessage = {
          id: messageAdded.id,
          userId: messageAdded.userId,
          userName: messageAdded.user.name,
          userAvatar: messageAdded.user.avatar || '',
          message: plaintext,
          timestamp: formatDateTime(messageAdded.timestamp, language),
          isMine: messageAdded.userId === user?.id,
          isEdited: messageAdded.isEdited,
        };

        console.log(`[Subscription:${execId}] New message object created:`, newMessage);

        setDisplayMessages((prev) => {
          console.log(`[Subscription:${execId}] setState callback`, {
            prevLength: prev.length,
            prevIds: prev.map(m => m.id).slice(-5).join(','), // Last 5 IDs
            timestamp: Date.now(),
          });

          // StrictMode protection: return cached result if we've already processed this message
          const cachedResult = setStateResultsRef.current.get(newMessage.id);
          if (cachedResult && cachedResult.prevRef === prev) {
            console.log(`[Subscription:${execId}] ⚠️ Returning cached result for:`, newMessage.id, '(StrictMode duplicate)');
            return cachedResult.result;
          }

          // Avoid duplicates - check if message already exists in state
          const exists = prev.some((m) => m.id === newMessage.id);
          if (exists) {
            console.log(`[Subscription:${execId}] ⚠️ Already in state:`, newMessage.id);
            return prev;
          }

          console.log(`[Subscription:${execId}] ✅ Adding new message:`, newMessage.id);

          // If this is my own message arriving via subscription, remove the optimistic temp message
          let filtered = prev;
          if (newMessage.isMine) {
            const tempCount = prev.filter((m) => m.id.startsWith('temp-')).length;
            if (tempCount > 0) {
              console.log(`[Subscription:${execId}] Removing ${tempCount} optimistic temp message(s)`);
              filtered = prev.filter((m) => !m.id.startsWith('temp-'));
            }
          }

          const updated = [...filtered, newMessage];
          console.log(`[Subscription:${execId}] Updated messages count:`, updated.length);

          // Cache the result for StrictMode duplicate call keyed by previous state reference
          setStateResultsRef.current.set(newMessage.id, { prevRef: prev, result: updated });

          return updated;
        });
      } catch (error) {
        console.error(`[Subscription:${execId}] ❌ Failed to process:`, error);
        // Remove from processed set to allow retry on next dependency change
        channelData.processedIds.delete(messageAdded.id);
      }
    };

    processNewMessage();

    return () => {
      console.log(`[Subscription:${execId}] Cleanup running at`, Date.now());
    };
  }, [messageAdded, familyKey, user?.id, language, currentChannelId, family?.id]);

  // Clear all processed IDs when family key changes (key rotation or family switch)
  useEffect(() => {
    console.log('[Subscription] Family key changed, clearing all processed IDs');
    processedMessagesByChannel.current.clear();
    setStateResultsRef.current.clear();
  }, [familyKey]);

  // Handle real-time message edited
  useEffect(() => {
    if (!messageEdited || !familyKey) return;

    const processEditedMessage = async () => {
      try {
    const plaintext = await decryptMessage(
      messageEdited.encryptedContent,
      familyKey,
    );

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

  // Handler: Schedule message (params reserved for future implementation)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleScheduleMessage = async (_message: string, _scheduledTime: Date) => {
    // TODO: Implement scheduled messages in backend
    toast.info('Scheduled messages will be implemented soon!');
  };

  // Handler: Cancel scheduled message (param reserved for future implementation)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleCancelScheduledMessage = async (_messageId: string) => {
    // TODO: Implement in backend
    toast.info('Cancel scheduled messages will be implemented soon!');
  };

  // Handler: Channel change
  const handleChannelChange = (channelId: string) => {
    setCurrentChannelId(channelId);
    setDisplayMessages([]); // Clear messages when switching channels
  };

  // Handler: Chat click - always goes to chat messages view
  const handleChatClick = () => {
    setCurrentView('chat');
    setIsSettingsOpen(false);
    // Reset photo/calendar views to show chat messages
    setShowPhotos(false);
    setShowCalendar(false);
  };

  // Handler: Settings click - always goes to settings
  const handleSettingsClick = () => {
    setCurrentView('settings');
    setIsSettingsOpen(true);
  };

  // Handler: About screen navigation (from SettingsScreen)
  const handleAboutOpen = () => {
    setCurrentView('about');
  };

  const handleAboutClose = () => {
    setCurrentView('settings');
  };

  // Handler: Header view buttons - each takes you to that view (no toggle)
  const handlePhotosClick = () => {
    setShowPhotos(true);
    setShowCalendar(false);
  };

  const handleCalendarClick = () => {
    setShowCalendar(true);
    setShowPhotos(false);
  };

  const handleInviteClick = () => {
    setIsInviteDialogOpen(true);
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

  // Handler: Delete account (Story 1.14 AC7, AC8)
  const handleDeleteAccount = async () => {
    try {
      const result = await deregisterSelfMutation();

      if (result.data?.deregisterSelf?.success) {
        toast.success(t('settings.deleteAccountSuccess', language));
        setIsSettingsOpen(false);
        await logout();
        window.location.href = '/login';
      } else {
        toast.error(result.data?.deregisterSelf?.message || 'Failed to delete account');
      }
    } catch (error) {
      console.error('Delete account error:', error);
      const message = error instanceof Error ? error.message : 'Failed to delete account';
      toast.error(message);
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

  const handleRemoveMember = async (memberId: string) => {
    if (!family?.id) {
      toast.error('No active family');
      return;
    }

    try {
      const result = await removeFamilyMemberMutation({
        variables: {
          input: {
            userId: memberId,
            familyId: family.id,
          },
        },
      });

      if (result.data?.removeFamilyMember?.success) {
        // Refetch family members to update the list
        refetchFamilyMembers();
        toast.success(t('toast.memberRemoved', language));
      } else {
        toast.error(result.data?.removeFamilyMember?.message || 'Failed to remove member');
      }
    } catch (error) {
      console.error('Remove member error:', error);
      const message = error instanceof Error ? error.message : 'Failed to remove member';
      toast.error(message);
    }
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
  const handleAddEvent = () => {
    toast.info('Calendar events will be implemented soon!');
  };

  // Handler: Edit calendar event
  const handleEditEvent = () => {
    toast.info('Calendar events will be implemented soon!');
  };

  // Handler: Delete calendar event
  const handleDeleteEvent = () => {
    toast.info('Calendar events will be implemented soon!');
  };

  // Handler: Add photo
  const handleAddPhoto = () => {
    toast.info('Photo gallery will be implemented soon!');
  };

  // Handler: Delete photo
  const handleDeletePhoto = () => {
    toast.info('Photo gallery will be implemented soon!');
  };

  // Handler: Like photo
  const handleLikePhoto = () => {
    toast.info('Photo likes will be implemented soon!');
  };

  // Handler: Add photo comment
  const handleAddPhotoComment = () => {
    toast.info('Photo comments will be implemented soon!');
  };

  // Handler: Create folder
  const handleCreateFolder = () => {
    toast.info('Photo folders will be implemented soon!');
  };

  // Handler: Delete folder
  const handleDeleteFolder = () => {
    toast.info('Photo folders will be implemented soon!');
  };

  // Handler: Rename folder
  const handleRenameFolder = () => {
    toast.info('Photo folders will be implemented soon!');
  };

  // Handler: Move photo to folder
  const handleMovePhotoToFolder = () => {
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
  // Use GraphQL data directly for member count (settingsFamilyMembers only syncs when settings is open)
  const familyMemberCount = familyMembersData?.getFamilyMembers?.length ?? 0;

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
    <div className="h-screen flex flex-col bg-background">
      {/* Persistent Header */}
      <MainHeader
        familyName={familyName}
        familyAvatar={familyAvatar}
        memberCount={familyMemberCount}
        currentView={currentView}
        memberships={user?.memberships ?? []}
        activeFamilyId={user?.activeFamilyId ?? null}
        onSwitchFamily={switchActiveFamily}
        onChatClick={handleChatClick}
        onSettingsClick={handleSettingsClick}
        onLogoutClick={handleLogoutClick}
        onInviteClick={handleInviteClick}
        showPhotos={showPhotos}
        showCalendar={showCalendar}
        showTranslation={showTranslation}
        autoTranslate={autoTranslate}
        onPhotosClick={handlePhotosClick}
        onCalendarClick={handleCalendarClick}
        onShowTranslationChange={setShowTranslation}
        onAutoTranslateChange={setAutoTranslate}
        language={language}
      />

      {/* Content area - switches between views */}
      <div className="flex-1 overflow-hidden">
        {currentView === 'chat' ? (
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
            memberships={user?.memberships ?? []}
            activeFamilyId={user?.activeFamilyId ?? null}
            familyId={family?.id || user?.activeFamilyId || ''}
            currentUserId={user?.id || ''}
            currentUserName={user?.name || ''}
            language={language}
            onSettingsClick={handleSettingsClick}
            onLogoutClick={handleLogoutClick}
            onSwitchFamily={switchActiveFamily}
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
            translationFamilyKey={familyKey}
            preferredTranslationLanguage={preferredTranslationLanguage}
            hideHeader
            showPhotos={showPhotos}
            showCalendar={showCalendar}
            showTranslation={showTranslation}
            autoTranslate={autoTranslate}
          />
        ) : user && (
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
            onBack={handleChatClick}
            onDeleteAccount={handleDeleteAccount}
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
            hideHeader
            onAboutOpen={handleAboutOpen}
            onAboutClose={handleAboutClose}
            showAbout={currentView === 'about'}
          />
        )}
      </div>

      {/* Invite Dialog */}
      <InviteMemberDialog
        open={isInviteDialogOpen}
        onOpenChange={setIsInviteDialogOpen}
        familyId={family?.id || user?.activeFamilyId || ''}
        familyName={familyName}
      />
    </div>
  );
}
