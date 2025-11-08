/**
 * MessageList Component
 * Scrollable list of messages with virtual scrolling for performance
 */

'use client';

import { useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { TranslationLanguage } from '@/components/settings/translation-language-selector';
import { MessageBubble, MessageBubbleProps } from './message-bubble';

export interface MessageListProps {
  messages: MessageBubbleProps[];
  onEdit?: (messageId: string, newContent: string) => void;
  onDelete?: (messageId: string) => void;
  loading?: boolean;
  editingMessageId?: string | null;
  onEditStart?: (messageId: string) => void;
  onEditCancel?: () => void;
  familyKey?: CryptoKey | null;
  preferredLanguage?: TranslationLanguage | null;
  showTranslation?: boolean;
  autoTranslate?: boolean;
}

export function MessageList({
  messages,
  onEdit,
  onDelete,
  loading = false,
  editingMessageId,
  onEditStart,
  onEditCancel,
  familyKey = null,
  preferredLanguage,
  showTranslation = true,
  autoTranslate = true,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastMessageIdRef = useRef<string | null>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];

    // Only auto-scroll if a new message was added
    if (lastMessage && lastMessage.id !== lastMessageIdRef.current) {
      lastMessageIdRef.current = lastMessage.id;

      // Small delay to ensure DOM has updated
      setTimeout(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [messages]);

  return (
    <ScrollArea className="flex-1 bg-background">
      <div className="p-4 space-y-4">
        {loading && messages.length === 0 && (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            Loading messages...
          </div>
        )}

        {messages.length === 0 && !loading && (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            No messages yet. Start the conversation!
          </div>
        )}

        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            {...message}
            onEdit={onEdit}
            onDelete={onDelete}
            isEditing={editingMessageId === message.id}
            onEditStart={onEditStart}
            onEditCancel={onEditCancel}
            familyKey={familyKey}
            preferredLanguage={preferredLanguage}
            showTranslation={showTranslation}
            autoTranslate={autoTranslate}
          />
        ))}

        {/* Scroll anchor */}
        <div ref={scrollRef} />
      </div>
    </ScrollArea>
  );
}
