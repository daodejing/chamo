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
import {
  generateFamilyKey,
  parseInviteCode,
  initializeFamilyKey,
} from '../e2ee/key-management';
import { clearKeys } from '../e2ee/storage';

interface User {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  role: 'ADMIN' | 'MEMBER';
  familyId: string;
}

interface Family {
  id: string;
  name: string;
  avatar: string | null;
  inviteCode: string;
  maxMembers: number;
}

interface AuthContextType {
  user: User | null;
  family: Family | null;
  loading: boolean;
  register: (input: {
    email: string;
    password: string;
    name: string;
    familyName: string;
  }) => Promise<void>;
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
  const { data, loading, error, refetch } = useQuery(ME_QUERY, {
    skip: !isClient, // Skip until we're on client-side
    fetchPolicy: 'network-only', // Always fetch from network, ignore cache
    errorPolicy: 'all', // Allow partial results even if query errors
    notifyOnNetworkStatusChange: true, // Get updates when network status changes
  });

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
      setFamily(data.me.family);
    } else {
      setUser(null);
      setFamily(null);
    }
  }, [data, error, loading, isClient]);

  // Mutations
  const [registerMutation] = useMutation(REGISTER_MUTATION);
  const [loginMutation] = useMutation(LOGIN_MUTATION);
  const [joinFamilyMutation] = useMutation(JOIN_FAMILY_MUTATION);

  // Register function
  const register = async (input: {
    email: string;
    password: string;
    name: string;
    familyName: string;
  }) => {
    // Generate family encryption key client-side (E2EE)
    const { familyKey, base64Key } = await generateFamilyKey();

    // Call backend with generated key
    const { data } = await registerMutation({
      variables: {
        input: {
          ...input,
          familyKeyBase64: base64Key, // Pass base64-encoded key to backend
        },
      },
    });

    if (data?.register) {
      setAuthToken(data.register.accessToken);
      setUser(data.register.user);
      setFamily(data.register.family);

      // Store family key in IndexedDB for E2EE operations
      await initializeFamilyKey(base64Key);
    }
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
    // Parse invite code to extract family encryption key (E2EE)
    const { code, base64Key } = parseInviteCode(input.inviteCode);

    // Call backend with full invite code (backend will parse it too)
    const { data } = await joinFamilyMutation({
      variables: {
        input: {
          ...input,
          inviteCode: input.inviteCode, // Send full invite code with embedded key
        },
      },
    });

    if (data?.joinFamily) {
      setAuthToken(data.joinFamily.accessToken);
      setUser(data.joinFamily.user);
      setFamily(data.joinFamily.family);

      // Store family key in IndexedDB for E2EE operations
      await initializeFamilyKey(base64Key);
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
