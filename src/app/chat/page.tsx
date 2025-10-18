/**
 * Chat Page (Story 2.1)
 * Main chat screen with channel selection, message list, and E2EE messaging
 * Now using GraphQL instead of Supabase REST API
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ChannelSelector, type Channel } from '@/components/chat/channel-selector';
import { MessageList } from '@/components/chat/message-list';
import { MessageInput } from '@/components/chat/message-input';
import { MessageBubbleProps } from '@/components/chat/message-bubble';
import { useMessages, useSendMessage, useEditMessage, useDeleteMessage, useMessageSubscription } from '@/lib/hooks/use-messages';
import { useAuth } from '@/lib/contexts/auth-context';
import { encryptMessage, decryptMessage } from '@/lib/e2ee/encryption';
import { getFamilyKey } from '@/lib/e2ee/key-management';

export default function ChatPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  // State
  const [channels, setChannels] = useState<Channel[]>([]);
  const [currentChannelId, setCurrentChannelId] = useState<string | null>(null);
  const [displayMessages, setDisplayMessages] = useState<MessageBubbleProps[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [familyKey, setFamilyKey] = useState<CryptoKey | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

  // GraphQL hooks
  const { messages: rawMessages, loading: messagesLoading, refetch } = useMessages({
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
        toast.error('Family key not found. Please log in again.');
        router.push('/login');
        return;
      }
      setFamilyKey(key);

      // Fetch channels
      try {
        const response = await fetch('/api/channels');
        if (!response.ok) {
          throw new Error('Failed to load channels');
        }

        const channelsData = await response.json();
        if (channelsData.success && channelsData.channels.length > 0) {
          setChannels(channelsData.channels);

          // Select default channel (first one, usually "General")
          const defaultChannel = channelsData.channels.find((c: Channel) => c.isDefault) || channelsData.channels[0];
          setCurrentChannelId(defaultChannel.id);
        } else {
          toast.error('No channels available');
        }
      } catch (error) {
        console.error('Initialization error:', error);
        toast.error('Failed to initialize chat');
      } finally {
        setLoading(false);
      }
    };

    initialize();
  }, [user, authLoading, router]);

  // Decrypt messages when raw messages change
  useEffect(() => {
    if (!familyKey || !rawMessages || rawMessages.length === 0) {
      if (displayMessages.length > 0) {
        setDisplayMessages([]);
      }
      return;
    }

    const decryptMessages = async () => {
      const decrypted = await Promise.all(
        rawMessages.map(async (msg) => {
          try {
            const plaintext = await decryptMessage(msg.encryptedContent, familyKey);

            return {
              id: msg.id,
              userId: msg.userId,
              userName: msg.user.name,
              userAvatar: msg.user.avatar || undefined,
              content: plaintext,
              timestamp: msg.timestamp.toString(),
              isEdited: msg.isEdited,
              editedAt: msg.editedAt ? msg.editedAt.toString() : null,
              isMine: msg.userId === user?.id,
            } as MessageBubbleProps;
          } catch (error) {
            console.error('Failed to decrypt message:', error);
            return null;
          }
        })
      );

      setDisplayMessages(decrypted.filter((m) => m !== null) as MessageBubbleProps[]);
    };

    decryptMessages();
  }, [rawMessages, familyKey, user]);

  // Handle real-time message added
  useEffect(() => {
    if (!messageAdded || !familyKey) return;

    const processNewMessage = async () => {
      try {
        const plaintext = await decryptMessage(messageAdded.encryptedContent, familyKey);

        const newMessage: MessageBubbleProps = {
          id: messageAdded.id,
          userId: messageAdded.userId,
          userName: messageAdded.user.name,
          userAvatar: messageAdded.user.avatar || undefined,
          content: plaintext,
          timestamp: messageAdded.timestamp.toString(),
          isEdited: messageAdded.isEdited,
          editedAt: messageAdded.editedAt ? messageAdded.editedAt.toString() : null,
          isMine: messageAdded.userId === user?.id,
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
                  content: plaintext,
                  isEdited: messageEdited.isEdited,
                  editedAt: messageEdited.editedAt ? messageEdited.editedAt.toString() : null,
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

  // Send message
  const handleSend = async (content: string) => {
    if (!currentChannelId || !familyKey || sending || !user) return;

    try {
      setSending(true);

      // Encrypt message
      const encryptedContent = await encryptMessage(content, familyKey);

      // Optimistically add message to UI
      const optimisticMessage: MessageBubbleProps = {
        id: `temp-${Date.now()}`,
        userId: user.id,
        userName: user.name,
        userAvatar: user.avatar || undefined,
        content: content,
        timestamp: new Date().toISOString(),
        isEdited: false,
        editedAt: null,
        isMine: true,
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

  // Edit message
  const handleEdit = async (messageId: string, newContent: string) => {
    if (!familyKey) return;

    try {
      // Encrypt new content
      const encryptedContent = await encryptMessage(newContent, familyKey);

      await edit(messageId, encryptedContent);

      // Update local state optimistically
      setDisplayMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? {
                ...m,
                content: newContent,
                isEdited: true,
                editedAt: new Date().toISOString(),
              }
            : m
        )
      );

      toast.success('Message edited');
      setEditingMessageId(null);
    } catch (error) {
      console.error('Edit message error:', error);
      toast.error('Failed to edit message');
    }
  };

  // Delete message
  const handleDelete = async (messageId: string) => {
    if (!confirm('Delete this message?')) return;

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

  // Handle channel change
  const handleChannelChange = (channelId: string) => {
    setCurrentChannelId(channelId);
    setDisplayMessages([]); // Clear messages when switching channels
  };

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
      {/* Channel Selector */}
      {channels.length > 0 && currentChannelId && (
        <ChannelSelector
          channels={channels}
          currentChannelId={currentChannelId}
          onChannelChange={handleChannelChange}
        />
      )}

      {/* Message List */}
      <MessageList
        messages={displayMessages}
        loading={messagesLoading}
        onEdit={handleEdit}
        onDelete={handleDelete}
        editingMessageId={editingMessageId}
        onEditStart={setEditingMessageId}
        onEditCancel={() => setEditingMessageId(null)}
      />

      {/* Message Input */}
      <MessageInput
        onSend={handleSend}
        disabled={sending || !currentChannelId}
        placeholder={
          sending
            ? 'Sending...'
            : !currentChannelId
            ? 'Select a channel first'
            : 'Type a message...'
        }
      />
    </div>
  );
}
