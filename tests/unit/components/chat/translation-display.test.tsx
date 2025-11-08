process.env.NEXT_PUBLIC_GRAPHQL_HTTP_URL = 'http://localhost:4000/graphql';
process.env.NEXT_PUBLIC_GRAPHQL_WS_URL = 'ws://localhost:4000/graphql';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import type { MessageTranslationLookupQuery } from '@/lib/graphql/generated/graphql';
import { TranslationDisplay } from '@/components/chat/translation-display';

const { queryMock, mutateMock, decryptMessageMock, encryptMessageMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  mutateMock: vi.fn(),
  decryptMessageMock: vi.fn<[], Promise<string>>(),
  encryptMessageMock: vi.fn<[string, CryptoKey], Promise<string>>(),
}));

vi.mock('@apollo/client/react', async () => {
  const actual = await vi.importActual<typeof import('@apollo/client/react')>('@apollo/client/react');
  return {
    ...actual,
    useApolloClient: () => ({
      query: queryMock,
      mutate: mutateMock,
    }),
  };
});

vi.mock('@/lib/e2ee/encryption', () => ({
  decryptMessage: decryptMessageMock,
  encryptMessage: encryptMessageMock,
}));

const fetchMock = vi.fn();
const originalFetch = global.fetch;

const observers: Array<(entries: IntersectionObserverEntry[]) => void> = [];

class MockIntersectionObserver {
  private readonly callback: (entries: IntersectionObserverEntry[]) => void;

  constructor(callback: (entries: IntersectionObserverEntry[]) => void) {
    this.callback = callback;
    observers.push(callback);
  }

  observe() {
    // no-op, intersections controlled manually
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

const triggerIntersection = () => {
  const entry = { isIntersecting: true } as IntersectionObserverEntry;
  observers.splice(0).forEach((cb) => cb([entry]));
};

describe('TranslationDisplay', () => {
  beforeEach(() => {
    queryMock.mockReset();
    mutateMock.mockReset();
    decryptMessageMock.mockReset();
    encryptMessageMock.mockReset();
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    window.localStorage.clear();
  });

  afterEach(() => {
    observers.length = 0;
    global.fetch = originalFetch;
  });

  it('renders decrypted cached translation from GraphQL cache', async () => {
    queryMock.mockResolvedValue({
      data: {
        messageTranslation: {
          encryptedTranslation: 'cipher',
        },
      } satisfies Partial<MessageTranslationLookupQuery>,
    });
    decryptMessageMock.mockResolvedValue('こんにちは');

    render(
      <TranslationDisplay
        messageId="msg-1"
        originalText="hello"
        familyKey={{} as CryptoKey}
        preferredLanguage="ja"
      />,
    );

    await act(async () => {
      triggerIntersection();
    });

    expect(await screen.findByText('こんにちは')).toBeVisible();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(decryptMessageMock).toHaveBeenCalledWith('cipher', expect.any(Object));
  });

  it('requests translation from backend and caches encrypted value', async () => {
    queryMock.mockResolvedValue({ data: { messageTranslation: null } });
    fetchMock.mockResolvedValue({
      ok: true,
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

    await act(async () => {
      triggerIntersection();
    });

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
    queryMock.mockResolvedValue({ data: { messageTranslation: null } });
    fetchMock.mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: 'Too many requests' }),
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

    await act(async () => {
      triggerIntersection();
    });

    expect(
      await screen.findByText('Translation temporarily unavailable. Please wait a moment and try again.'),
    ).toBeVisible();
  });
});
