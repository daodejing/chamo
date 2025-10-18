/**
 * Custom React hook for authentication state management.
 * Handles auto-login, session validation, and logout.
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clearKeys } from '@/lib/e2ee/storage';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'member';
  familyId: string;
}

export interface Family {
  id: string;
  name: string;
  avatar: string | null;
}

export interface AuthState {
  user: User | null;
  family: Family | null;
  loading: boolean;
  error: string | null;
}

export function useAuth() {
  const router = useRouter();
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    family: null,
    loading: true,
    error: null,
  });

  // Auto-login on mount: check session
  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      setAuthState((prev) => ({ ...prev, loading: true, error: null }));

      const response = await fetch('/api/auth/session', {
        credentials: 'include', // Include cookies
      });

      if (!response.ok) {
        throw new Error('Failed to validate session');
      }

      const data = await response.json();

      if (data === null) {
        // No valid session
        setAuthState({
          user: null,
          family: null,
          loading: false,
          error: null,
        });
        return;
      }

      // Valid session
      setAuthState({
        user: data.user,
        family: data.family,
        loading: false,
        error: null,
      });
    } catch (error) {
      console.error('Session check error:', error);
      setAuthState({
        user: null,
        family: null,
        loading: false,
        error: 'Failed to validate session',
      });
    }
  };

  const logout = async () => {
    try {
      // Call logout API to invalidate server-side session
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to logout');
      }

      // Clear IndexedDB keys (AC6)
      await clearKeys();

      // Update state
      setAuthState({
        user: null,
        family: null,
        loading: false,
        error: null,
      });

      // Redirect to login
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
      setAuthState((prev) => ({
        ...prev,
        error: 'Failed to logout. Please try again.',
      }));
    }
  };

  const refreshSession = () => {
    checkSession();
  };

  return {
    user: authState.user,
    family: authState.family,
    loading: authState.loading,
    error: authState.error,
    isAuthenticated: authState.user !== null,
    logout,
    refreshSession,
  };
}
