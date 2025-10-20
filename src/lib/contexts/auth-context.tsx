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
  logout: () => void;
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
    const { data } = await registerMutation({
      variables: { input },
    });

    if (data?.register) {
      setAuthToken(data.register.accessToken);
      setUser(data.register.user);
      setFamily(data.register.family);
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
    inviteCode: string;
  }) => {
    const { data } = await joinFamilyMutation({
      variables: { input },
    });

    if (data?.joinFamily) {
      setAuthToken(data.joinFamily.accessToken);
      setUser(data.joinFamily.user);
      setFamily(data.joinFamily.family);
    }
  };

  // Logout function
  const logout = () => {
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
