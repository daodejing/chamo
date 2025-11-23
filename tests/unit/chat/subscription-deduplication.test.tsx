/**
 * Unit tests for subscription deduplication (StrictMode setState updater behavior)
 */

import { describe, it, expect } from 'vitest';

type DisplayMessage = {
  id: string;
  message: string;
};

describe('Subscription Deduplication - StrictMode setState Behavior', () => {
  it('should return same array reference when setState updater called twice (StrictMode simulation)', () => {
    // Simulate the caching mechanism keyed by prev state reference
    const setStateResultsRef = new Map<
      string,
      { prevRef: DisplayMessage[]; result: DisplayMessage[] }
    >();

    const initialState: DisplayMessage[] = [
      { id: 'msg-1', message: 'Hello' },
      { id: 'msg-2', message: 'World' },
    ];

    const newMessage: DisplayMessage = { id: 'msg-3', message: 'New' };

    // Simulate setState updater function
    const updater = (prev: DisplayMessage[]): DisplayMessage[] => {
      const cached = setStateResultsRef.get(newMessage.id);
      if (cached && cached.prevRef === prev) {
        return cached.result;
      }

      // Check if already exists
      const exists = prev.some((m) => m.id === newMessage.id);
      if (exists) {
        return prev;
      }

      // Create new array and cache it
      const updated = [...prev, newMessage];
      setStateResultsRef.set(newMessage.id, { prevRef: prev, result: updated });
      return updated;
    };

    // StrictMode calls updater twice with SAME prev state
    const result1 = updater(initialState);
    const result2 = updater(initialState); // Same prev, not result1!

    // Both calls should return the SAME array reference
    expect(result1).toBe(result2);
    expect(result1).toHaveLength(3);
    expect(result1[2]).toEqual(newMessage);

    // Verify it's the cached result, not a new array
    expect(Object.is(result1, result2)).toBe(true);
  });

  it('should handle different messages independently', () => {
    const setStateResultsRef = new Map<
      string,
      { prevRef: DisplayMessage[]; result: DisplayMessage[] }
    >();
    const initialState: DisplayMessage[] = [];

    const message1: DisplayMessage = { id: 'msg-1', message: 'First' };
    const message2: DisplayMessage = { id: 'msg-2', message: 'Second' };

    const createUpdater = (msg: DisplayMessage) => (prev: DisplayMessage[]) => {
      const cached = setStateResultsRef.get(msg.id);
      if (cached && cached.prevRef === prev) {
        return cached.result;
      }

      const exists = prev.some((m) => m.id === msg.id);
      if (exists) {
        return prev;
      }

      const updated = [...prev, msg];
      setStateResultsRef.set(msg.id, { prevRef: prev, result: updated });
      return updated;
    };

    // Process first message (StrictMode: called twice)
    const updater1 = createUpdater(message1);
    const result1a = updater1(initialState);
    const result1b = updater1(initialState);

    expect(result1a).toBe(result1b);
    expect(result1a).toHaveLength(1);

    // Process second message (StrictMode: called twice)
    const updater2 = createUpdater(message2);
    const result2a = updater2(result1a);
    const result2b = updater2(result1a);

    expect(result2a).toBe(result2b);
    expect(result2a).toHaveLength(2);
    expect(result2a[0]).toEqual(message1);
    expect(result2a[1]).toEqual(message2);
  });

  it('should not add message if it already exists in state', () => {
    const setStateResultsRef = new Map<
      string,
      { prevRef: DisplayMessage[]; result: DisplayMessage[] }
    >();

    const existingMessage: DisplayMessage = { id: 'msg-1', message: 'Exists' };
    const stateWithMessage: DisplayMessage[] = [existingMessage];

    const updater = (prev: DisplayMessage[]): DisplayMessage[] => {
      const cached = setStateResultsRef.get(existingMessage.id);
      if (cached && cached.prevRef === prev) {
        return cached.result;
      }

      const exists = prev.some((m) => m.id === existingMessage.id);
      if (exists) {
        return prev; // Return same reference
      }

      const updated = [...prev, existingMessage];
      setStateResultsRef.set(existingMessage.id, { prevRef: prev, result: updated });
      return updated;
    };

    // Try to add message that already exists
    const result = updater(stateWithMessage);

    // Should return the same array reference (no new array created)
    expect(result).toBe(stateWithMessage);
    expect(result).toHaveLength(1);
  });

  it('returns fresh array when prev state changes (e.g., edited message)', () => {
    const setStateResultsRef = new Map<
      string,
      { prevRef: DisplayMessage[]; result: DisplayMessage[] }
    >();

    const initialState: DisplayMessage[] = [{ id: 'msg-1', message: 'Hello' }];
    const newMessage: DisplayMessage = { id: 'msg-2', message: 'New' };

    const updater = (prev: DisplayMessage[]): DisplayMessage[] => {
      const cached = setStateResultsRef.get(newMessage.id);
      if (cached && cached.prevRef === prev) {
        return cached.result;
      }

      const exists = prev.some((m) => m.id === newMessage.id);
      if (exists) {
        return prev;
      }

      const updated = [...prev, newMessage];
      setStateResultsRef.set(newMessage.id, { prevRef: prev, result: updated });
      return updated;
    };

    // First StrictMode-style double call returns same reference
    const result1 = updater(initialState);
    const result2 = updater(initialState);
    expect(result1).toBe(result2);

    // Simulate later change to prev state (e.g., message edited upstream)
    const editedState = result1.map((msg) =>
      msg.id === 'msg-1' ? { ...msg, message: 'Hello (edited)' } : msg,
    );

    const resultAfterEdit = updater(editedState);
    expect(resultAfterEdit).not.toBe(result1);
    expect(resultAfterEdit[0].message).toBe('Hello (edited)');
  });
});
