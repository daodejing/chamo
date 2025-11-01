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
    url: GRAPHQL_WS_URL,
    connectionParams: () => {
      const token = localStorage.getItem('accessToken');
      return {
        authorization: token ? `Bearer ${token}` : '',
      };
    },
  })
) : null;

// Split link - route to WebSocket for subscriptions, HTTP for everything else
const splitLink = typeof window !== 'undefined' && wsLink
  ? split(
      ({ query }) => {
        const definition = getMainDefinition(query);
        return (
          definition.kind === 'OperationDefinition' &&
          definition.operation === 'subscription'
        );
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
