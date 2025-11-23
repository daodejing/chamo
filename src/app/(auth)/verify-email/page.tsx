'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { gql } from '@apollo/client';
import { useMutation } from '@apollo/client/react';
import { initializeFamilyKey } from '@/lib/e2ee/key-management';
import { clearPendingFamilySecrets, getPendingFamilySecrets } from '@/lib/contexts/auth-context';
import { storePersistentPendingInviteCode } from '@/lib/invite/pending-invite';

const VERIFY_EMAIL = gql`
  mutation VerifyEmail($token: String!) {
    verifyEmail(token: $token) {
      accessToken
      refreshToken
      user {
        id
        email
        name
        emailVerified
      }
      family {
        id
        name
        inviteCode
      }
      pendingInviteCode
    }
  }
`;

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token') || '';

  const [verifyMutation, { loading }] = useMutation(VERIFY_EMAIL);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState(false);
  const redirectScheduledRef = useRef(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Verification token is missing');
      return;
    }

    const verify = async () => {
      try {
        console.log('[VERIFY] Starting verification with token:', token);
        const { data } = await verifyMutation({
          variables: { token },
        });
        console.log('[VERIFY] Mutation response:', JSON.stringify(data, null, 2));

        if (data?.verifyEmail) {
          const familyId = data.verifyEmail.family?.id ?? null;
          const pendingSecrets = getPendingFamilySecrets();
          const pendingInviteFromServer = data.verifyEmail.pendingInviteCode ?? null;

          if (pendingSecrets?.base64Key && familyId) {
            try {
              await initializeFamilyKey(pendingSecrets.base64Key, familyId);
            } catch (keyError) {
              console.error('Failed to persist family key after verification', keyError);
            }
          }
          if (pendingInviteFromServer) {
            storePersistentPendingInviteCode(pendingInviteFromServer);
          } else {
            storePersistentPendingInviteCode(null);
          }
          const inviteToDisplay = pendingSecrets?.inviteCode ?? pendingInviteFromServer ?? null;
          if (inviteToDisplay) {
            setInviteCode(inviteToDisplay);
          }

          console.log('[VERIFY] Setting success and scheduling redirect');
          setSuccess(true);
          if (!redirectScheduledRef.current) {
            redirectScheduledRef.current = true;
            const redirectUrl = `/login?verified=success&email=${encodeURIComponent(data.verifyEmail.user.email)}`;
            console.log('[VERIFY] Will redirect to:', redirectUrl);
            setTimeout(() => {
              console.log('[VERIFY] Redirecting now to:', redirectUrl);
              router.replace(redirectUrl);
            }, 2500);
          }
        }
      } catch (err: unknown) {
        const error = err as Error;
        console.error('[VERIFY] Verification error:', error);
        if (error.message?.includes('already been used')) {
          setError('This verification link has already been used. Please log in.');
        } else if (error.message?.includes('expired')) {
          setError('This verification link has expired. Please request a new one.');
        } else {
          setError('Invalid or expired verification token.');
        }
        clearPendingFamilySecrets();
      }
    };

    verify();
  }, [token, verifyMutation, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-indigo-600 border-r-transparent"></div>
          <p className="text-lg text-gray-900">Verifying your email...</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-8">
          <div>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <svg
                className="h-10 w-10 text-green-600"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
              Email verified!
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Your account is active. Taking you back to the login screen so you can sign in.
            </p>
            {inviteCode && (
              <p className="mt-4 rounded-md bg-slate-50 p-3 text-center text-sm text-slate-700">
                Save this invite code for new family members: <span className="font-mono">{inviteCode}</span>
              </p>
            )}
          </div>

          <button
            onClick={() => router.replace('/login')}
            className="flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Continue to login
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-8">
          <div>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <svg
                className="h-10 w-10 text-red-600"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                />
              </svg>
            </div>
            <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
              Verification failed
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">{error}</p>
          </div>

          <div className="space-y-4">
            {error.includes('expired') && (
              <button
                onClick={() => router.push('/verification-pending')}
                className="flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                Request new verification email
              </button>
            )}

            <button
              onClick={() => router.push('/login')}
              className="flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              Back to login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}
