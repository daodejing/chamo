import { describe, it, expect, beforeEach, vi } from 'vitest';

const { queryMock, getFamilyKeyBase64Mock, createInviteCodeWithKeyMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  getFamilyKeyBase64Mock: vi.fn(),
  createInviteCodeWithKeyMock: vi.fn((code: string, key: string) => `${code}:${key}`),
}));

vi.mock('@/lib/graphql/client', () => ({
  apolloClient: {
    query: queryMock,
  },
}));

vi.mock('@/lib/e2ee/key-management', () => ({
  getFamilyKeyBase64: getFamilyKeyBase64Mock,
  createInviteCodeWithKey: createInviteCodeWithKeyMock,
}));

// eslint-disable-next-line import/first
import { generateInviteLink } from '@/lib/invite/generate-invite-link';

describe('generateInviteLink', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    queryMock.mockResolvedValue({
      data: {
        me: {
          id: 'user-1',
          activeFamily: {
            id: 'family-1',
            inviteCode: 'FAMILY-ABC12345',
          },
        },
      },
    });
    getFamilyKeyBase64Mock.mockResolvedValue('c29tZS1rZXk=');
    createInviteCodeWithKeyMock.mockImplementation((code: string, key: string) => `${code}:${key}`);
    process.env.NEXT_PUBLIC_APP_URL = 'https://share.test';
  });

  it('returns invite link combining family code and base64 key', async () => {
    const link = await generateInviteLink();

    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(getFamilyKeyBase64Mock).toHaveBeenCalledWith('family-1');
    expect(createInviteCodeWithKeyMock).toHaveBeenCalledWith('FAMILY-ABC12345', 'c29tZS1rZXk=');
    expect(link).toBe('https://share.test/join/FAMILY-ABC12345:c29tZS1rZXk=');
  });

  it('throws when server response includes key material', async () => {
    queryMock.mockResolvedValueOnce({
      data: {
        me: {
          activeFamily: {
            inviteCode: 'FAMILY-ABC12345:leaky',
          },
        },
      },
    });

    await expect(generateInviteLink()).rejects.toThrow('Server returned invite code with key material');
  });

  it('throws when key is missing from storage', async () => {
    getFamilyKeyBase64Mock.mockResolvedValueOnce(null);

    await expect(generateInviteLink()).rejects.toThrow('Family encryption key not found on this device');
  });

  it('throws when family id missing', async () => {
    queryMock.mockResolvedValueOnce({
      data: {
        me: {
          id: 'user-1',
          activeFamily: {
            inviteCode: 'FAMILY-XYZ',
          },
        },
      },
    });

    await expect(generateInviteLink()).rejects.toThrow('Family ID is unavailable');
  });
});
