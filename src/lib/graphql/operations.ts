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
      message
      requiresEmailVerification
      userId
    }
  }
`;

export const CREATE_FAMILY_MUTATION = gql`
  mutation CreateFamily($input: CreateFamilyInput!) {
    createFamily(input: $input) {
      family {
        id
        name
        avatar
        inviteCode
        maxMembers
      }
      inviteCode
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
        activeFamilyId
        activeFamily {
          id
          name
          avatar
          inviteCode
          maxMembers
        }
        memberships {
          id
          role
          familyId
          family {
            id
            name
            avatar
            inviteCode
            maxMembers
          }
        }
        preferences {
          preferredLanguage
        }
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
      message
      requiresEmailVerification
      userId
    }
  }
`;

export const UPDATE_USER_PREFERENCES_MUTATION = gql`
  mutation UpdateUserPreferences($input: UpdateUserPreferencesInput!) {
    updateUserPreferences(input: $input) {
      id
      activeFamilyId
      preferences {
        preferredLanguage
      }
      memberships {
        id
        role
        familyId
        family {
          id
          name
        }
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
      activeFamilyId
      activeFamily {
        id
        name
        avatar
        inviteCode
        maxMembers
      }
      preferences {
        preferredLanguage
      }
      memberships {
        id
        role
        familyId
        family {
          id
          name
          avatar
          inviteCode
          maxMembers
        }
      }
    }
  }
`;

export const GET_USER_PUBLIC_KEY_QUERY = gql`
  query GetUserPublicKey($email: String!) {
    getUserPublicKey(email: $email)
  }
`;

export const CREATE_ENCRYPTED_INVITE_MUTATION = gql`
  mutation CreateEncryptedInvite($input: CreateEncryptedInviteInput!) {
    createEncryptedInvite(input: $input) {
      invite {
        id
        familyId
        inviterId
        inviteeEmail
        inviteCode
        status
        expiresAt
        createdAt
      }
      inviteCode
      message
    }
  }
`;

export const ACCEPT_INVITE_MUTATION = gql`
  mutation AcceptInvite($input: AcceptInviteInput!) {
    acceptInvite(input: $input) {
      success
      message
      familyId
      familyName
      encryptedFamilyKey
      nonce
      inviterPublicKey
    }
  }
`;

export const CREATE_PENDING_INVITE_MUTATION = gql`
  mutation CreatePendingInvite($input: CreatePendingInviteInput!) {
    createPendingInvite(input: $input) {
      invite {
        id
        familyId
        inviterId
        inviteeEmail
        inviteCode
        status
        expiresAt
        createdAt
      }
      inviteCode
      message
    }
  }
`;

export const CREATE_INVITE_MUTATION = gql`
  mutation CreateInvite($input: CreateInviteInput!) {
    createInvite(input: $input) {
      inviteCode
      inviteeEmail
      inviteeLanguage
      expiresAt
    }
  }
`;

export const REPORT_INVITE_DECRYPT_FAILURE_MUTATION = gql`
  mutation ReportInviteDecryptFailure($input: ReportInviteDecryptFailureInput!) {
    reportInviteDecryptFailure(input: $input) {
      success
      message
    }
  }
`;

export const GET_PENDING_INVITES_QUERY = gql`
  query GetPendingInvites($familyId: String!) {
    getPendingInvites(familyId: $familyId) {
      id
      familyId
      inviterId
      inviteeEmail
      encryptedFamilyKey
      nonce
      inviteCode
      status
      expiresAt
      createdAt
    }
  }
`;

export const GET_FAMILY_INVITES_QUERY = gql`
  query GetFamilyInvites($familyId: String!) {
    getFamilyInvites(familyId: $familyId) {
      id
      familyId
      inviterId
      inviteeEmail
      status
      expiresAt
      createdAt
      acceptedAt
    }
  }
`;

export const GET_FAMILY_MEMBERS_QUERY = gql`
  query GetFamilyMembers($familyId: String!) {
    getFamilyMembers(familyId: $familyId) {
      id
      name
      email
      avatar
      role
      joinedAt
    }
  }
`;

export const JOIN_FAMILY_EXISTING_MUTATION = gql`
  mutation JoinFamilyExisting($input: JoinFamilyExistingInput!) {
    joinFamilyAsMember(input: $input) {
      id
      name
      avatar
      inviteCode
      maxMembers
    }
  }
`;

export const SWITCH_ACTIVE_FAMILY_MUTATION = gql`
  mutation SwitchActiveFamily($input: SwitchFamilyInput!) {
    switchActiveFamily(input: $input) {
      id
      activeFamilyId
      activeFamily {
        id
        name
        avatar
        inviteCode
        maxMembers
      }
      memberships {
        id
        role
        familyId
        family {
          id
          name
          avatar
          inviteCode
          maxMembers
        }
      }
      preferences {
        preferredLanguage
      }
    }
  }
`;

export const VERIFY_EMAIL_MUTATION = gql`
  mutation VerifyEmail($token: String!) {
    verifyEmail(token: $token) {
      accessToken
      refreshToken
      user {
        id
        email
        name
        avatar
        role
        emailVerified
        activeFamilyId
        activeFamily {
          id
          name
          avatar
          inviteCode
          maxMembers
        }
        memberships {
          id
          role
          familyId
          family {
            id
            name
            avatar
            inviteCode
            maxMembers
          }
        }
        preferences {
          preferredLanguage
        }
      }
      family {
        id
        name
        avatar
        inviteCode
        maxMembers
      }
      pendingInviteCode
    }
  }
`;

export const RESEND_VERIFICATION_EMAIL_MUTATION = gql`
  mutation ResendVerificationEmail($email: String!) {
    resendVerificationEmail(email: $email) {
      success
      message
    }
  }
`;

// ============================================================================
// CHANNELS
// ============================================================================

export const GET_CHANNELS_QUERY = gql`
  query GetChannels {
    getChannels {
      id
      familyId
      name
      description
      icon
      createdById
      isDefault
      createdAt
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
  subscription MessageAdded($channelId: String!) {
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
  subscription MessageEdited($channelId: String!) {
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
  subscription MessageDeleted($channelId: String!) {
    messageDeleted(channelId: $channelId) {
      messageId
    }
  }
`;

// ============================================================================
// TRANSLATIONS
// ============================================================================

export const MESSAGE_TRANSLATION_QUERY = gql`
  query MessageTranslationLookup($messageId: String!, $targetLanguage: String!) {
    messageTranslation(messageId: $messageId, targetLanguage: $targetLanguage) {
      id
      messageId
      targetLanguage
      encryptedTranslation
      createdAt
    }
  }
`;

export const CACHE_MESSAGE_TRANSLATION_MUTATION = gql`
  mutation CacheMessageTranslationRecord($input: CacheMessageTranslationInput!) {
    cacheMessageTranslation(input: $input) {
      id
      messageId
      targetLanguage
      encryptedTranslation
      createdAt
    }
  }
`;

// ============================================================================
// FAMILY MANAGEMENT
// ============================================================================

export const REMOVE_FAMILY_MEMBER_MUTATION = gql`
  mutation RemoveFamilyMember($input: RemoveFamilyMemberInput!) {
    removeFamilyMember(input: $input) {
      success
      message
    }
  }
`;

export const DEREGISTER_SELF_MUTATION = gql`
  mutation DeregisterSelf {
    deregisterSelf {
      success
      message
    }
  }
`;

// ============================================================================
// STORY 1.15: ADMIN TRANSFER & FAMILY DELETION
// ============================================================================

export const GET_ADMIN_STATUS_QUERY = gql`
  query GetAdminStatus {
    getAdminStatus {
      canDelete
      blockingFamilies {
        familyId
        familyName
        memberCount
        requiresAction
      }
    }
  }
`;

export const PROMOTE_TO_ADMIN_MUTATION = gql`
  mutation PromoteToAdmin($input: PromoteToAdminInput!) {
    promoteToAdmin(input: $input) {
      success
      message
    }
  }
`;

export const DELETE_FAMILY_MUTATION = gql`
  mutation DeleteFamily($input: DeleteFamilyInput!) {
    deleteFamily(input: $input) {
      success
      message
    }
  }
`;
