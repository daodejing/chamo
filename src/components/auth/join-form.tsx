'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { joinSchema, type JoinInput } from '@/lib/validators/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useState } from 'react';
import { useAuth } from '@/lib/contexts/auth-context';

interface JoinFormProps {
  onSuccess: (response: {
    user: { id: string; email: string; name: string; role: string; familyId: string; encryptedFamilyKey: string };
    family: { id: string; name: string };
    session: { accessToken: string; refreshToken: string };
  }) => void;
}

export function JoinForm({ onSuccess }: JoinFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { joinFamily, family } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<JoinInput>({
    resolver: zodResolver(joinSchema),
  });

  const onSubmit = async (data: JoinInput) => {
    setIsSubmitting(true);
    try {
      // Join family with GraphQL
      await joinFamily({
        email: data.email,
        password: data.password,
        name: data.userName,
        inviteCode: data.inviteCode,
      });

      toast.success('Welcome to your family!');

      onSuccess({
        user: {
          id: '',
          email: data.email,
          name: data.userName,
          role: 'MEMBER',
          familyId: family?.id || '',
          encryptedFamilyKey: '',
        },
        family: {
          id: family?.id || '',
          name: family?.name || '',
        },
        session: {
          accessToken: '',
          refreshToken: '',
        },
      });
    } catch (error: any) {
      toast.error(error.message || 'Failed to join family');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="userName">Your Name</Label>
        <Input
          id="userName"
          {...register('userName')}
          placeholder="John Doe"
          disabled={isSubmitting}
          className="rounded-xl"
        />
        {errors.userName && (
          <p className="text-sm text-destructive">{errors.userName.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          {...register('email')}
          placeholder="john@example.com"
          disabled={isSubmitting}
          className="rounded-xl"
        />
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          {...register('password')}
          placeholder="At least 8 characters"
          disabled={isSubmitting}
          className="rounded-xl"
        />
        {errors.password && (
          <p className="text-sm text-destructive">{errors.password.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="inviteCode">Invite Code</Label>
        <Input
          id="inviteCode"
          {...register('inviteCode')}
          placeholder="FAMILY-XXXXXXXX:KEY"
          disabled={isSubmitting}
          className="rounded-xl"
        />
        {errors.inviteCode && (
          <p className="text-sm text-destructive">{errors.inviteCode.message}</p>
        )}
        <p className="text-sm text-muted-foreground">
          Enter the invite code shared by your family
        </p>
      </div>

      <Button
        type="submit"
        className="w-full bg-gradient-to-r from-[#B5179E] to-[#8B38BA] hover:from-[#9c1487] hover:to-[#7a2fa5] text-white rounded-[20px] h-12 shadow-lg"
        disabled={isSubmitting}
      >
        {isSubmitting ? 'Joining Family...' : 'Join Family'}
      </Button>
    </form>
  );
}
