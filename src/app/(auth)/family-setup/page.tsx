'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/lib/contexts/auth-context';
import { useLanguage } from '@/lib/contexts/language-context';
import { t } from '@/lib/translations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function FamilySetupPage() {
  const router = useRouter();
  const { createFamily, joinFamilyExisting, user } = useAuth();
  const { language } = useLanguage();

  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  // Create family state
  const [familyName, setFamilyName] = useState('');

  // Join family state
  const [inviteCode, setInviteCode] = useState('');
  const [createdInviteCode, setCreatedInviteCode] = useState<string | null>(null);

  const handleCreateFamily = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!familyName.trim()) {
      toast.error(t('toast.familyNameRequired', language));
      return;
    }

    setIsCreating(true);

    try {
      const { inviteCodeWithKey } = await createFamily(familyName.trim());

      toast.success(t('toast.familyCreated', language));

      // Show invite code to user
      setCreatedInviteCode(inviteCodeWithKey);

      // Redirect to chat after a moment
      setTimeout(() => {
        router.push('/chat');
      }, 3000);
    } catch (error) {
      console.error('Create family error:', error);
      toast.error(t('toast.familyCreationFailed', language));
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinFamily = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!inviteCode.trim()) {
      toast.error(t('toast.inviteCodeRequired', language));
      return;
    }

    setIsJoining(true);

    try {
      await joinFamilyExisting(inviteCode.trim());

      toast.success(t('toast.familyJoined', language));

      // Redirect to chat
      router.push('/chat');
    } catch (error) {
      console.error('Join family error:', error);
      toast.error(t('toast.familyJoinFailed', language));
    } finally {
      setIsJoining(false);
    }
  };

  const copyInviteCode = () => {
    if (!createdInviteCode) return;

    navigator.clipboard.writeText(createdInviteCode);
    toast.success(t('toast.inviteCodeCopied', language));
  };

  if (!user) {
    router.push('/login');
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t('familySetup.title', language)}</CardTitle>
          <CardDescription>{t('familySetup.description', language)}</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="create" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="create">{t('familySetup.createTab', language)}</TabsTrigger>
              <TabsTrigger value="join">{t('familySetup.joinTab', language)}</TabsTrigger>
            </TabsList>

            <TabsContent value="create">
              {createdInviteCode ? (
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 rounded-md">
                    <p className="text-sm text-green-800 font-medium mb-2">
                      {t('familySetup.familyCreatedSuccess', language)}
                    </p>
                    <p className="text-xs text-green-700 mb-3">
                      {t('familySetup.shareInviteCode', language)}
                    </p>
                    <div className="bg-white p-3 rounded border border-green-200">
                      <code className="text-xs break-all">{createdInviteCode}</code>
                    </div>
                    <Button
                      onClick={copyInviteCode}
                      variant="outline"
                      size="sm"
                      className="w-full mt-2"
                    >
                      {t('familySetup.copyInviteCode', language)}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    {t('familySetup.redirectingToChat', language)}
                  </p>
                </div>
              ) : (
                <form onSubmit={handleCreateFamily} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="familyName">
                      {t('familySetup.familyNameLabel', language)}
                    </Label>
                    <Input
                      id="familyName"
                      type="text"
                      placeholder={t('familySetup.familyNamePlaceholder', language)}
                      value={familyName}
                      onChange={(e) => setFamilyName(e.target.value)}
                      disabled={isCreating}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isCreating}>
                    {isCreating
                      ? t('familySetup.creating', language)
                      : t('familySetup.createFamily', language)}
                  </Button>
                </form>
              )}
            </TabsContent>

            <TabsContent value="join">
              <form onSubmit={handleJoinFamily} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="inviteCode">
                    {t('familySetup.inviteCodeLabel', language)}
                  </Label>
                  <Input
                    id="inviteCode"
                    type="text"
                    placeholder={t('familySetup.inviteCodePlaceholder', language)}
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    disabled={isJoining}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('familySetup.inviteCodeHelp', language)}
                  </p>
                </div>
                <Button type="submit" className="w-full" disabled={isJoining}>
                  {isJoining
                    ? t('familySetup.joining', language)
                    : t('familySetup.joinFamily', language)}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button variant="ghost" size="sm" onClick={() => router.push('/login')}>
            {t('familySetup.backToLogin', language)}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
