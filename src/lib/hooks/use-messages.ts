'use client';

import { useQuery, useMutation, useSubscription } from '@apollo/client/react';
import type {
  DeleteMessageMutation,
  DeleteMessageMutationVariables,
  EditMessageMutation,
  EditMessageMutationVariables,
  GetMessagesQuery,
  GetMessagesQueryVariables,
  MessageAddedSubscription,
  MessageAddedSubscriptionVariables,
  MessageDeletedSubscription,
  MessageDeletedSubscriptionVariables,
  MessageEditedSubscription,
  MessageEditedSubscriptionVariables,
  SendMessageMutation,
  SendMessageMutationVariables,
} from '../graphql/generated/graphql';
import {
  GET_MESSAGES_QUERY,
  SEND_MESSAGE_MUTATION,
  EDIT_MESSAGE_MUTATION,
  DELETE_MESSAGE_MUTATION,
  MESSAGE_ADDED_SUBSCRIPTION,
  MESSAGE_EDITED_SUBSCRIPTION,
  MESSAGE_DELETED_SUBSCRIPTION,
} from '../graphql/operations';

type Message = GetMessagesQuery['getMessages'][number];

interface UseMessagesOptions {
  channelId: string;
  limit?: number;
  cursor?: string;
}

/**
 * Hook to fetch messages for a channel
 * Note: Authentication headers are automatically added by Apollo Client's authLink
 */
export function useMessages({ channelId, limit = 50, cursor }: UseMessagesOptions) {
  const { data, loading, error, fetchMore, refetch } = useQuery<
    GetMessagesQuery,
    GetMessagesQueryVariables
  >(GET_MESSAGES_QUERY, {
    variables: {
      input: {
        channelId,
        limit,
        cursor,
      },
    },
    skip: !channelId,
  });

  return {
    messages: data?.getMessages ?? [],
    loading,
    error,
    fetchMore,
    refetch,
  };
}

/**
 * Hook to send a message
 * Note: Authentication headers are automatically added by Apollo Client's authLink
 */
export function useSendMessage() {
  const [sendMessage, { loading, error }] = useMutation<
    SendMessageMutation,
    SendMessageMutationVariables
  >(SEND_MESSAGE_MUTATION, {
    // Removed refetchQueries - subscriptions handle real-time updates
    // This prevents race condition where query refetch unmounts components
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
    return result.data?.sendMessage;
  };

  return { send, loading, error };
}

/**
 * Hook to edit a message
 * Note: Authentication headers are automatically added by Apollo Client's authLink
 */
export function useEditMessage() {
  const [editMessage, { loading, error }] = useMutation<
    EditMessageMutation,
    EditMessageMutationVariables
  >(EDIT_MESSAGE_MUTATION, {
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
    return result.data?.editMessage;
  };

  return { edit, loading, error };
}

/**
 * Hook to delete a message
 * Note: Authentication headers are automatically added by Apollo Client's authLink
 */
export function useDeleteMessage() {
  const [deleteMessage, { loading, error }] = useMutation<
    DeleteMessageMutation,
    DeleteMessageMutationVariables
  >(DELETE_MESSAGE_MUTATION, {
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
  } = useSubscription<MessageAddedSubscription, MessageAddedSubscriptionVariables>(
    MESSAGE_ADDED_SUBSCRIPTION,
    {
      variables: { channelId },
      skip: !channelId,
    },
  );

  // Subscribe to edited messages
  const {
    data: editedData,
    loading: editedLoading,
    error: editedError,
  } = useSubscription<MessageEditedSubscription, MessageEditedSubscriptionVariables>(
    MESSAGE_EDITED_SUBSCRIPTION,
    {
      variables: { channelId },
      skip: !channelId,
    },
  );

  // Subscribe to deleted messages
  const {
    data: deletedData,
    loading: deletedLoading,
    error: deletedError,
  } = useSubscription<MessageDeletedSubscription, MessageDeletedSubscriptionVariables>(
    MESSAGE_DELETED_SUBSCRIPTION,
    {
      variables: { channelId },
      skip: !channelId,
    },
  );

  return {
    messageAdded: addedData?.messageAdded as Message | undefined,
    messageEdited: editedData?.messageEdited as Message | undefined,
    messageDeleted: deletedData?.messageDeleted,
    loading: addedLoading || editedLoading || deletedLoading,
    error: addedError || editedError || deletedError,
  };
}
