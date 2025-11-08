/**
 * MessageBubble Component
 * Displays a single message with sender info, timestamp, and context menu for edit/delete
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { TranslationDisplay } from '@/components/chat/translation-display';
import type { TranslationLanguage } from '@/components/settings/translation-language-selector';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { Edit2, Trash2, Check, X } from 'lucide-react';

export interface MessageBubbleProps {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  timestamp: string;
  isEdited: boolean;
  editedAt?: string | null;
  isMine: boolean;
  onEdit?: (messageId: string, newContent: string) => void;
  onDelete?: (messageId: string) => void;
  isEditing?: boolean;
  onEditStart?: (messageId: string) => void;
  onEditCancel?: () => void;
  familyKey?: CryptoKey | null;
  preferredLanguage?: TranslationLanguage | null;
  showTranslation?: boolean;
  autoTranslate?: boolean;
}

export function MessageBubble({
  id,
  userId,
  userName,
  userAvatar,
  content,
  timestamp,
  isEdited,
  editedAt,
  isMine,
  onEdit,
  onDelete,
  isEditing = false,
  onEditStart,
  onEditCancel,
  familyKey = null,
  preferredLanguage,
  showTranslation = true,
  autoTranslate = true,
}: MessageBubbleProps) {
  const [editedContent, setEditedContent] = useState(content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(editedContent.length, editedContent.length);
    }
  }, [isEditing, editedContent.length]);

  const handleSaveEdit = () => {
    if (onEdit && editedContent.trim() && editedContent !== content) {
      onEdit(id, editedContent.trim());
    } else {
      onEditCancel?.();
    }
  };

  const handleCancelEdit = () => {
    setEditedContent(content); // Reset to original
    onEditCancel?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelEdit();
    }
  };
  const formattedTime = formatDistanceToNow(new Date(timestamp), {
    addSuffix: true,
  });
  const translationEnabled =
    !isMine && showTranslation !== false && autoTranslate !== false;

  const messageContent = (
    <div className={`flex gap-3 group ${isMine ? 'flex-row-reverse' : ''}`}>
      {/* Avatar (only for others' messages) */}
      {!isMine && (
        <Avatar className="w-8 h-8 flex-shrink-0">
          {userAvatar && <AvatarImage src={userAvatar} alt={userName} />}
          <AvatarFallback className="bg-gradient-to-br from-purple-600 to-purple-800 text-white text-xs">
            {userName.substring(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      )}

      <div
        className={`flex flex-col gap-1 max-w-[70%] ${isMine ? 'items-end' : ''}`}
      >
        {/* Sender name (only for others' messages) */}
        {!isMine && (
          <span className="text-xs text-muted-foreground px-1">{userName}</span>
        )}

        {/* Message bubble */}
        <div
          className={`rounded-[20px] px-4 py-3 shadow-md ${
            isMine
              ? 'bg-gradient-to-r from-purple-500 to-purple-700 text-white'
              : 'bg-card border text-card-foreground'
          }`}
        >
          {isEditing ? (
            // Edit mode
            <div className="flex flex-col gap-2">
              <textarea
                ref={textareaRef}
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full min-h-[60px] bg-white/10 text-white placeholder:text-white/50 border-none outline-none resize-none rounded-md p-2"
                placeholder="Edit message..."
              />
              <div className="flex gap-2 justify-end">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCancelEdit}
                  className="h-7 text-white hover:bg-white/20"
                >
                  <X className="w-3 h-3 mr-1" />
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleSaveEdit}
                  disabled={!editedContent.trim() || editedContent === content}
                  className="h-7"
                >
                  <Check className="w-3 h-3 mr-1" />
                  Save
                </Button>
              </div>
            </div>
          ) : (
            // Normal view mode
            <>
              <p className="whitespace-pre-wrap break-words">{content}</p>
              {isEdited && (
                <p
                  className={`text-xs mt-1 ${
                    isMine ? 'text-white/60' : 'text-muted-foreground'
                  }`}
                >
                  (edited)
                </p>
              )}
            </>
          )}
        </div>
        {translationEnabled && (
          <TranslationDisplay
            messageId={id}
            originalText={content}
            familyKey={familyKey}
            preferredLanguage={preferredLanguage}
            enabled={translationEnabled}
          />
        )}

        {/* Timestamp */}
        <span className="text-xs text-muted-foreground px-1">
          {formattedTime}
        </span>
      </div>
    </div>
  );

  // Wrap in context menu only for own messages (and not when editing)
  if (isMine && (onEdit || onDelete) && !isEditing) {
    return (
      <ContextMenu>
        <ContextMenuTrigger>{messageContent}</ContextMenuTrigger>
        <ContextMenuContent>
          {onEdit && onEditStart && (
            <ContextMenuItem onClick={() => onEditStart(id)}>
              <Edit2 className="w-4 h-4 mr-2" />
              Edit
            </ContextMenuItem>
          )}
          {onDelete && (
            <ContextMenuItem
              onClick={() => onDelete(id)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </ContextMenuItem>
          )}
        </ContextMenuContent>
      </ContextMenu>
    );
  }

  return messageContent;
}
