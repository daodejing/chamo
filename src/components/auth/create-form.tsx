'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, type RegisterInput } from '@/lib/validators/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useState } from 'react';
import { useAuth } from '@/lib/contexts/auth-context';

interface CreateFormProps {
  onSuccess: (response: {
    user: { id: string; email: string; name: string; role: string; familyId: string; encryptedFamilyKey: string };
    family: { id: string; name: string; inviteCode: string };
    session: { accessToken: string; refreshToken: string };
  }) => void;
}

export function CreateForm({ onSuccess }: CreateFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { register: registerUser, family } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterInput) => {
    setIsSubmitting(true);
    try {
      // Register with GraphQL
      await registerUser({
        email: data.email,
        password: data.password,
        name: data.userName,
        familyName: data.familyName,
      });

      // Get family data from context
      const familyData = family;

      // Show invite code to admin (10 second duration for copying)
      if (familyData) {
        toast.success(
          `Family created! Share this invite code: ${familyData.inviteCode}`,
          { duration: 10000 }
        );
      }

      onSuccess({
        user: {
          id: '',
          email: data.email,
          name: data.userName,
          role: 'ADMIN',
          familyId: familyData?.id || '',
          encryptedFamilyKey: '',
        },
        family: {
          id: familyData?.id || '',
          name: familyData?.name || '',
          inviteCode: familyData?.inviteCode || '',
        },
        session: {
          accessToken: '',
          refreshToken: '',
        },
      });
    } catch (error: any) {
      toast.error(error.message || 'Failed to create family');
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
        <Label htmlFor="familyName">Family Name</Label>
        <Input
          id="familyName"
          {...register('familyName')}
          placeholder="The Smiths"
          disabled={isSubmitting}
          className="rounded-xl"
        />
        {errors.familyName && (
          <p className="text-sm text-destructive">{errors.familyName.message}</p>
        )}
      </div>

      <Button
        type="submit"
        className="w-full bg-gradient-to-r from-[#B5179E] to-[#8B38BA] hover:from-[#9c1487] hover:to-[#7a2fa5] text-white rounded-[20px] h-12 shadow-lg"
        disabled={isSubmitting}
      >
        {isSubmitting ? 'Creating Family...' : 'Create Family'}
      </Button>
    </form>
  );
}
