'use client';

import { useApolloClient } from '@apollo/client/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CacheMessageTranslationRecordDocument,
  CacheMessageTranslationRecordMutation,
  CacheMessageTranslationRecordMutationVariables,
  MessageTranslationLookupDocument,
  MessageTranslationLookupQuery,
  MessageTranslationLookupQueryVariables,
} from '@/lib/graphql/generated/graphql';
import { decryptMessage, encryptMessage } from '@/lib/e2ee/encryption';
import type { TranslationLanguage } from '@/components/settings/translation-language-selector';
import {
  DEFAULT_TRANSLATION_LANGUAGE,
  isSupportedTranslationLanguage,
} from '@/lib/translation/languages';

interface TranslationDisplayProps {
  messageId: string;
  originalText: string;
  familyKey: CryptoKey | null;
  preferredLanguage?: TranslationLanguage | null;
  enabled?: boolean;
}

type TranslationPhase = 'idle' | 'loading' | 'ready' | 'error';

const RATE_LIMIT_MESSAGE =
  'Translation temporarily unavailable. Please wait a moment and try again.';
const AUTH_REQUIRED_MESSAGE =
  'Translation requires an active session. Please sign in again.';
const KEY_MISSING_MESSAGE =
  'Translation cache is encrypted. Re-sync your family key to view translations.';

function deriveBackendBaseUrl(): string | null {
  const httpUrl = process.env.NEXT_PUBLIC_GRAPHQL_HTTP_URL;
  if (!httpUrl) {
    return null;
  }

  try {
    if (typeof window !== 'undefined') {
      const url = new URL(httpUrl, window.location.origin);
      // Remove trailing /graphql if present
      url.pathname = url.pathname.replace(/\/graphql\/?$/, '');

      const normalized = url.toString();
      return normalized.endsWith('/')
        ? normalized.slice(0, -1)
        : normalized;
    }

    // Fallback for environments without window
    return httpUrl.replace(/\/graphql\/?$/, '');
  } catch {
    return null;
  }
}

function textsMatch(a: string, b: string) {
  return a.trim() === b.trim();
}

function getAccessToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage.getItem('accessToken');
  } catch (error) {
    console.warn('[TranslationDisplay] Failed to read access token from storage', error);
    return null;
  }
}

