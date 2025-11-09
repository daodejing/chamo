'use client';

const SESSION_STORAGE_KEY = 'ourchat.pendingInviteCode';
const LOCAL_STORAGE_KEY = 'ourchat.pendingInviteCode.persistent';

function setSessionValue(inviteCode: string) {
  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, inviteCode);
  } catch {
    // ignore storage failures (private mode, quota, etc.)
  }
}

function setLocalValue(inviteCode: string) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, inviteCode);
  } catch {
    // ignore storage failures
  }
}

export function storePendingInviteCode(inviteCode: string): void {
  if (typeof window === 'undefined') return;

  setSessionValue(inviteCode);
  setLocalValue(inviteCode);
}

export function storePersistentPendingInviteCode(inviteCode: string | null): void {
  if (typeof window === 'undefined') return;

  try {
    if (inviteCode) {
      localStorage.setItem(LOCAL_STORAGE_KEY, inviteCode);
    } else {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}

export function peekPendingInviteCode(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const sessionValue = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (sessionValue) {
      return sessionValue;
    }
  } catch {
    // ignore
  }

  try {
    const localValue = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (localValue) {
      return localValue;
    }
  } catch {
    // ignore
  }

  return null;
}

export function consumePendingInviteCode(): string | null {
  const value = peekPendingInviteCode();

  if (typeof window === 'undefined') {
    return value;
  }

  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // ignore
  }

  try {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  } catch {
    // ignore
  }

  return value;
}

export function getPendingInviteCodeForRegistration(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const localValue = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (localValue) {
      return localValue;
    }
  } catch {
    // ignore
  }

  try {
    const sessionValue = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (sessionValue) {
      return sessionValue;
    }
  } catch {
    // ignore
  }

  return null;
}
