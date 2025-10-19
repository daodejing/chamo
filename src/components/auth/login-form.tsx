'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useAuth } from '@/lib/contexts/auth-context';

interface LoginFormProps {
  onSuccess: (response: any) => void;
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsSubmitting(true);
    try {
      // Login with GraphQL
      await login({ email, password });

      toast.success('Login successful!');

      // Redirect will be handled by the login page's useEffect
      // which watches for user state changes
    } catch (error: any) {
      console.error('[LoginForm] Login error:', error);
      console.error('[LoginForm] Error details:', JSON.stringify(error, null, 2));
      const errorMessage = error.message || error.graphQLErrors?.[0]?.message || 'Login failed';
      console.error('[LoginForm] Showing error toast:', errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={isSubmitting}
          className="rounded-xl"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={isSubmitting}
          className="rounded-xl"
        />
      </div>

      <Button
        type="submit"
        className="w-full bg-gradient-to-r from-[#B5179E] to-[#8B38BA] hover:from-[#9c1487] hover:to-[#7a2fa5] text-white rounded-[20px] h-12 shadow-lg"
        disabled={isSubmitting}
      >
        {isSubmitting ? 'Logging in...' : 'Login'}
      </Button>
    </form>
  );
}
