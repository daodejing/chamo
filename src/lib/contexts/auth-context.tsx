'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { ApolloProvider, useMutation, useQuery } from '@apollo/client/react';
import { apolloClient, setAuthToken } from '../graphql/client';
import {
  REGISTER_MUTATION,
  LOGIN_MUTATION,
  JOIN_FAMILY_MUTATION,
  JOIN_FAMILY_EXISTING_MUTATION,
  SWITCH_ACTIVE_FAMILY_MUTATION,
  CREATE_FAMILY_MUTATION,
  ACCEPT_INVITE_MUTATION,
  REPORT_INVITE_DECRYPT_FAILURE_MUTATION,
  ME_QUERY,
} from '../graphql/operations';
import type {
  CreateFamilyMutation,
  CreateFamilyMutationVariables,
  JoinFamilyExistingMutation,
  JoinFamilyExistingMutationVariables,
  JoinFamilyMutation,
  JoinFamilyMutationVariables,
  LoginMutation,
  LoginMutationVariables,
  MeQuery,
  MeQueryVariables,
  RegisterMutation,
  RegisterMutationVariables,
  SwitchActiveFamilyMutation,
  SwitchActiveFamilyMutationVariables,
  AcceptInviteMutation,
  AcceptInviteMutationVariables,
  ReportInviteDecryptFailureMutation,
  ReportInviteDecryptFailureMutationVariables,
} from '../graphql/generated/graphql';
import {
  parseInviteCode,
  initializeFamilyKey,
  generateFamilyKey,
  generateInviteCode,
  createInviteCodeWithKey,
} from '../e2ee/key-management';
import { decryptFamilyKey } from '../e2ee/invite-encryption';
import { generateKeypair } from '@/lib/crypto/keypair';
import { storePrivateKey, hasPrivateKey } from '@/lib/crypto/secure-storage';
import {
  LostKeyModal,
  hasSeenLostKeyModal,
  markLostKeyModalShown,
  clearLostKeyModalFlag,
} from '@/components/auth/lost-key-modal';
import { getPendingInviteCodeForRegistration } from '@/lib/invite/pending-invite';

const PENDING_FAMILY_KEY_STORAGE_KEY = 'pending_family_key';
const PENDING_FAMILY_INVITE_STORAGE_KEY = 'pending_family_invite';
export const ENCRYPTION_KEY_ERROR_CODE = 'toast.encryptionKeyError';
interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string | null;
  role: string;
  activeFamilyId?: string | null;
  activeFamily?: Family | null;
  memberships: FamilyMembership[];
  preferences?: {
    preferredLanguage?: string | null;
    [key: string]: unknown;
  } | null;
}

interface Family {
  id: string;
  name: string;
  avatar?: string | null;
  inviteCode: string;
  maxMembers: number;
}

interface FamilyMembership {
  id: string;
  role: string;
  familyId: string;
  family: Family;
}

type PendingVerificationResult = {
  email: string;
  requiresVerification: true;
};

interface PendingFamilySecrets {
  base64Key: string;
  inviteCode: string | null;
}

