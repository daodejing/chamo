process.env.NEXT_PUBLIC_GRAPHQL_HTTP_URL = 'http://localhost:4000/graphql';
process.env.NEXT_PUBLIC_GRAPHQL_WS_URL = 'ws://localhost:4000/graphql';

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { toast } from 'sonner';

const { mockedGenerateInviteLink } = vi.hoisted(() => ({
  mockedGenerateInviteLink: vi.fn<[], Promise<string>>(),
}));

vi.mock('@/lib/invite/generate-invite-link', () => ({
  generateInviteLink: mockedGenerateInviteLink,
}));
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

const mockedToast = toast as {
  success: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
  info: ReturnType<typeof vi.fn>;
};

const shareMock = vi.fn();
const writeTextMock = vi.fn();

let InviteMemberButton: typeof import('@/components/family/invite-member-button').InviteMemberButton;

beforeAll(async () => {
  ({ InviteMemberButton } = await import('@/components/family/invite-member-button'));
});

describe('InviteMemberButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockedGenerateInviteLink.mockResolvedValue('https://ourchat.app/join/FAMILY-TEST:BASE64');
    process.env.NEXT_PUBLIC_GRAPHQL_HTTP_URL = 'http://localhost:4000/graphql';
    process.env.NEXT_PUBLIC_GRAPHQL_WS_URL = 'ws://localhost:4000/graphql';

    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: shareMock,
    });

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: writeTextMock,
      },
    });

    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shares invite link with Web Share API when available', async () => {
    shareMock.mockResolvedValueOnce(undefined);
    render(
      <InviteMemberButton language="en">
        Share Invite
      </InviteMemberButton>,
    );

    fireEvent.click(screen.getByRole('button', { name: /share invite/i }));

    await waitFor(() => {
      expect(mockedGenerateInviteLink).toHaveBeenCalledTimes(1);
    });

    expect(shareMock).toHaveBeenCalledWith({
      title: 'Join our family on Chamo',
      text: 'Use this link to join our family on Chamo:',
      url: 'https://ourchat.app/join/FAMILY-TEST:BASE64',
    });
    expect(mockedToast.success).toHaveBeenCalledWith('Invite link ready to share!');
  });

  it('falls back to copying link when Web Share API is unavailable', async () => {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: undefined,
    });
    writeTextMock.mockResolvedValueOnce(undefined);

    render(<InviteMemberButton language="en" />);

    fireEvent.click(screen.getByRole('button', { name: /share invite/i }));

    await waitFor(() => {
      expect(mockedGenerateInviteLink).toHaveBeenCalledTimes(1);
    });

    expect(writeTextMock).toHaveBeenCalledWith('https://ourchat.app/join/FAMILY-TEST:BASE64');
    expect(mockedToast.success).toHaveBeenCalledWith('Invitation link copied to clipboard');
  });

  it('shows info toast when user cancels sharing', async () => {
    shareMock.mockRejectedValueOnce(new DOMException('User cancelled', 'AbortError'));

    render(<InviteMemberButton language="en" />);

    fireEvent.click(screen.getByRole('button', { name: /share invite/i }));

    await waitFor(() => {
      expect(mockedGenerateInviteLink).toHaveBeenCalledTimes(1);
    });

    expect(mockedToast.info).toHaveBeenCalledWith('Share cancelled');
    expect(mockedToast.error).not.toHaveBeenCalled();
  });

  it('shows error toast when sharing fails unexpectedly', async () => {
    shareMock.mockRejectedValueOnce(new Error('Something went wrong'));

    render(<InviteMemberButton language="en" />);

    fireEvent.click(screen.getByRole('button', { name: /share invite/i }));

    await waitFor(() => {
      expect(mockedGenerateInviteLink).toHaveBeenCalledTimes(1);
    });

    expect(mockedToast.error).toHaveBeenCalledWith(
      "We couldn't share the invite link. Please try again.",
    );
  });
});
