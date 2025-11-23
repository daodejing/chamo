process.env.NEXT_PUBLIC_GRAPHQL_HTTP_URL = 'http://localhost:4000/graphql';
process.env.NEXT_PUBLIC_GRAPHQL_WS_URL = 'ws://localhost:4000/graphql';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TranslationDisplay } from '@/components/chat/translation-display';

const { mutateMock, decryptMessageMock, encryptMessageMock, mockClient } = vi.hoisted(() => {
  const mutateMock = vi.fn();
  const mockClient = {
    mutate: mutateMock,
  };
  return {
    mutateMock,
    mockClient,
    decryptMessageMock: vi.fn<[], Promise<string>>(),
    encryptMessageMock: vi.fn<[string, CryptoKey], Promise<string>>(),
  };
});

vi.mock('@apollo/client/react', async () => {
  const actual = await vi.importActual<typeof import('@apollo/client/react')>('@apollo/client/react');
  return {
    ...actual,
    useApolloClient: () => mockClient,
  };
});

vi.mock('@/lib/e2ee/encryption', () => ({
  decryptMessage: decryptMessageMock,
  encryptMessage: encryptMessageMock,
}));

const fetchMock = vi.fn();
const originalFetch = global.fetch;

class MockIntersectionObserver {
  observe() {
    // no-op in test environment
  }

  disconnect() {}
  unobserve() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

// @ts-expect-error - jsdom environment polyfill
global.IntersectionObserver = MockIntersectionObserver;

if (!(AbortSignal as any).timeout) {
  (AbortSignal as any).timeout = () => new AbortController().signal;
}

describe('TranslationDisplay', () => {
  beforeEach(() => {
    mutateMock.mockReset();
    decryptMessageMock.mockReset();
    encryptMessageMock.mockReset();
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    window.localStorage.clear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('renders decrypted cached translation from backend REST API', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        cached: true,
        encryptedTranslation: 'cipher',
      }),
    });
    decryptMessageMock.mockResolvedValue('こんにちは');

    window.localStorage.setItem('accessToken', 'token');

    render(
      <TranslationDisplay
        messageId="msg-1"
        originalText="hello"
        familyKey={{} as CryptoKey}
        preferredLanguage="ja"
      />,
    );

    // In test env, isVisible and hasIntersected start as true, so no need to trigger

    expect(await screen.findByText('こんにちは')).toBeVisible();
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4000/api/translate',
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(decryptMessageMock).toHaveBeenCalledWith('cipher', expect.any(Object));
  });

  it('requests translation from backend and caches encrypted value', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ translation: 'Bonjour', cached: false }),
    });
    encryptMessageMock.mockResolvedValue('encrypted-bonjour');
    mutateMock.mockResolvedValue({ data: {} });

    window.localStorage.setItem('accessToken', 'token');

    render(
      <TranslationDisplay
        messageId="msg-2"
        originalText="hello"
        familyKey={{} as CryptoKey}
        preferredLanguage="fr"
      />,
    );

    // In test env, isVisible and hasIntersected start as true, so no need to trigger

    expect(await screen.findByText('Bonjour')).toBeVisible();
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4000/api/translate',
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(encryptMessageMock).toHaveBeenCalledWith('Bonjour', expect.any(Object));
    expect(mutateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: expect.objectContaining({
          input: expect.objectContaining({
            encryptedTranslation: 'encrypted-bonjour',
          }),
        }),
      }),
    );
  });

  it('displays rate limit error message when backend responds with 429', async () => {
    const responses = [
      {
        ok: false,
        status: 429,
        json: async () => ({ error: 'Too many requests' }),
      },
      {
        ok: true,
        status: 200,
        json: async () => ({ translation: 'Hello', cached: false }),
      },
    ];
    fetchMock.mockImplementation(() => {
      const next = responses.shift();
      if (!next) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ translation: 'Hello', cached: false }),
        });
      }
      return Promise.resolve(next as any);
    });

    window.localStorage.setItem('accessToken', 'token');

    render(
      <TranslationDisplay
        messageId="msg-3"
        originalText="hola"
        familyKey={null}
        preferredLanguage="en"
      />,
    );

    // In test env, isVisible and hasIntersected start as true, so retries will trigger automatically

    // Should eventually render the successful translation after retry
    expect(await screen.findByText('Hello')).toBeVisible();

    // Verify we saw the 429 and a retry happened
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
