/**
 * GraphQL Operations
 *
 * Contains all GraphQL queries, mutations, and subscriptions
 */

import { gql } from '@apollo/client';

// ============================================================================
// AUTHENTICATION
// ============================================================================

export const REGISTER_MUTATION = gql`
  mutation Register($input: RegisterInput!) {
    register(input: $input) {
      accessToken
      refreshToken
      user {
        id
        email
        name
        avatar
        role
        familyId
      }
      family {
        id
        name
        avatar
        inviteCode
        maxMembers
      }
    }
  }
`;

export const LOGIN_MUTATION = gql`
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      accessToken
      refreshToken
      user {
        id
        email
        name
        avatar
        role
        familyId
      }
      family {
        id
        name
        avatar
        inviteCode
        maxMembers
      }
    }
  }
`;

export const JOIN_FAMILY_MUTATION = gql`
  mutation JoinFamily($input: JoinFamilyInput!) {
    joinFamily(input: $input) {
      accessToken
      refreshToken
      user {
        id
        email
        name
        avatar
        role
        familyId
      }
      family {
        id
        name
        avatar
        inviteCode
        maxMembers
      }
    }
  }
`;

export const ME_QUERY = gql`
  query Me {
    me {
      id
      email
      name
      avatar
      role
      familyId
    }
  }
`;

// ============================================================================
// MESSAGING
// ============================================================================

export const SEND_MESSAGE_MUTATION = gql`
  mutation SendMessage($input: SendMessageInput!) {
    sendMessage(input: $input) {
      id
      channelId
      userId
      encryptedContent
      timestamp
      isEdited
      editedAt
      createdAt
      user {
        id
        name
        avatar
      }
    }
  }
`;

export const EDIT_MESSAGE_MUTATION = gql`
  mutation EditMessage($input: EditMessageInput!) {
    editMessage(input: $input) {
      id
      channelId
      userId
      encryptedContent
      timestamp
      isEdited
      editedAt
      createdAt
      user {
        id
        name
        avatar
      }
    }
  }
`;

export const DELETE_MESSAGE_MUTATION = gql`
  mutation DeleteMessage($input: DeleteMessageInput!) {
    deleteMessage(input: $input) {
      success
      messageId
    }
  }
`;

export const GET_MESSAGES_QUERY = gql`
  query GetMessages($input: GetMessagesInput!) {
    getMessages(input: $input) {
      id
      channelId
      userId
      encryptedContent
      timestamp
      isEdited
      editedAt
      createdAt
      user {
        id
        name
        avatar
      }
    }
  }
`;

// ============================================================================
// SUBSCRIPTIONS
// ============================================================================

export const MESSAGE_ADDED_SUBSCRIPTION = gql`
  subscription MessageAdded($channelId: ID!) {
    messageAdded(channelId: $channelId) {
      id
      channelId
      userId
      encryptedContent
      timestamp
      isEdited
      editedAt
      createdAt
      user {
        id
        name
        avatar
      }
    }
  }
`;

export const MESSAGE_EDITED_SUBSCRIPTION = gql`
  subscription MessageEdited($channelId: ID!) {
    messageEdited(channelId: $channelId) {
      id
      channelId
      userId
      encryptedContent
      timestamp
      isEdited
      editedAt
      createdAt
      user {
        id
        name
        avatar
      }
    }
  }
`;

export const MESSAGE_DELETED_SUBSCRIPTION = gql`
  subscription MessageDeleted($channelId: ID!) {
    messageDeleted(channelId: $channelId) {
      messageId
    }
  }
`;
