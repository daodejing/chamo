'use client';

import { apolloClient } from '../graphql/client';
import { ME_QUERY } from '../graphql/operations';
import {
  createInviteCodeWithKey,
  getFamilyKeyBase64,
} from '../e2ee/key-management';

type MeQueryResult = {
  me?: {
    id: string;
    family?: {
      id: string;
      inviteCode?: string | null;
    } | null;
  } | null;
};

const DEFAULT_APP_URL = 'https://ourchat.app';

function resolveAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/$/, '');
  }

  return DEFAULT_APP_URL;
}

function assertInviteCodeFormat(code: string | null | undefined): string {
  const trimmed = code?.trim();

  if (!trimmed) {
    throw new Error('Family invite code is unavailable. Ask the administrator to generate one.');
  }

  if (trimmed.includes(':')) {
    throw new Error('Server returned invite code with key material. Aborting share to preserve E2EE.');
  }

  if (!trimmed.startsWith('FAMILY-')) {
    throw new Error('Invalid invite code format. Expected FAMILY- prefix.');
  }

  return trimmed;
}

function assertBase64KeyFormat(base64Key: string | null): string {
  if (!base64Key) {
    throw new Error('Family encryption key not found on this device. Join a family or refresh keys before sharing.');
  }

  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64Key)) {
    throw new Error('Stored family encryption key is corrupted or invalid.');
  }

  return base64Key;
}

async function fetchFamilyInviteDetails(): Promise<{ inviteCode: string; familyId: string }> {
  const { data } = await apolloClient.query<MeQueryResult>({
    query: ME_QUERY,
    fetchPolicy: 'network-only',
  });

  const inviteCode = assertInviteCodeFormat(data?.me?.family?.inviteCode);
  const familyId = data?.me?.family?.id;

  if (!familyId) {
    throw new Error('Family ID is unavailable. Cannot generate invitation link.');
  }

  return { inviteCode, familyId };
}

async function exportFamilyKey(familyId: string): Promise<string> {
  const base64Key = await getFamilyKeyBase64(familyId);
  return assertBase64KeyFormat(base64Key);
}

/**
 * Generates a sharable invitation link containing the family code and encryption key.
 * Format: https://ourchat.app/join/FAMILY-XXXXXXXXXXXX:BASE64KEY
 * The server only ever sees the invite code (code portion). The key stays client-side.
 */
export async function generateInviteLink(): Promise<string> {
  if (typeof window === 'undefined') {
    throw new Error('generateInviteLink must run in a browser environment.');
  }

  const { inviteCode, familyId } = await fetchFamilyInviteDetails();
  const base64Key = await exportFamilyKey(familyId);

  const packagedCode = createInviteCodeWithKey(inviteCode, base64Key);
  const appUrl = resolveAppUrl();

  return `${appUrl}/join/${packagedCode}`;
}

export type { MeQueryResult };
