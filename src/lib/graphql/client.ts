/**
 * Apollo GraphQL Client Configuration
 *
 * Configures Apollo Client with:
 * - HTTP link for queries/mutations
 * - WebSocket link for subscriptions
 * - Split link to route operations correctly
 * - JWT authentication via headers
 */

'use client';

import { ApolloClient, InMemoryCache, HttpLink, split, from } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { createClient } from 'graphql-ws';

// Validate required environment variables at build/runtime
if (!process.env.NEXT_PUBLIC_GRAPHQL_HTTP_URL) {
  throw new Error('NEXT_PUBLIC_GRAPHQL_HTTP_URL is required but not set');
}
if (!process.env.NEXT_PUBLIC_GRAPHQL_WS_URL) {
  throw new Error('NEXT_PUBLIC_GRAPHQL_WS_URL is required but not set');
}

const GRAPHQL_HTTP_URL = process.env.NEXT_PUBLIC_GRAPHQL_HTTP_URL;
const GRAPHQL_WS_URL = process.env.NEXT_PUBLIC_GRAPHQL_WS_URL;

/**
 * Resolves the WebSocket endpoint so it works in both HTTP and HTTPS deployments.
 * - Supports absolute ws:// / wss:// URLs
 * - Upgrades ws:// → wss:// when the app runs over HTTPS to avoid mixed-content blocking
 * - Never downgrades wss:// → ws:// (browsers allow HTTP pages to connect to secure WebSockets)
 * - Handles relative paths (e.g. `/graphql`) by inferring the host from the current location
 */
function resolveWsUrl(rawUrl: string): string {
  if (typeof window === 'undefined') {
    return rawUrl;
  }

  if (!rawUrl) {
    return rawUrl;
  }

  // Allow using a relative path like `/graphql`
  if (rawUrl.startsWith('/')) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}${rawUrl}`;
  }

  // Only upgrade ws:// → wss:// when page is HTTPS (to avoid mixed-content blocking)
  // Never downgrade wss:// → ws:// (browsers allow HTTP → WSS connections)
  const isHttpsPage = window.location.protocol === 'https:';

  if (isHttpsPage && rawUrl.startsWith('ws://')) {
    return `wss://${rawUrl.slice('ws://'.length)}`;
  }

  return rawUrl;
}

// HTTP Link for queries and mutations
const httpLink = new HttpLink({
  uri: GRAPHQL_HTTP_URL,
  credentials: 'same-origin',
});

// Auth link - adds headers to all requests
const authLink = setContext((_, { headers }) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  return {
    headers: {
      ...headers,
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    }
  };
});

// Combine auth link with HTTP link
const httpLinkWithAuth = from([authLink, httpLink]);

// WebSocket Link for subscriptions
const wsLink = typeof window !== 'undefined' ? new GraphQLWsLink(
  createClient({
    url: resolveWsUrl(GRAPHQL_WS_URL),
    keepAlive: 10_000, // Send keepalive ping every 10 seconds
    connectionParams: () => {
      const token = localStorage.getItem('accessToken');
      console.log('[WebSocket] Getting connection params, token exists:', !!token);
      return {
        authorization: token ? `Bearer ${token}` : '',
      };
    },
    on: {
      connected: () => {
        console.log('[WebSocket] ✅ Connected to GraphQL server');
      },
      connecting: () => {
        console.log('[WebSocket] 🔄 Connecting to GraphQL server at:', resolveWsUrl(GRAPHQL_WS_URL));
      },
      closed: (event) => {
        console.log('[WebSocket] ❌ Connection closed:', event);
      },
      error: (error) => {
        console.error('[WebSocket] ❌ Connection error:', error);
      },
      ping: () => {
        console.log('[WebSocket] 🏓 Ping sent');
      },
      pong: () => {
        console.log('[WebSocket] 🏓 Pong received');
      },
    },
    retryAttempts: 5,
    shouldRetry: () => {
      console.log('[WebSocket] 🔄 Retrying connection...');
      return true;
    },
  })
) : null;

// Split link - route to WebSocket for subscriptions, HTTP for everything else
const splitLink = typeof window !== 'undefined' && wsLink
  ? split(
      ({ query }) => {
        const definition = getMainDefinition(query);
        const isSubscription = (
          definition.kind === 'OperationDefinition' &&
          definition.operation === 'subscription'
        );
        if (isSubscription) {
          console.log('[Apollo] 📡 Routing subscription operation to WebSocket:', definition.name?.value);
        }
        return isSubscription;
      },
      wsLink,
      httpLinkWithAuth
    )
  : httpLinkWithAuth;

// Create Apollo Client instance
export const apolloClient = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          getMessages: {
            // Merge incoming messages with existing cache
            keyArgs: ['input', ['channelId']],
            merge(existing = [], incoming) {
              return [...incoming];
            },
          },
        },
      },
    },
  }),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-first',
    },
  },
});

/**
 * Set or clear authentication token
 */
export function setAuthToken(token: string | null) {
  if (typeof window === 'undefined') return;

  if (token) {
    localStorage.setItem('accessToken', token);
  } else {
    // Clear both access and refresh tokens on logout (AC5)
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }
}
