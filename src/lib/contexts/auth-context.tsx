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

function AuthProviderInner({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [family, setFamily] = useState<Family | null>(null);

  // Query current user
  const { data, loading, refetch } = useQuery(ME_QUERY, {
    skip: typeof window === 'undefined' || !localStorage.getItem('accessToken'),
    notifyOnNetworkStatusChange: false,
    onCompleted: (data) => {
      if (data?.me) {
        setUser(data.me);
        setFamily(data.me.family);
      }
    },
    onError: () => {
      // Token expired or invalid
      setAuthToken(null);
      setUser(null);
      setFamily(null);
    },
  });

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
      console.log('[AuthContext] Login successful', data.login);
      setAuthToken(data.login.accessToken);
      setUser(data.login.user);
      setFamily(data.login.family);
      console.log('[AuthContext] User and family state updated');
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

  // Check for existing token on mount (only run once)
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (token && !user) {
      refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Intentionally empty - only run on mount

  return (
    <AuthContext.Provider
      value={{
        user,
        family,
        loading,
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
