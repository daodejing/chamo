import { describe, it, expect, beforeEach } from 'vitest';
import {
  storePendingInviteCode,
  consumePendingInviteCode,
  peekPendingInviteCode,
  storePersistentPendingInviteCode,
  getPendingInviteCodeForRegistration,
} from '@/lib/invite/pending-invite';

describe('pending-invite storage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('stores and consumes invite code exactly once', () => {
    storePendingInviteCode('FAMILY-AAA:KEY');

    expect(consumePendingInviteCode()).toBe('FAMILY-AAA:KEY');
    expect(consumePendingInviteCode()).toBeNull();
  });

  it('returns null when nothing stored', () => {
    expect(consumePendingInviteCode()).toBeNull();
  });

  it('persists value across sessions via localStorage', () => {
    storePersistentPendingInviteCode('INV-XYZ:KEY');

    // Simulate loss of sessionStorage data
    sessionStorage.clear();

    expect(peekPendingInviteCode()).toBe('INV-XYZ:KEY');
    expect(getPendingInviteCodeForRegistration()).toBe('INV-XYZ:KEY');
  });

  it('clears persisted value when consumed', () => {
    storePendingInviteCode('INV-ABC:KEY');
    expect(peekPendingInviteCode()).toBe('INV-ABC:KEY');
    expect(consumePendingInviteCode()).toBe('INV-ABC:KEY');
    expect(peekPendingInviteCode()).toBeNull();
    expect(getPendingInviteCodeForRegistration()).toBeNull();
  });
});
