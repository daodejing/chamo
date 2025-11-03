'use client';

const STORAGE_KEY = 'ourchat.pendingInviteCode';

export function storePendingInviteCode(inviteCode: string): void {
  if (typeof window === 'undefined') return;

  sessionStorage.setItem(STORAGE_KEY, inviteCode);
}

export function consumePendingInviteCode(): string | null {
  if (typeof window === 'undefined') return null;

  const value = sessionStorage.getItem(STORAGE_KEY);

  if (value) {
    sessionStorage.removeItem(STORAGE_KEY);
    return value;
  }

  return null;
}