export function TranslationDisplay({
  messageId,
  originalText,
  familyKey,
  preferredLanguage,
  enabled = true,
}: TranslationDisplayProps) {
  const client = useApolloClient();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasRequestedRef = useRef(false);
  const isMountedRef = useRef(true);

  const [phase, setPhase] = useState<TranslationPhase>('idle');
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  const targetLanguage = useMemo<TranslationLanguage>(() => {
    if (preferredLanguage && isSupportedTranslationLanguage(preferredLanguage)) {
      return preferredLanguage;
    }
    return DEFAULT_TRANSLATION_LANGUAGE;
  }, [preferredLanguage]);

  const backendBaseUrl = useMemo(() => deriveBackendBaseUrl(), []);

  const requestSignature = useMemo(
    () =>
      `${messageId}:${targetLanguage}:${originalText}:${
        familyKey ? 'with-key' : 'no-key'
      }`,
    [messageId, targetLanguage, originalText, familyKey],
  );

  useEffect(
    () => () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    const node = containerRef.current;
    if (!node) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          setIsVisible(true);
        }
      },
      {
        // Start fetching slightly before the element is visible
        rootMargin: '128px 0px 128px 0px',
        threshold: 0,
      },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    // Reset state when content or target language changes
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    hasRequestedRef.current = false;
    setTranslatedText(null);
    setError(null);
    setPhase('idle');
  }, [requestSignature]);

  useEffect(() => {
    if (!enabled || !isVisible) {
      return;
    }

    if (hasRequestedRef.current) {
      return;
    }

    if (!originalText.trim()) {
      return;
    }

    // Prevent duplicate executions
    hasRequestedRef.current = true;

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const execute = async () => {
      setPhase('loading');
      setError(null);

      try {
        // 1. Check for cached translation via GraphQL (only if we can decrypt)
        if (familyKey) {
          try {
            const { data } = await client.query<
              MessageTranslationLookupQuery,
              MessageTranslationLookupQueryVariables
            >({
              query: MessageTranslationLookupDocument,
              variables: {
                messageId,
                targetLanguage,
              },
              fetchPolicy: 'network-only',
            });

            if (controller.signal.aborted || !isMountedRef.current) {
              return;
            }

            const encrypted = data?.messageTranslation?.encryptedTranslation;

            if (encrypted) {
              const decrypted = await decryptMessage(encrypted, familyKey);

              if (controller.signal.aborted || !isMountedRef.current) {
                return;
              }

              if (!textsMatch(decrypted, originalText)) {
                setTranslatedText(decrypted);
                setPhase('ready');
              } else {
                setTranslatedText(null);
                setPhase('ready');
              }
              return;
            }
          } catch (cacheError) {
            // Cache miss or auth errors shouldn't block translation
            console.warn('[TranslationDisplay] Cache lookup failed:', cacheError);
          }
        }

        if (!backendBaseUrl) {
          setError('Translation service is not configured.');
          setPhase('error');
          return;
        }

        const token = getAccessToken();

        if (!token) {
          setError(AUTH_REQUIRED_MESSAGE);
          setPhase('error');
          return;
        }

        const response = await fetch(`${backendBaseUrl}/api/translate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
          body: JSON.stringify({
            messageId,
            text: originalText,
            targetLanguage,
          }),
        });

        if (controller.signal.aborted || !isMountedRef.current) {
          return;
        }

        if (response.status === 429) {
          setError(RATE_LIMIT_MESSAGE);
          setPhase('error');
          return;
        }

        if (!response.ok) {
          let details = '';
          try {
            details = await response.text();
          } catch {
            // ignore
          }
          console.error(
            '[TranslationDisplay] Translation request failed:',
            response.status,
            details,
          );
          setError('Translation failed. Please try again later.');
          setPhase('error');
          return;
        }

        const payload: {
          cached: boolean;
          translation?: string;
          encryptedTranslation?: string;
        } = await response.json();

        if (controller.signal.aborted || !isMountedRef.current) {
          return;
        }

        if (payload.cached) {
          if (!payload.encryptedTranslation) {
            setError('Cached translation unavailable.');
            setPhase('error');
            return;
          }

          if (!familyKey) {
            setError(KEY_MISSING_MESSAGE);
            setPhase('error');
            return;
          }

          try {
            const decrypted = await decryptMessage(
              payload.encryptedTranslation,
              familyKey,
            );

            if (controller.signal.aborted || !isMountedRef.current) {
              return;
            }

            if (!textsMatch(decrypted, originalText)) {
              setTranslatedText(decrypted);
            } else {
              setTranslatedText(null);
            }
            setPhase('ready');
          } catch (decryptError) {
            console.error(
              '[TranslationDisplay] Failed to decrypt cached translation:',
              decryptError,
            );
            setError(KEY_MISSING_MESSAGE);
            setPhase('error');
          }

          return;
        }

        const translationText = payload.translation?.trim() ?? '';

        if (!translationText || textsMatch(translationText, originalText)) {
          setTranslatedText(null);
          setPhase('ready');
          return;
        }

        setTranslatedText(translationText);
        setPhase('ready');

        if (familyKey) {
          try {
            const encrypted = await encryptMessage(
              translationText,
              familyKey,
            );

            await client.mutate<
              CacheMessageTranslationRecordMutation,
              CacheMessageTranslationRecordMutationVariables
            >({
              mutation: CacheMessageTranslationRecordDocument,
              variables: {
                input: {
                  messageId,
                  targetLanguage,
                  encryptedTranslation: encrypted,
                },
              },
            });
          } catch (cacheError) {
            console.warn(
              '[TranslationDisplay] Failed to cache translation:',
              cacheError,
            );
            // Non-fatal – translation already displayed to user
          }
        }
      } catch (requestError) {
        if ((requestError as Error).name === 'AbortError') {
          return;
        }
        console.error('[TranslationDisplay] Translation error:', requestError);
        setError('Translation unavailable right now.');
        setPhase('error');
      }
    };

    debounceTimerRef.current = setTimeout(execute, 220);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      controller.abort();
    };
  }, [
    client,
    enabled,
    familyKey,
    backendBaseUrl,
    isVisible,
    messageId,
    originalText,
    targetLanguage,
  ]);

  if (!enabled) {
    return <div ref={containerRef} />;
  }

  if (phase === 'idle') {
    return <div ref={containerRef} />;
  }

  if (phase === 'loading') {
    return (
      <div
        ref={containerRef}
        className="mt-1 rounded-md bg-muted/40 px-3 py-2 text-xs italic text-muted-foreground"
      >
        Translating...
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div
        ref={containerRef}
        className="mt-1 rounded-md bg-destructive/10 px-3 py-2 text-xs italic text-destructive"
      >
        {error}
      </div>
    );
  }

  if (!translatedText) {
    return <div ref={containerRef} />;
  }

  return (
    <div
      ref={containerRef}
      className="mt-1 rounded-md bg-muted/50 px-3 py-2 text-sm italic text-muted-foreground"
    >
      {translatedText}
    </div>
  );
}
