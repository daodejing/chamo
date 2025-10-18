/**
 * Chat Page (Story 2.1)
 * Main chat screen with channel selection, message list, and E2EE messaging
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ChannelSelector, type Channel } from '@/components/chat/channel-selector';
import { MessageList } from '@/components/chat/message-list';
import { MessageInput } from '@/components/chat/message-input';
import { MessageBubbleProps } from '@/components/chat/message-bubble';
import { useRealtime, type Message as RealtimeMessage } from '@/lib/hooks/use-realtime';
import { encryptMessage, decryptMessage } from '@/lib/e2ee/encryption';
import { getFamilyKey } from '@/lib/e2ee/key-management';
import { createClient } from '@/lib/supabase/client';

export default function ChatPage() {
  const router = useRouter();
  const supabase = createClient();

  // State
  const [channels, setChannels] = useState<Channel[]>([]);
  const [currentChannelId, setCurrentChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageBubbleProps[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [familyKey, setFamilyKey] = useState<CryptoKey | null>(null);
  // Cache user info to avoid repeated queries in real-time handler
  const [userCache, setUserCache] = useState<Map<string, { name: string; avatar?: string }>>(new Map());
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

  // Initialize: Load user, family key, channels
  useEffect(() => {
    const initialize = async () => {
      try {
        // Check auth
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
          toast.error('Please log in to access chat');
          router.push('/login');
          return;
        }

        setCurrentUserId(user.id);

        // Set access token for Realtime authentication
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          supabase.realtime.setAuth(session.access_token);
          console.log('Realtime auth token set');
        } else {
          console.warn('No access token available for Realtime');
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
        const channelsResponse = await fetch('/api/channels');
        if (!channelsResponse.ok) {
          throw new Error('Failed to load channels');
        }

        const channelsData = await channelsResponse.json();
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
  }, [router, supabase]);

  // Fetch messages when channel changes
  useEffect(() => {
    if (!currentChannelId || !familyKey) return;

    const fetchMessages = async () => {
      try {
        setLoading(true);

        const response = await fetch(
          `/api/messages?channelId=${currentChannelId}&limit=50`
        );

        if (!response.ok) {
          throw new Error('Failed to fetch messages');
        }

        const data = await response.json();

        if (data.success) {
          // Build user cache from fetched messages
          const newUserCache = new Map(userCache);
          data.messages.forEach((msg: any) => {
            if (msg.userName && !newUserCache.has(msg.userId)) {
              newUserCache.set(msg.userId, {
                name: msg.userName,
                avatar: msg.userAvatar,
              });
            }
          });
          setUserCache(newUserCache);

          // Decrypt all messages (user data already included from API JOIN)
          const decryptedMessages = await Promise.all(
            data.messages.map(async (msg: any) => {
              try {
                const plaintext = await decryptMessage(msg.encryptedContent, familyKey);

                return {
                  id: msg.id,
                  userId: msg.userId,
                  userName: msg.userName || 'Unknown',
                  userAvatar: msg.userAvatar,
                  content: plaintext,
                  timestamp: msg.timestamp,
                  isEdited: msg.isEdited,
                  editedAt: msg.editedAt,
                  isMine: msg.userId === currentUserId,
                } as MessageBubbleProps;
              } catch (decryptError) {
                console.error('Failed to decrypt message:', decryptError);
                return null;
              }
            })
          );

          // Filter out failed decryptions and reverse (newest last)
          setMessages(
            decryptedMessages.filter((m) => m !== null).reverse() as MessageBubbleProps[]
          );
        }
      } catch (error) {
        console.error('Fetch messages error:', error);
        console.error('Error details:', error instanceof Error ? error.message : String(error));
        console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
        toast.error('Failed to load messages');
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, [currentChannelId, familyKey, currentUserId, supabase]);

  // Real-time subscription
  const handleRealtimeInsert = useCallback(
    async (message: RealtimeMessage) => {
      if (!familyKey) return;

      try {
        // Decrypt incoming message
        const plaintext = await decryptMessage(message.encrypted_content, familyKey);

        // Try to get user info from cache first
        let userName = 'Unknown';
        let userAvatar: string | undefined = undefined;

        if (userCache.has(message.user_id)) {
          const cached = userCache.get(message.user_id)!;
          userName = cached.name;
          userAvatar = cached.avatar;
        } else {
          // Cache miss - fetch and update cache
          const { data: userData } = await supabase
            .from('users')
            .select('name, avatar')
            .eq('id', message.user_id)
            .single();

          if (userData) {
            userName = userData.name;
            userAvatar = userData.avatar;
            // Update cache
            setUserCache((prev) => new Map(prev).set(message.user_id, {
              name: userData.name,
              avatar: userData.avatar,
            }));
          }
        }

        const newMessage: MessageBubbleProps = {
          id: message.id,
          userId: message.user_id,
          userName,
          userAvatar,
          content: plaintext,
          timestamp: message.timestamp,
          isEdited: message.is_edited,
          editedAt: message.edited_at,
          isMine: message.user_id === currentUserId,
        };

        setMessages((prev) => [...prev, newMessage]);
      } catch (error) {
        console.error('Failed to handle real-time message:', error);
      }
    },
    [familyKey, currentUserId, supabase, userCache]
  );

  // Handle real-time UPDATE events
  const handleRealtimeUpdate = useCallback(
    async (message: RealtimeMessage) => {
      if (!familyKey) return;

      try {
        // Decrypt updated message
        const plaintext = await decryptMessage(message.encrypted_content, familyKey);

        setMessages((prev) =>
          prev.map((m) =>
            m.id === message.id
              ? {
                  ...m,
                  content: plaintext,
                  isEdited: message.is_edited,
                  editedAt: message.edited_at,
                }
              : m
          )
        );
      } catch (error) {
        console.error('Failed to handle real-time message update:', error);
      }
    },
    [familyKey]
  );

  // Handle real-time DELETE events
  const handleRealtimeDelete = useCallback(
    (messageId: string) => {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    },
    []
  );

  useRealtime(currentChannelId, {
    onInsert: handleRealtimeInsert,
    onUpdate: handleRealtimeUpdate,
    onDelete: handleRealtimeDelete,
    onError: (error, willRetry, retryCount) => {
      console.error(`Realtime error (attempt ${retryCount + 1}):`, error);
      if (!willRetry) {
        toast.error('Real-time connection failed. Please refresh the page.');
      }
    },
    onReconnecting: (retryCount) => {
      toast.info(`Reconnecting... (attempt ${retryCount})`);
    },
    onReconnected: () => {
      toast.success('Real-time connection restored');
    },
  });

  // Send message
  const handleSend = async (content: string) => {
    if (!currentChannelId || !familyKey || sending || !currentUserId) return;

    try {
      setSending(true);

      // Encrypt message
      const encryptedContent = await encryptMessage(content, familyKey);

      // Optimistically add message to UI (before API response)
      const optimisticMessage: MessageBubbleProps = {
        id: `temp-${Date.now()}`, // Temporary ID
        userId: currentUserId,
        userName: 'You',
        content: content,
        timestamp: new Date().toISOString(),
        isEdited: false,
        editedAt: null,
        isMine: true,
      };

      setMessages((prev) => [...prev, optimisticMessage]);

      // Send to API
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId: currentChannelId,
          encryptedContent,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Remove optimistic message on error
        setMessages((prev) => prev.filter((m) => m.id !== optimisticMessage.id));

        if (data.error?.code === 'QUIET_HOURS_ACTIVE') {
          toast.error('Quiet hours active - cannot send messages');
        } else if (data.error?.code === 'RATE_LIMIT_EXCEEDED') {
          toast.error('Too many messages. Please slow down.');
        } else {
          throw new Error(data.error?.message || 'Failed to send message');
        }
        return;
      }

      // Replace optimistic message with real one from server (if real-time doesn't deliver)
      if (data.success && data.message) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === optimisticMessage.id
              ? { ...optimisticMessage, id: data.message.id }
              : m
          )
        );
      }
    } catch (error) {
      console.error('Send message error:', error);
      toast.error('Failed to send message');
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

      const response = await fetch(`/api/messages/${messageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encryptedContent }),
      });

      if (!response.ok) {
        throw new Error('Failed to edit message');
      }

      const data = await response.json();

      // Update local state
      if (data.success && data.message) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  content: newContent,
                  isEdited: true,
                  editedAt: data.message.editedAt,
                }
              : m
          )
        );
        toast.success('Message edited');
      }

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
      const response = await fetch(`/api/messages/${messageId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete message');
      }

      // Remove from local state
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      toast.success('Message deleted');
    } catch (error) {
      console.error('Delete message error:', error);
      toast.error('Failed to delete message');
    }
  };

  // Handle channel change
  const handleChannelChange = (channelId: string) => {
    setCurrentChannelId(channelId);
    setMessages([]); // Clear messages when switching channels
  };

  if (loading && !currentChannelId) {
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
        messages={messages}
        loading={loading}
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