interface AuthContextType {
  user: User | null;
  family: Family | null;
  loading: boolean;
  lostKeyModalOpen: boolean;
  dismissLostKeyModal: () => void;
  refreshUser: () => Promise<void>;
  updateUserPreferences: (preferences: Record<string, unknown> | null) => void;
  register: (input: {
    email: string;
    password: string;
    name: string;
  }) => Promise<{ email: string; requiresVerification: boolean } | null>;
  createFamily: (familyName: string) => Promise<{ family: Family; inviteCodeWithKey: string }>;
  login: (input: { email: string; password: string }) => Promise<PendingVerificationResult | null>;
  joinFamily: (input: {
    email: string;
    password: string;
    name: string;
    inviteCode: string;
  }) => Promise<{ email: string; requiresVerification: boolean } | null>;
  joinFamilyExisting: (inviteCodeWithKey: string, options?: { makeActive?: boolean }) => Promise<void>;
  acceptInvite: (inviteCode: string) => Promise<{ familyId: string; familyName: string }>;
  switchActiveFamily: (familyId: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function normalizeUserPayload(raw: any): User | null {
  if (!raw) {
    return null;
  }

  const memberships = Array.isArray(raw.memberships) ? raw.memberships : [];

  return {
    ...raw,
    memberships,
    activeFamily: raw.activeFamily ?? null,
    activeFamilyId: raw.activeFamilyId ?? raw.activeFamily?.id ?? null,
  } as User;
}

function toFamily(payload: {
  id: string;
  name: string;
  inviteCode: string;
  maxMembers: number;
  avatar?: string | null;
}): Family {
  return {
    id: payload.id,
    name: payload.name,
    inviteCode: payload.inviteCode,
    maxMembers: payload.maxMembers,
    avatar: payload.avatar ?? null,
  };
}

function AuthProviderInner({ children }: { children: React.ReactNode}) {
  const [user, setUser] = useState<User | null>(null);
  const [family, setFamily] = useState<Family | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [hasCompletedInitialQuery, setHasCompletedInitialQuery] = useState(false);
  const [lostKeyModalOpen, setLostKeyModalOpen] = useState(false);

  // Set isClient to true only on client-side
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Query current user - only on client-side where localStorage exists
  const { data, loading, error, refetch } = useQuery<MeQuery, MeQueryVariables>(ME_QUERY, {
    skip: !isClient, // Skip until we're on client-side
    fetchPolicy: 'network-only', // Always fetch from network, ignore cache
    errorPolicy: 'all', // Allow partial results even if query errors
    notifyOnNetworkStatusChange: true, // Get updates when network status changes
  });

  const refreshUser = async () => {
    try {
      const result = await refetch();
      const normalized = normalizeUserPayload(result.data?.me ?? null);
      setUser(normalized);
      setFamily(normalized?.activeFamily ?? null);
      return;
    } catch (refreshError) {
      console.error('Failed to refresh user:', refreshError);
      setAuthToken(null);
      setUser(null);
      setFamily(null);
      setLostKeyModalOpen(false);
    }
  };

  const updateUserPreferences = (preferences: Record<string, unknown> | null) => {
    setUser((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        preferences: preferences ?? null,
      };
    });
  };

  // Handle query results with useEffect (callbacks don't fire reliably with skip)
  useEffect(() => {
    if (!isClient || loading) return;

    // Mark that initial query has completed
    setHasCompletedInitialQuery(true);

    if (error) {
      // Token expired, invalid, or missing - clear auth state
      setAuthToken(null);
      setUser(null);
      setFamily(null);
      return;
    }

    if (data?.me) {
      const normalized = normalizeUserPayload(data.me);
      setUser(normalized);
      setFamily(normalized?.activeFamily ?? null);
    } else {
      setUser(null);
      setFamily(null);
      setLostKeyModalOpen(false);
    }
  }, [data, error, loading, isClient]);

  useEffect(() => {
    if (!isClient) return;

    let cancelled = false;

    const check = async () => {
      if (!user) {
        clearLostKeyModalFlag();
        setLostKeyModalOpen(false);
        return;
      }

      try {
        const exists = await hasPrivateKey(user.id);
        if (cancelled) return;
        if (!exists) {
          if (!hasSeenLostKeyModal(user.id)) {
            setLostKeyModalOpen(true);
          }
        } else {
          clearLostKeyModalFlag(user.id);
          setLostKeyModalOpen(false);
        }
      } catch (err) {
        console.warn('Failed to evaluate lost key state', err);
      }
    };

    check();

    return () => {
      cancelled = true;
    };
  }, [user, isClient]);

  // Mutations
  const [registerMutation] = useMutation<RegisterMutation, RegisterMutationVariables>(REGISTER_MUTATION);
  const [createFamilyMutation] = useMutation<CreateFamilyMutation, CreateFamilyMutationVariables>(CREATE_FAMILY_MUTATION);
  const [loginMutation] = useMutation<LoginMutation, LoginMutationVariables>(LOGIN_MUTATION);
  const [joinFamilyMutation] = useMutation<JoinFamilyMutation, JoinFamilyMutationVariables>(JOIN_FAMILY_MUTATION);
  const [joinFamilyExistingMutation] = useMutation<
    JoinFamilyExistingMutation,
    JoinFamilyExistingMutationVariables
  >(JOIN_FAMILY_EXISTING_MUTATION);
  const [acceptInviteMutation] = useMutation<AcceptInviteMutation, AcceptInviteMutationVariables>(ACCEPT_INVITE_MUTATION);
  const [reportInviteDecryptFailure] = useMutation<
    ReportInviteDecryptFailureMutation,
    ReportInviteDecryptFailureMutationVariables
  >(REPORT_INVITE_DECRYPT_FAILURE_MUTATION);
  const [switchFamilyMutation] = useMutation<
    SwitchActiveFamilyMutation,
    SwitchActiveFamilyMutationVariables
  >(SWITCH_ACTIVE_FAMILY_MUTATION);

  // Register function - now returns email for verification redirect
  const register = async (input: {
    email: string;
    password: string;
    name: string;
  }): Promise<{ email: string; requiresVerification: boolean } | null> => {
    const { publicKey, secretKey } = createKeypairOrThrow();
    const pendingInviteCode = getPendingInviteCodeForRegistration();

    // Call backend to create account (no family creation)
    const { data } = await registerMutation({
      variables: {
        input: {
          email: input.email,
          password: input.password,
          name: input.name,
          publicKey,
          ...(pendingInviteCode ? { pendingInviteCode } : {}),
        },
      },
    });

    const payload = data?.register;
    if (payload) {
      await storePrivateKeyOrThrow(payload.userId, secretKey);
      // User must verify email before logging in
      // After verification, user can create or join a family

      return {
        email: input.email,
        requiresVerification: payload.requiresEmailVerification,
      };
    }

    return null;
  };

  // Create family function - authenticated users only
  const createFamily = async (
    familyName: string,
  ): Promise<{ family: Family; inviteCodeWithKey: string }> => {
    if (!user) {
      throw new Error('Must be authenticated to create a family');
    }

    // Generate family encryption key (E2EE)
    const { base64Key } = await generateFamilyKey();

    // Generate invite code
    const inviteCode = generateInviteCode();

    // Call backend to create family (key never sent to backend)
    const { data } = await createFamilyMutation({
      variables: {
        input: {
          name: familyName,
          inviteCode,
        },
      },
    });

    const payload = data?.createFamily;
    if (!payload) {
      throw new Error('Failed to create family');
    }

    // Store family key locally (E2EE)
    await initializeFamilyKey(base64Key, payload.family.id);

    // Refresh user to get updated role (ADMIN) and family
    await refreshUser();

    const createdFamily = toFamily(payload.family);
    setFamily(createdFamily);

    // Return family and shareable invite code with key
    const inviteCodeWithKey = createInviteCodeWithKey(inviteCode, base64Key);
    return {
      family: createdFamily,
      inviteCodeWithKey,
    };
  };

  // Login function
  const login = async (input: { email: string; password: string }): Promise<PendingVerificationResult | null> => {
    try {
      const result = await loginMutation({
        variables: { input },
        errorPolicy: 'all',
      });

      const payload = result.data?.login;
      if (payload) {
        setAuthToken(payload.accessToken);
        const activeFamilyPayload = payload.family ?? payload.user?.activeFamily ?? null;
        const activeFamily = activeFamilyPayload ? toFamily(activeFamilyPayload) : null;
        const normalizedUser = normalizeUserPayload({
          ...payload.user,
        activeFamily,
        activeFamilyId: activeFamily?.id ?? null,
      });

        setUser(normalizedUser);
        setFamily(activeFamily);
        setLostKeyModalOpen(false);

      await maybeHydratePendingFamilyKey(activeFamily?.id ?? payload.user?.activeFamilyId ?? null);

        return null;
      }

      const pendingFromResult = getPendingVerificationFromErrors(result.error ? [result.error as GraphQlErrorLike] : [], input.email);
      if (pendingFromResult) {
        return pendingFromResult;
      }

      if (result.error) {
        throw result.error;
      }

      return null;
    } catch (error) {
      const pendingVerification = extractPendingVerification(error, input.email);
      if (pendingVerification) {
        return pendingVerification;
      }
      throw error;
    }
  };

  // Join family function
  const joinFamily = async (input: {
    email: string;
    password: string;
    name: string;
    inviteCode: string; // Format: FAMILY-XXXXXXXX:BASE64KEY or plain code for email-bound invites
  }): Promise<{ email: string; requiresVerification: boolean } | null> => {
    const { publicKey, secretKey } = createKeypairOrThrow();

    // Check if this is an email-bound invite (Story 1.5) or encrypted invite (Story 1.8)
    // Email-bound invites are plain codes, encrypted invites have CODE:KEY format
    let code: string;
    let base64Key: string | null = null;

    if (input.inviteCode.includes(':')) {
      // Encrypted invite (Story 1.8): Parse code and key
      const parsed = parseInviteCode(input.inviteCode);
      code = parsed.code;
      base64Key = parsed.base64Key;
    } else {
      // Email-bound invite (Story 1.5): Plain code, no key
      code = input.inviteCode;
    }

    // Call backend with code only (key never sent to backend)
    const { data } = await joinFamilyMutation({
      variables: {
        input: {
          email: input.email,
          password: input.password,
          name: input.name,
          inviteCode: code,
          publicKey,
        },
      },
    });

    const payload = data?.joinFamily;
    if (payload) {
      await storePrivateKeyOrThrow(payload.userId, secretKey);
      // New flow: join family returns EmailVerificationResponse
      // User must verify email before logging in
      // Store the family key temporarily in localStorage for after verification (only for encrypted invites)
      if (base64Key) {
        persistPendingFamilySecrets(base64Key, code);
      }

      return {
        email: input.email,
        requiresVerification: payload.requiresEmailVerification,
      };
    }

    return null;
  };

  const joinFamilyExisting = async (
    inviteCodeWithKey: string,
    options?: { makeActive?: boolean },
  ) => {
    if (!user) {
      throw new Error('Must be authenticated to join a family');
    }

    const { code, base64Key } = parseInviteCode(inviteCodeWithKey);

    const { data } = await joinFamilyExistingMutation({
      variables: {
        input: {
          inviteCode: code,
          makeActive: options?.makeActive ?? true,
        },
      },
    });

    const joinedFamily = data?.joinFamilyAsMember;
    if (joinedFamily?.id) {
      await initializeFamilyKey(base64Key, joinedFamily.id);
    }

    await refreshUser();

    if (joinedFamily && (options?.makeActive ?? true)) {
      const normalizedFamily: Family = {
        ...toFamily(joinedFamily),
        inviteCode: inviteCodeWithKey,
      };
      setFamily(normalizedFamily);
    }
  };

  const acceptInvite = async (inviteCode: string): Promise<{ familyId: string; familyName: string }> => {
    if (!user) {
      throw new Error('Must be authenticated to accept an invite');
    }

    // Call backend to accept invite and get encrypted family key
    const { data } = await acceptInviteMutation({
      variables: {
        input: {
          inviteCode,
        },
      },
    });

    const response = data?.acceptInvite;
    if (!response) {
      throw new Error('Failed to accept invite');
    }

    // Decrypt the family key using the inviter's public key and recipient's private key
    let decryptedFamilyKeyBase64: string;
    try {
      decryptedFamilyKeyBase64 = await decryptFamilyKey(
        response.encryptedFamilyKey,
        response.nonce,
        response.inviterPublicKey,
        user.id
      );
    } catch (decryptError) {
      await reportInviteDecryptFailure({
        variables: {
          input: {
            inviteCode,
            reason:
              decryptError instanceof Error
                ? decryptError.message
                : 'Unknown invite decrypt failure',
          },
        },
      }).catch((telemetryError) => {
        console.warn('Failed to report invite decrypt failure', telemetryError);
      });
      throw decryptError;
    }

    // Store the decrypted family key in IndexedDB
    await initializeFamilyKey(decryptedFamilyKeyBase64, response.familyId);

    // Refresh user to get updated family membership
    await refreshUser();
    await apolloClient.reFetchObservableQueries(true);

    return {
      familyId: response.familyId,
      familyName: response.familyName,
    };
  };

  const switchActiveFamily = async (familyId: string) => {
    const { data } = await switchFamilyMutation({
      variables: {
        input: {
          familyId,
        },
      },
    });

    if (data?.switchActiveFamily) {
      const updatedUser = normalizeUserPayload(data.switchActiveFamily);
      setUser(updatedUser);
      setFamily(updatedUser?.activeFamily ?? null);
      await refreshUser();
    }
  };

  // Logout function
  const logout = async () => {
    // NOTE: We do NOT clear IndexedDB encryption keys on logout
    // This preserves true E2EE - keys never leave the client
    // User can manually clear browser data if they want to remove keys
    // This is BY DESIGN for privacy - no server-side key backup will be implemented

    // Clear tokens and auth state
    setAuthToken(null);
    if (user?.id) {
      clearLostKeyModalFlag(user.id);
    }
    setUser(null);
    setFamily(null);
    setLostKeyModalOpen(false);
    apolloClient.clearStore();
  };

  const handleDismissLostKeyModal = () => {
    if (user?.id) {
      markLostKeyModalShown(user.id);
    }
    setLostKeyModalOpen(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        family,
        loading: !hasCompletedInitialQuery, // Loading until initial auth check completes
        lostKeyModalOpen,
        dismissLostKeyModal: handleDismissLostKeyModal,
        register,
        createFamily,
        login,
        joinFamily,
        joinFamilyExisting,
        acceptInvite,
        switchActiveFamily,
        logout,
        refreshUser,
        updateUserPreferences,
      }}
    >
      {children}
      <LostKeyModal open={lostKeyModalOpen} onContinue={handleDismissLostKeyModal} />
    </AuthContext.Provider>
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <ApolloProvider client={apolloClient}>
      <AuthProviderInner>{children}</AuthProviderInner>
    </ApolloProvider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

function createKeypairOrThrow() {
  try {
    return generateKeypair();
  } catch (error) {
    console.error('Failed to generate encryption keys', error);
    throw translationError(ENCRYPTION_KEY_ERROR_CODE);
  }
}

async function storePrivateKeyOrThrow(userId: string, secretKey: Uint8Array) {
  try {
    await storePrivateKey(userId, secretKey);
  } catch (error) {
    console.error('Failed to store encryption keys', error);
    throw translationError(ENCRYPTION_KEY_ERROR_CODE);
  }
}

function translationError(key: string): Error {
  const err = new Error(key);
  (err as Error & { translationKey?: string }).translationKey = key;
  return err;
}

function persistPendingFamilySecrets(base64Key: string, inviteCode: string) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(PENDING_FAMILY_KEY_STORAGE_KEY, base64Key);
  window.localStorage.setItem(PENDING_FAMILY_INVITE_STORAGE_KEY, inviteCode);
}

export function getPendingFamilySecrets(): PendingFamilySecrets | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const base64Key = window.localStorage.getItem(PENDING_FAMILY_KEY_STORAGE_KEY);
  if (!base64Key) {
    return null;
  }

