'use client';

import { useQuery, useMutation, useSubscription } from '@apollo/client/react';
import {
  GET_MESSAGES_QUERY,
  SEND_MESSAGE_MUTATION,
  EDIT_MESSAGE_MUTATION,
  DELETE_MESSAGE_MUTATION,
  MESSAGE_ADDED_SUBSCRIPTION,
  MESSAGE_EDITED_SUBSCRIPTION,
  MESSAGE_DELETED_SUBSCRIPTION,
} from '../graphql/operations';
import { getAuthHeader } from '../graphql/client';

interface Message {
  id: string;
  channelId: string;
  userId: string;
  encryptedContent: string;
  timestamp: Date;
  isEdited: boolean;
  editedAt: Date | null;
  createdAt: Date;
  user: {
    id: string;
    name: string;
    avatar: string | null;
  };
}

interface UseMessagesOptions {
  channelId: string;
  limit?: number;
  cursor?: string;
}

/**
 * Hook to fetch messages for a channel
 */
export function useMessages({ channelId, limit = 50, cursor }: UseMessagesOptions) {
  const { data, loading, error, fetchMore, refetch } = useQuery(GET_MESSAGES_QUERY, {
    variables: {
      input: {
        channelId,
        limit,
        cursor,
      },
    },
    context: {
      headers: getAuthHeader(),
    },
    skip: !channelId,
  });

  return {
    messages: (data?.getMessages || []) as Message[],
    loading,
    error,
    fetchMore,
    refetch,
  };
}

/**
 * Hook to send a message
 */
export function useSendMessage() {
  const [sendMessage, { loading, error }] = useMutation(SEND_MESSAGE_MUTATION, {
    context: {
      headers: getAuthHeader(),
    },
    refetchQueries: ['GetMessages'],
  });

  const send = async (channelId: string, encryptedContent: string) => {
    const result = await sendMessage({
      variables: {
        input: {
          channelId,
          encryptedContent,
        },
      },
    });
    return result.data?.sendMessage as Message;
  };

  return { send, loading, error };
}

/**
 * Hook to edit a message
 */
export function useEditMessage() {
  const [editMessage, { loading, error }] = useMutation(EDIT_MESSAGE_MUTATION, {
    context: {
      headers: getAuthHeader(),
    },
    refetchQueries: ['GetMessages'],
  });

  const edit = async (messageId: string, encryptedContent: string) => {
    const result = await editMessage({
      variables: {
        input: {
          messageId,
          encryptedContent,
        },
      },
    });
    return result.data?.editMessage as Message;
  };

  return { edit, loading, error };
}

/**
 * Hook to delete a message
 */
export function useDeleteMessage() {
  const [deleteMessage, { loading, error }] = useMutation(DELETE_MESSAGE_MUTATION, {
    context: {
      headers: getAuthHeader(),
    },
    refetchQueries: ['GetMessages'],
  });

  const remove = async (messageId: string) => {
    const result = await deleteMessage({
      variables: {
        input: {
          messageId,
        },
      },
    });
    return result.data?.deleteMessage;
  };

  return { remove, loading, error };
}

/**
 * Hook to subscribe to real-time message updates for a channel
 */
export function useMessageSubscription(channelId: string) {
  // Subscribe to new messages
  const {
    data: addedData,
    loading: addedLoading,
    error: addedError,
  } = useSubscription(MESSAGE_ADDED_SUBSCRIPTION, {
    variables: { channelId },
    skip: !channelId,
  });

  // Subscribe to edited messages
  const {
    data: editedData,
    loading: editedLoading,
    error: editedError,
  } = useSubscription(MESSAGE_EDITED_SUBSCRIPTION, {
    variables: { channelId },
    skip: !channelId,
  });

  // Subscribe to deleted messages
  const {
    data: deletedData,
    loading: deletedLoading,
    error: deletedError,
  } = useSubscription(MESSAGE_DELETED_SUBSCRIPTION, {
    variables: { channelId },
    skip: !channelId,
  });

  return {
    messageAdded: addedData?.messageAdded as Message | undefined,
    messageEdited: editedData?.messageEdited as Message | undefined,
    messageDeleted: deletedData?.messageDeleted as { messageId: string } | undefined,
    loading: addedLoading || editedLoading || deletedLoading,
    error: addedError || editedError || deletedError,
  };
}
