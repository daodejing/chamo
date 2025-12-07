'use client';

import { useApolloClient } from '@apollo/client/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CacheMessageTranslationRecordDocument,
  CacheMessageTranslationRecordMutation,
  CacheMessageTranslationRecordMutationVariables,
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

import { DEBUG_LOGS_ENABLED } from '@/lib/debug';

const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 500;

const debugLog = (...args: unknown[]) => {
  if (DEBUG_LOGS_ENABLED) {
    console.debug('[TranslationDisplay]', ...args);
  }
};

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

const isTestEnv = process.env.NODE_ENV === 'test';
const BATCH_WINDOW_MS = isTestEnv ? 0 : 300;
const pendingMessageTimers = new Map<string, NodeJS.Timeout>();

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
  const [isVisible, setIsVisible] = useState(isTestEnv);
  const [hasIntersected, setHasIntersected] = useState(isTestEnv);
  const [retryCount, setRetryCount] = useState(0);

  const targetLanguage = useMemo<TranslationLanguage>(() => {
    if (preferredLanguage && isSupportedTranslationLanguage(preferredLanguage)) {
      return preferredLanguage;
    }
    return DEFAULT_TRANSLATION_LANGUAGE;
  }, [preferredLanguage]);

  const hasFamilyKey = Boolean(familyKey);

  const backendBaseUrl = useMemo(() => deriveBackendBaseUrl(), []);

  const requestSignature = useMemo(
    () =>
      `${messageId}:${targetLanguage}:${originalText}:${
        hasFamilyKey ? 'with-key' : 'no-key'
      }`,
    [messageId, targetLanguage, originalText, hasFamilyKey],
  );

useEffect(
  () => {
    // Mark mounted for this lifecycle; StrictMode will run cleanup + re-run
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
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
          setHasIntersected(true);
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
    setRetryCount(0);
  }, [requestSignature]);

  useEffect(() => {
    if (!enabled || !isVisible || hasRequestedRef.current) {
      return;
    }

    if (!originalText.trim()) {
      return;
    }

    // Prevent duplicate executions
    hasRequestedRef.current = true;

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const cancelPendingTimer = () => {
      const pending = pendingMessageTimers.get(messageId);
      if (pending) {
        clearTimeout(pending);
        pendingMessageTimers.delete(messageId);
        debounceTimerRef.current = null;
      }
    };

    const executeImmediately = () => {
      execute().catch((err) => {
        console.error('[TranslationDisplay] Translation error:', err);
        setError('Translation unavailable right now.');
        setPhase('error');
      });
    };

    const scheduleExecution = (delayOverride?: number) => {
      cancelPendingTimer();

      const delay = delayOverride ?? BATCH_WINDOW_MS;

      if (delay === 0) {
        executeImmediately();
        return;
      }

      const timer = setTimeout(executeImmediately, delay);
      pendingMessageTimers.set(messageId, timer);
      debounceTimerRef.current = timer;
    };

    const execute = async () => {
      cancelPendingTimer();
      setPhase('loading');
      setError(null);
      debugLog('request started', {
        messageId,
        targetLanguage,
        hasFamilyKey: Boolean(familyKey),
        preferredLanguage,
      });

      try {
        if (!hasIntersected) {
          debugLog('skipping request until intersection occurs');
          hasRequestedRef.current = false;
          return;
        }

        // Backend checks cache internally via REST API
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

        debugLog('invoking REST translation fetch');

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
        debugLog('REST response received', {
          status: response.status,
          ok: response.ok,
        });

        // Check for rate limit FIRST, before checking if unmounted
        // This allows us to show the error even if component is unmounting
        if (response.status === 429) {
          debugLog('rate limit 429 received', { retryCount });

          if (retryCount < MAX_RETRIES) {
            const backoff = RETRY_BASE_DELAY_MS * Math.pow(2, retryCount);
            debugLog('scheduling retry after backoff', { backoff });
            setRetryCount((c) => c + 1);
            hasRequestedRef.current = false;
            scheduleExecution(backoff);
            return;
          }

          if (isMountedRef.current) {
            setError(RATE_LIMIT_MESSAGE);
            setPhase('error');
          }
          return;
        }

        if (controller.signal.aborted || !isMountedRef.current) {
          debugLog('⚠️ Request aborted or component unmounted', {
            aborted: controller.signal.aborted,
            mounted: isMountedRef.current,
          });
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

        let payload: {
          cached: boolean;
          translation?: string;
          encryptedTranslation?: string;
        };

        try {
          debugLog('parsing JSON response');
          payload = await response.json();
          debugLog('REST payload', payload);
        } catch (parseError) {
          console.error('[TranslationDisplay] Failed to parse response JSON:', parseError);
          const text = await response.text().catch(() => '[could not read response text]');
          console.error('[TranslationDisplay] Response text:', text);
          setError('Translation response was invalid.');
          setPhase('error');
          return;
        }

        if (controller.signal.aborted || !isMountedRef.current) {
          return;
        }

        if (payload.cached) {
          if (!payload.encryptedTranslation) {
            debugLog('cached response missing encryptedTranslation payload');
            setError('Cached translation unavailable.');
            setPhase('error');
            return;
          }

          if (!familyKey) {
            debugLog('cached response but no family key available');
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
              debugLog('cached translation decrypted and differs from original');
              setTranslatedText(decrypted);
            } else {
              debugLog('cached translation equals original; suppress output');
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
          debugLog('translation equals original text; nothing to display', {
            translationText,
          });
          setTranslatedText(null);
          setPhase('ready');
          return;
        }

        debugLog('translation received', { translationText });
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

    scheduleExecution();

    return () => {
      // Allow retrigger on remount (e.g., StrictMode double-invoke)
      hasRequestedRef.current = false;
      cancelPendingTimer();
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
