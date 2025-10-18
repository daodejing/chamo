'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CreateForm } from '@/components/auth/create-form';
import { LoginForm } from '@/components/auth/login-form';
import { JoinForm } from '@/components/auth/join-form';
import { initializeFamilyKey } from '@/lib/e2ee/key-management';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageCircle, Fingerprint } from 'lucide-react';
import { useAuth } from '@/lib/hooks/use-auth';

type AuthMode = 'login' | 'create' | 'join';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('create');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const { isAuthenticated, loading: authLoading } = useAuth();

  // Auto-login: if already authenticated, redirect to /chat (AC3)
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.push('/chat');
    }
  }, [isAuthenticated, authLoading, router]);

  const handleSuccess = async (response: {
    user: { encryptedFamilyKey?: string };
  }) => {
    try {
      setLoading(true);

      // Store family key in IndexedDB (if available)
      if (response.user.encryptedFamilyKey) {
        await initializeFamilyKey(response.user.encryptedFamilyKey);
      }

      // Redirect to chat
      router.push('/chat');
    } catch (error) {
      console.error('Failed to initialize session:', error);
      // Still redirect to chat even if key initialization fails
      router.push('/chat');
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricAuth = async () => {
    setIsAuthenticating(true);
    // Simulate biometric authentication
    // In a real app, this would use Web Authentication API
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      // Mock login - would call actual auth endpoint
    } catch (error) {
      console.error('Biometric auth failed:', error);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const getTitle = () => {
    switch (authMode) {
      case 'create':
        return 'Create Family Account';
      case 'join':
        return 'Join Family';
      default:
        return 'Login to Continue';
    }
  };

  const getToggleText = () => {
    switch (authMode) {
      case 'create':
        return 'Already have an account? Login';
      case 'join':
        return 'Create a new family instead';
      default:
        return "Don't have an account? Create Family";
    }
  };

  const getSecondaryToggleText = () => {
    if (authMode === 'create' || authMode === 'login') {
      return 'Have an invite code? Join Family';
    }
    return 'Already have an account? Login';
  };

  const handleToggle = () => {
    if (authMode === 'login') setAuthMode('create');
    else if (authMode === 'create') setAuthMode('login');
    else setAuthMode('create');
  };

  const handleSecondaryToggle = () => {
    if (authMode === 'join') setAuthMode('login');
    else setAuthMode('join');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 dark">
      <Card className="w-full max-w-md shadow-xl rounded-[20px]">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-gradient-to-br from-[#B5179E] to-[#5518C1] rounded-[20px] flex items-center justify-center shadow-lg">
              <MessageCircle className="w-8 h-8 text-white" />
            </div>
          </div>
          <div>
            <CardTitle>OurChat</CardTitle>
            <CardDescription>{getTitle()}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {authMode === 'create' && <CreateForm onSuccess={handleSuccess} />}

            {authMode === 'login' && <LoginForm onSuccess={handleSuccess} />}

            {authMode === 'join' && <JoinForm onSuccess={handleSuccess} />}

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">or</span>
              </div>
            </div>

            {/* Biometric Login Button */}
            <Button
              type="button"
              onClick={handleBiometricAuth}
              disabled={isAuthenticating}
              variant="outline"
              className="w-full rounded-[20px] h-12 border-2 hover:bg-muted"
            >
              <Fingerprint className="w-5 h-5 mr-2" />
              {isAuthenticating ? 'Authenticating...' : 'Login with Face ID'}
            </Button>

            {/* Toggle Links */}
            <div className="text-center space-y-2">
              <button
                type="button"
                onClick={handleToggle}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors block w-full"
              >
                {getToggleText()}
              </button>
              <button
                type="button"
                onClick={handleSecondaryToggle}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors block w-full"
              >
                {getSecondaryToggleText()}
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
