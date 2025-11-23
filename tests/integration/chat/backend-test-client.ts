import { createClient } from 'graphql-ws';
import WS from 'ws';

type GraphQLFetchResult<T> = {
  data?: T;
  errors?: { message: string }[];
};

type AuthSession = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    activeFamilyId?: string | null;
  };
};

export type MessagingFixture = {
  admin: AuthSession;
  member: AuthSession;
  family: {
    id: string;
    name: string;
    inviteCode: string;
  };
  channel: {
    id: string;
    name: string;
    familyId: string;
  };
  inviteCode: string;
};

export type MessageWithUser = {
  id: string;
  channelId: string;
  encryptedContent: string;
  user: {
    id: string;
    name: string;
    avatar?: string | null;
  };
};

const GRAPHQL_HTTP_URL =
  process.env.TEST_GRAPHQL_HTTP_URL ||
  process.env.NEXT_PUBLIC_GRAPHQL_HTTP_URL ||
  'http://localhost:4000/graphql';
const GRAPHQL_WS_URL =
  process.env.TEST_GRAPHQL_WS_URL ||
  process.env.NEXT_PUBLIC_GRAPHQL_WS_URL ||
  'ws://localhost:4000/graphql';

const CREATE_FIXTURE_MUTATION = /* GraphQL */ `
  mutation TestCreateMessagingFixture($input: TestCreateMessagingFixtureInput!) {
    testCreateMessagingFixture(input: $input) {
      inviteCode
      family {
        id
        name
        inviteCode
      }
      channel {
        id
        name
        familyId
      }
      admin {
        accessToken
        refreshToken
        user {
          id
          email
          name
          activeFamilyId
        }
      }
      member {
        accessToken
        refreshToken
        user {
          id
          email
          name
          activeFamilyId
        }
      }
    }
  }
`;

const SEND_MESSAGE_MUTATION = /* GraphQL */ `
  mutation SendMessage($input: SendMessageInput!) {
    sendMessage(input: $input) {
      id
      channelId
      encryptedContent
      user {
        id
        name
      }
    }
  }
`;

const GET_MESSAGES_QUERY = /* GraphQL */ `
  query GetMessages($input: GetMessagesInput!) {
    getMessages(input: $input) {
      id
      channelId
      encryptedContent
      user {
        id
        name
      }
    }
  }
`;

const MESSAGE_ADDED_SUBSCRIPTION = /* GraphQL */ `
  subscription MessageAdded($channelId: String!) {
    messageAdded(channelId: $channelId) {
      id
      channelId
      encryptedContent
      user {
        id
        name
      }
    }
  }
`;

async function graphqlRequest<T>(
  query: string,
  variables?: Record<string, unknown>,
  token?: string,
): Promise<T> {
  const response = await fetch(GRAPHQL_HTTP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `GraphQL request failed (${response.status}): ${text.slice(0, 120)}`,
    );
  }

  const payload = (await response.json()) as GraphQLFetchResult<T>;
  if (payload.errors?.length) {
    throw new Error(payload.errors.map((err) => err.message).join('\n'));
  }

  if (!payload.data) {
    throw new Error('GraphQL response did not include data');
  }

  return payload.data;
}

export async function createMessagingFixture(
  seed = `vitest-${Date.now()}`,
): Promise<MessagingFixture> {
  const input = {
    familyName: `Vitest Family ${seed}`,
    admin: {
      email: `${seed}-admin@example.com`,
      password: 'AdminPassword123!',
      name: `Admin ${seed}`,
    },
    member: {
      email: `${seed}-member@example.com`,
      password: 'MemberPassword123!',
      name: `Member ${seed}`,
    },
  };

  const { testCreateMessagingFixture } = await graphqlRequest<{
    testCreateMessagingFixture: MessagingFixture;
  }>(CREATE_FIXTURE_MUTATION, { input });

  return testCreateMessagingFixture;
}

export async function sendMessage(
  token: string,
  channelId: string,
  encryptedContent: string,
): Promise<MessageWithUser> {
  const { sendMessage } = await graphqlRequest<{
    sendMessage: MessageWithUser;
  }>(
    SEND_MESSAGE_MUTATION,
    {
      input: {
        channelId,
        encryptedContent,
      },
    },
    token,
  );

  return sendMessage;
}

export async function fetchMessages(
  token: string,
  channelId: string,
): Promise<MessageWithUser[]> {
  const { getMessages } = await graphqlRequest<{
    getMessages: MessageWithUser[];
  }>(
    GET_MESSAGES_QUERY,
    {
      input: {
        channelId,
        limit: 20,
      },
    },
    token,
  );

  return getMessages;
}

const resolveWebSocketImpl = (): typeof WebSocket | undefined => {
  if (typeof globalThis.WebSocket !== 'undefined') {
    return globalThis.WebSocket;
  }
  if (typeof WS !== 'undefined') {
    return WS as unknown as typeof WebSocket;
  }
  return undefined;
};

export function waitForNextMessage(
  token: string,
  channelId: string,
  timeoutMs = 10_000,
): Promise<MessageWithUser> {
  const webSocketImpl = resolveWebSocketImpl();

  if (!webSocketImpl) {
    throw new Error('WebSocket implementation is not available in this environment.');
  }

  return new Promise((resolve, reject) => {
    let dispose: (() => void) | undefined;
    const client = createClient({
      url: GRAPHQL_WS_URL,
      webSocketImpl,
      connectionParams: {
        authorization: `Bearer ${token}`,
      },
    });

    const timeout = setTimeout(() => {
      dispose?.();
      client.dispose();
      reject(
        new Error(
          `Timed out after ${timeoutMs}ms waiting for subscription payload`,
        ),
      );
    }, timeoutMs);

    dispose = client.subscribe(
      {
        query: MESSAGE_ADDED_SUBSCRIPTION,
        variables: { channelId },
      },
      {
        next: (payload) => {
          clearTimeout(timeout);
          dispose?.();
          client.dispose();
          const message = payload.data?.messageAdded;
          if (!message) {
            reject(new Error('Subscription payload was empty'));
            return;
          }
          resolve(message);
        },
        error: (err) => {
          clearTimeout(timeout);
          dispose?.();
          client.dispose();
          reject(
            err instanceof Error
              ? err
              : new Error(
                  typeof err === 'string'
                    ? err
                    : JSON.stringify(err, null, 2),
                ),
          );
        },
        complete: () => {
          clearTimeout(timeout);
          dispose?.();
          client.dispose();
        },
      },
    );
  });
}
