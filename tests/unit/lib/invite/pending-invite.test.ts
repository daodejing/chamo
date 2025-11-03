import { describe, it, expect, beforeEach } from 'vitest';
import {
  storePendingInviteCode,
  consumePendingInviteCode,
} from '@/lib/invite/pending-invite';

describe('pending-invite storage', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('stores and consumes invite code exactly once', () => {
    storePendingInviteCode('FAMILY-AAA:KEY');

    expect(consumePendingInviteCode()).toBe('FAMILY-AAA:KEY');
    expect(consumePendingInviteCode()).toBeNull();
  });

  it('returns null when nothing stored', () => {
    expect(consumePendingInviteCode()).toBeNull();
  });
});