  const inviteCode = window.localStorage.getItem(PENDING_FAMILY_INVITE_STORAGE_KEY);
  return {
    base64Key,
    inviteCode,
  };
}

export function clearPendingFamilySecrets() {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(PENDING_FAMILY_KEY_STORAGE_KEY);
  window.localStorage.removeItem(PENDING_FAMILY_INVITE_STORAGE_KEY);
}

function extractPendingVerification(
  error: unknown,
  fallbackEmail: string,
): PendingVerificationResult | null {
  const graphQlErrors = getGraphQlErrors(error);
  return getPendingVerificationFromErrors(graphQlErrors, fallbackEmail);
}

type GraphQlErrorLike = {
  extensions?: {
    response?: {
      requiresEmailVerification?: boolean;
      email?: string;
    };
  };
};

function getGraphQlErrors(error: unknown): GraphQlErrorLike[] {
  const maybeErrors = (error as { graphQLErrors?: unknown })?.graphQLErrors;
  if (Array.isArray(maybeErrors)) {
    return maybeErrors as GraphQlErrorLike[];
  }

  return [];
}

function getPendingVerificationFromErrors(
  errors: GraphQlErrorLike[],
  fallbackEmail: string,
): PendingVerificationResult | null {
  for (const graphQlError of errors) {
    const extensions = (graphQlError.extensions ?? {}) as Record<string, any>;
    const response =
      (extensions.response as { requiresEmailVerification?: boolean; email?: string } | undefined) ??
      (extensions.originalError as { requiresEmailVerification?: boolean; email?: string } | undefined) ??
      (extensions.exception as { requiresEmailVerification?: boolean; email?: string } | undefined);

    if (response?.requiresEmailVerification) {
      return {
        email: response.email ?? fallbackEmail,
        requiresVerification: true,
      };
    }

    const directExtensions = extensions as
      | {
          requiresEmailVerification?: boolean;
          email?: string;
        }
      | undefined;

    if (directExtensions?.requiresEmailVerification) {
      return {
        email: directExtensions.email ?? fallbackEmail,
        requiresVerification: true,
      };
    }

    if (typeof graphQlError === 'object' && graphQlError && 'message' in graphQlError) {
      const message = (graphQlError as { message?: string }).message ?? '';
      if (message.toLowerCase().includes('email not verified')) {
        return {
          email: fallbackEmail,
          requiresVerification: true,
        };
      }
    }
  }

  return null;
}

async function maybeHydratePendingFamilyKey(familyId: string | null | undefined) {
  if (!familyId) {
    return;
  }
  const pendingSecrets = getPendingFamilySecrets();
  if (!pendingSecrets?.base64Key) {
    return;
  }

  try {
    await initializeFamilyKey(pendingSecrets.base64Key, familyId);
  } catch (error) {
    console.error('Failed to initialize pending family key after login', error);
  } finally {
    clearPendingFamilySecrets();
  }
}
