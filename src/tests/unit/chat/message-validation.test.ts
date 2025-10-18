/**
 * Unit Tests: Message API Validation (Story 2.1)
 * Tests Zod schema validation for sendMessageSchema and getMessagesSchema
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// ============================================================================
// Schema Definitions (extracted from /api/messages/route.ts)
// ============================================================================

const sendMessageSchema = z.object({
  channelId: z.string().uuid('Invalid channel ID format'),
  encryptedContent: z.string().min(1, 'Message content cannot be empty'),
});

const getMessagesSchema = z.object({
  channelId: z.string().uuid('Invalid channel ID format'),
  limit: z.coerce.number().min(1).max(100).default(50),
  before: z.string().datetime().optional(),
});

// ============================================================================
// Tests
// ============================================================================

describe('sendMessageSchema Validation', () => {
  it('should accept valid message data', () => {
    const validData = {
      channelId: '123e4567-e89b-12d3-a456-426614174000',
      encryptedContent: 'U2FsdGVkX19...',
    };

    const result = sendMessageSchema.safeParse(validData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.channelId).toBe(validData.channelId);
      expect(result.data.encryptedContent).toBe(validData.encryptedContent);
    }
  });

  it('should reject invalid UUID format for channelId', () => {
    const invalidData = {
      channelId: 'not-a-uuid',
      encryptedContent: 'U2FsdGVkX19...',
    };

    const result = sendMessageSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toContain('Invalid channel ID format');
    }
  });

  it('should reject empty encryptedContent', () => {
    const invalidData = {
      channelId: '123e4567-e89b-12d3-a456-426614174000',
      encryptedContent: '',
    };

    const result = sendMessageSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toContain('Message content cannot be empty');
    }
  });

  it('should reject missing channelId', () => {
    const invalidData = {
      encryptedContent: 'U2FsdGVkX19...',
    };

    const result = sendMessageSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject missing encryptedContent', () => {
    const invalidData = {
      channelId: '123e4567-e89b-12d3-a456-426614174000',
    };

    const result = sendMessageSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});

describe('getMessagesSchema Validation', () => {
  it('should accept valid query parameters', () => {
    const validData = {
      channelId: '123e4567-e89b-12d3-a456-426614174000',
      limit: '25',
      before: '2025-10-13T12:00:00.000Z',
    };

    const result = getMessagesSchema.safeParse(validData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.channelId).toBe(validData.channelId);
      expect(result.data.limit).toBe(25);
      expect(result.data.before).toBe(validData.before);
    }
  });

  it('should use default limit of 50 if not provided', () => {
    const dataWithoutLimit = {
      channelId: '123e4567-e89b-12d3-a456-426614174000',
    };

    const result = getMessagesSchema.safeParse(dataWithoutLimit);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(50);
    }
  });

  it('should coerce string limit to number', () => {
    const dataWithStringLimit = {
      channelId: '123e4567-e89b-12d3-a456-426614174000',
      limit: '75',
    };

    const result = getMessagesSchema.safeParse(dataWithStringLimit);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(75);
      expect(typeof result.data.limit).toBe('number');
    }
  });

  it('should reject limit greater than 100', () => {
    const invalidData = {
      channelId: '123e4567-e89b-12d3-a456-426614174000',
      limit: '150',
    };

    const result = getMessagesSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject limit less than 1', () => {
    const invalidData = {
      channelId: '123e4567-e89b-12d3-a456-426614174000',
      limit: '0',
    };

    const result = getMessagesSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject invalid UUID format for channelId', () => {
    const invalidData = {
      channelId: 'invalid-uuid',
      limit: '50',
    };

    const result = getMessagesSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toContain('Invalid channel ID format');
    }
  });

  it('should reject invalid datetime format for before parameter', () => {
    const invalidData = {
      channelId: '123e4567-e89b-12d3-a456-426614174000',
      before: 'not-a-datetime',
    };

    const result = getMessagesSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should accept valid ISO 8601 datetime for before parameter', () => {
    const validData = {
      channelId: '123e4567-e89b-12d3-a456-426614174000',
      before: '2025-10-13T15:30:00.000Z',
    };

    const result = getMessagesSchema.safeParse(validData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.before).toBe(validData.before);
    }
  });

  it('should make before parameter optional', () => {
    const dataWithoutBefore = {
      channelId: '123e4567-e89b-12d3-a456-426614174000',
    };

    const result = getMessagesSchema.safeParse(dataWithoutBefore);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.before).toBeUndefined();
    }
  });
});
