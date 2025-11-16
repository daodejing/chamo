'use client';

const INVITEE_FLOW_KEY = 'ourchat.inviteeFlowActive';

export function markInviteeFlowActive(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(INVITEE_FLOW_KEY, 'true');
  } catch {
    // ignore storage errors
  }
}

export function clearInviteeFlowFlag(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(INVITEE_FLOW_KEY);
  } catch {
    // ignore
  }
}

export function isInviteeFlowActive(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(INVITEE_FLOW_KEY) === 'true';
  } catch {
    return false;
  }
}
