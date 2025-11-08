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
  createInviteCodeWithKey,
  parseInviteCode,
  initializeFamilyKey,
} from '../e2ee/key-management';
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
  }) => Promise<Family | null>;
  login: (input: { email: string; password: string }) => Promise<void>;
  joinFamily: (input: {
    email: string;
    password: string;
    name: string;
    inviteCode: string;
  }) => Promise<void>;
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

  // Register function
  const register = async (input: {
    email: string;
    password: string;
    name: string;
    familyName: string;
  }) => {
    // Generate family encryption key client-side (E2EE)
    const { familyKey, base64Key } = await generateFamilyKey();

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
      setAuthToken(payload.accessToken);
      const familyData = payload.family;
      if (!familyData?.id) {
        throw new Error('Family identifier missing after registration.');
      }

      // Store family key in IndexedDB for E2EE operations
      await initializeFamilyKey(base64Key, familyData.id);

      // Combine invite code with key for display to user
      const fullInviteCode = createInviteCodeWithKey(familyData.inviteCode, base64Key);

      const familyWithFullCode: Family = {
        ...toFamily(familyData),
        inviteCode: fullInviteCode,
      };

      const membershipsWithInvite = (payload.user?.memberships ?? []).map((membership) =>
        membership.familyId === familyWithFullCode.id
          ? {
              ...membership,
              family: {
                ...membership.family,
                inviteCode: fullInviteCode,
              },
            }
          : membership,
      );

      const normalizedUser = normalizeUserPayload({
        ...payload.user,
        activeFamily: familyWithFullCode,
        activeFamilyId: familyWithFullCode.id,
        memberships: membershipsWithInvite,
      });

      if (!normalizedUser) {
        throw new Error('Failed to normalize user after registration.');
      }

      setUser(normalizedUser);
      setFamily(familyWithFullCode);
      return familyWithFullCode;
    }

    return null;
  };

  // Login function
  const login = async (input: { email: string; password: string }) => {
    const { data } = await loginMutation({
      variables: { input },
    });

    const payload = data?.login;
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
    }
  };

  // Join family function
  const joinFamily = async (input: {
    email: string;
    password: string;
    name: string;
    inviteCode: string; // Format: FAMILY-XXXXXXXX:BASE64KEY
  }) => {
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
      setAuthToken(payload.accessToken);
      const familyData = payload.family;
      if (!familyData?.id) {
        throw new Error('Family identifier missing after join.');
      }

      await initializeFamilyKey(base64Key, familyData.id);

      const familyWithFullCode: Family = {
        ...toFamily(familyData),
        inviteCode: input.inviteCode,
      };

      const membershipsWithInvite = (payload.user?.memberships ?? []).map((membership) =>
        membership.familyId === familyWithFullCode.id
          ? {
              ...membership,
              family: {
                ...membership.family,
                inviteCode: input.inviteCode,
              },
            }
          : membership,
      );

      const normalizedUser = normalizeUserPayload({
        ...payload.user,
        activeFamily: familyWithFullCode,
        activeFamilyId: familyWithFullCode.id,
        memberships: membershipsWithInvite,
      });

      setUser(normalizedUser);
      setFamily(familyWithFullCode);
    }
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
