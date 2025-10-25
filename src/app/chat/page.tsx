/**
 * Chat Page (Story 2.1)
 * Main chat screen with channel selection, message list, and E2EE messaging
 * Uses the professional prototype ChatScreen component
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ChatScreen } from '@/components/chat-screen';
import { useMessages, useSendMessage, useEditMessage, useDeleteMessage, useMessageSubscription } from '@/lib/hooks/use-messages';
import { useChannels } from '@/lib/hooks/use-channels';
import { useAuth } from '@/lib/contexts/auth-context';
import { useLanguage } from '@/lib/contexts/language-context';
import { encryptMessage, decryptMessage } from '@/lib/e2ee/encryption';
import { getFamilyKey } from '@/lib/e2ee/key-management';
import { t } from '@/lib/translations';

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
              timestamp: new Date(msg.timestamp).toLocaleString(),
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
              timestamp: new Date(msg.timestamp).toLocaleString(),
              isMine: msg.userId === user?.id,
              isEdited: msg.isEdited,
            };
          }
        })
      );

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
          timestamp: new Date(messageAdded.timestamp).toLocaleString(),
          isMine: messageAdded.userId === user?.id,
          isEdited: messageAdded.isEdited,
        };

        setDisplayMessages((prev) => {
          // Avoid duplicates
          if (prev.some((m) => m.id === newMessage.id)) {
            return prev;
          }
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
        timestamp: new Date().toLocaleString(),
        isMine: true,
        isEdited: false,
      };

      setDisplayMessages((prev) => [...prev, optimisticMessage]);

      // Send via GraphQL
      const result = await send(currentChannelId, encryptedContent);

      if (result) {
        // Replace optimistic message with real one
        setDisplayMessages((prev) =>
          prev.map((m) =>
            m.id === optimisticMessage.id
              ? { ...optimisticMessage, id: result.id }
              : m
          )
        );
      }
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
    toast.info('Settings coming soon!');
  };

  // Handler: Logout click
  const handleLogoutClick = async () => {
    try {
      await logout();
      toast.success(t('toast.logoutSuccess', language));
      // Redirect to login page after logout
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Logout failed');
    }
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
  const transformedChannels = channels.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description || '',
    icon: '💬',
    createdAt: new Date(c.createdAt || new Date()).toISOString(),
    createdBy: c.createdById || 'system',
  }));

  // Get family info
  const familyName = family?.name || 'Loading...';
  const familyAvatar = family?.avatar || '';
  const familyMemberCount = family?.maxMembers || 0;

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
      familyMembers={[]}
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
  );
}
