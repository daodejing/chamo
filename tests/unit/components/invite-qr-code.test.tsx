process.env.NEXT_PUBLIC_GRAPHQL_HTTP_URL = 'http://localhost:4000/graphql';
process.env.NEXT_PUBLIC_GRAPHQL_WS_URL = 'ws://localhost:4000/graphql';

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const { generateInviteLinkMock, toDataUrlMock } = vi.hoisted(() => ({
  generateInviteLinkMock: vi.fn<[], Promise<string>>(),
  toDataUrlMock: vi.fn<[string, Record<string, unknown>], Promise<string>>(),
}));

vi.mock('@/lib/invite/generate-invite-link', () => ({
  generateInviteLink: generateInviteLinkMock,
}));

vi.mock('qrcode', () => ({
  default: {
    toDataURL: toDataUrlMock,
  },
}));

let InviteQrCode: typeof import('@/components/family/invite-qr-code').InviteQrCode;

describe('InviteQrCode', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeAll(async () => {
    ({ InviteQrCode } = await import('@/components/family/invite-qr-code'));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    generateInviteLinkMock.mockResolvedValue('https://ourchat.app/join/FAMILY');
    toDataUrlMock.mockResolvedValue('data:image/png;base64,abc123');
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('renders QR code image after successful generation', async () => {
    render(<InviteQrCode familyName="The Smiths" language="en" />);

    expect(await screen.findByRole('img', { name: /the smiths invitation qr code/i })).toBeVisible();

    expect(generateInviteLinkMock).toHaveBeenCalledTimes(1);
    expect(toDataUrlMock).toHaveBeenCalledWith(
      'https://ourchat.app/join/FAMILY',
      expect.objectContaining({ width: 320 }),
    );
  });

  it('shows retry UI when generation fails', async () => {
    toDataUrlMock.mockRejectedValueOnce(new Error('failed'));

    render(<InviteQrCode familyName="The Smiths" language="en" />);

    expect(await screen.findByText(/couldn't generate the qr code/i)).toBeVisible();

    toDataUrlMock.mockResolvedValueOnce('data:image/png;base64,success');

    fireEvent.click(screen.getByRole('button', { name: /try again/i }));

    await waitFor(() => {
      expect(screen.getByRole('img', { name: /the smiths invitation qr code/i })).toBeVisible();
    });

    expect(generateInviteLinkMock).toHaveBeenCalledTimes(2);
  });
});
