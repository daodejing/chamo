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
  ME_QUERY,
} from '../graphql/operations';
import type {
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
} from '../graphql/generated/graphql';
import {
  generateFamilyKey,
  generateInviteCode,
  parseInviteCode,
  initializeFamilyKey,
} from '../e2ee/key-management';

const PENDING_FAMILY_KEY_STORAGE_KEY = 'pending_family_key';
const PENDING_FAMILY_INVITE_STORAGE_KEY = 'pending_family_invite';
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
  refreshUser: () => Promise<void>;
  updateUserPreferences: (preferences: Record<string, unknown> | null) => void;
  register: (input: {
    email: string;
    password: string;
    name: string;
    familyName: string;
  }) => Promise<{ email: string; requiresVerification: boolean } | null>;
  login: (input: { email: string; password: string }) => Promise<PendingVerificationResult | null>;
  joinFamily: (input: {
    email: string;
    password: string;
    name: string;
    inviteCode: string;
  }) => Promise<{ email: string; requiresVerification: boolean } | null>;
  joinFamilyExisting: (inviteCodeWithKey: string, options?: { makeActive?: boolean }) => Promise<void>;
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
    }
  }, [data, error, loading, isClient]);

  // Mutations
  const [registerMutation] = useMutation<RegisterMutation, RegisterMutationVariables>(REGISTER_MUTATION);
  const [loginMutation] = useMutation<LoginMutation, LoginMutationVariables>(LOGIN_MUTATION);
  const [joinFamilyMutation] = useMutation<JoinFamilyMutation, JoinFamilyMutationVariables>(JOIN_FAMILY_MUTATION);
  const [joinFamilyExistingMutation] = useMutation<
    JoinFamilyExistingMutation,
    JoinFamilyExistingMutationVariables
  >(JOIN_FAMILY_EXISTING_MUTATION);
  const [switchFamilyMutation] = useMutation<
    SwitchActiveFamilyMutation,
    SwitchActiveFamilyMutationVariables
  >(SWITCH_ACTIVE_FAMILY_MUTATION);

  // Register function - now returns email for verification redirect
  const register = async (input: {
    email: string;
    password: string;
    name: string;
    familyName: string;
  }): Promise<{ email: string; requiresVerification: boolean } | null> => {
    // Generate family encryption key client-side (E2EE)
    const { base64Key } = await generateFamilyKey();

    // Generate invite code client-side
    const inviteCode = generateInviteCode();

    // Call backend with invite code only (key never sent to backend)
    const { data } = await registerMutation({
      variables: {
        input: {
          ...input,
          inviteCode, // Send only invite code, not the key
        },
      },
    });

    const payload = data?.register;
    if (payload) {
      // New flow: registration returns EmailVerificationResponse
      // User must verify email before logging in
      // Store the family key temporarily in localStorage for after verification
      persistPendingFamilySecrets(base64Key, inviteCode);

      return {
        email: input.email,
        requiresVerification: payload.requiresEmailVerification,
      };
    }

    return null;
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

      await maybeHydratePendingFamilyKey(activeFamily?.id ?? payload.user?.activeFamilyId ?? null);

      return null;
    }

      const pendingFromResult = getPendingVerificationFromErrors(result.errors ?? [], input.email);
      if (pendingFromResult) {
        return pendingFromResult;
      }

      if (result.errors?.length) {
        throw result.errors[0];
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
    inviteCode: string; // Format: FAMILY-XXXXXXXX:BASE64KEY
  }): Promise<{ email: string; requiresVerification: boolean } | null> => {
    // Parse invite code to extract code and family encryption key (E2EE)
    const { code, base64Key } = parseInviteCode(input.inviteCode);

    // Call backend with code only (key never sent to backend)
    const { data } = await joinFamilyMutation({
      variables: {
        input: {
          email: input.email,
          password: input.password,
          name: input.name,
          inviteCode: code, // Send only code portion, not the key
        },
      },
    });

    const payload = data?.joinFamily;
    if (payload) {
      // New flow: join family returns EmailVerificationResponse
      // User must verify email before logging in
      // Store the family key temporarily in localStorage for after verification
      persistPendingFamilySecrets(base64Key, code);

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
    setUser(null);
    setFamily(null);
    apolloClient.clearStore();
  };


  return (
    <AuthContext.Provider
      value={{
        user,
        family,
        loading: !hasCompletedInitialQuery, // Loading until initial auth check completes
        register,
        login,
        joinFamily,
        joinFamilyExisting,
        switchActiveFamily,
        logout,
        refreshUser,
        updateUserPreferences,
      }}
    >
      {children}
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
  if (error instanceof ApolloError) {
    return error.graphQLErrors;
  }

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
    const extensions = graphQlError.extensions ?? {};
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
