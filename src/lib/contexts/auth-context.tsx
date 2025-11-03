'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { ApolloProvider, useMutation, useQuery } from '@apollo/client/react';
import { apolloClient, setAuthToken } from '../graphql/client';
import {
  REGISTER_MUTATION,
  LOGIN_MUTATION,
  JOIN_FAMILY_MUTATION,
  ME_QUERY,
} from '../graphql/operations';
import type {
  RegisterMutation,
  LoginMutation,
  JoinFamilyMutation,
  MeQuery,
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
  familyId: string;
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
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

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
  const { data, loading, error, refetch } = useQuery<MeQuery>(ME_QUERY, {
    skip: !isClient, // Skip until we're on client-side
    fetchPolicy: 'network-only', // Always fetch from network, ignore cache
    errorPolicy: 'all', // Allow partial results even if query errors
    notifyOnNetworkStatusChange: true, // Get updates when network status changes
  });

  const refreshUser = async () => {
    try {
      const result = await refetch();
      if (result.data?.me) {
        setUser(result.data.me);
        setFamily(result.data.me.family || null);
      }
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
      setUser(data.me);
      setFamily(data.me.family || null);
    } else {
      setUser(null);
      setFamily(null);
    }
  }, [data, error, loading, isClient]);

  // Mutations
  const [registerMutation] = useMutation<RegisterMutation>(REGISTER_MUTATION);
  const [loginMutation] = useMutation<LoginMutation>(LOGIN_MUTATION);
  const [joinFamilyMutation] = useMutation<JoinFamilyMutation>(JOIN_FAMILY_MUTATION);

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

    if (data?.register) {
      setAuthToken(data.register.accessToken);
      setUser(data.register.user);

      const familyData = data.register.family;
      if (!familyData?.id) {
        throw new Error('Family identifier missing after registration.');
      }

      // Store family key in IndexedDB for E2EE operations
      await initializeFamilyKey(base64Key, familyData.id);

      // Combine invite code with key for display to user
      const fullInviteCode = createInviteCodeWithKey(familyData.inviteCode, base64Key);

      // Return family data with combined invite code for UI display
      const familyWithFullCode = {
        ...familyData,
        inviteCode: fullInviteCode, // CODE:KEY format for sharing
      };

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

    if (data?.login) {
      setAuthToken(data.login.accessToken);
      setUser(data.login.user);
      setFamily(data.login.family);
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

    if (data?.joinFamily) {
      setAuthToken(data.joinFamily.accessToken);
      setUser(data.joinFamily.user);
      setFamily(data.joinFamily.family);

      // Store family key in IndexedDB for E2EE operations
      const familyData = data.joinFamily.family;
      if (!familyData?.id) {
        throw new Error('Family identifier missing after join.');
      }

      await initializeFamilyKey(base64Key, familyData.id);
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
