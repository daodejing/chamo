import { describe, it, expect, beforeAll } from 'vitest';
import {
  createMessagingFixture,
  sendMessage,
  waitForNextMessage,
  fetchMessages,
} from './backend-test-client';

// Skip this test in CI unit test job - requires running backend
const isBackendAvailable = async (): Promise<boolean> => {
  try {
    const response = await fetch('http://localhost:4000/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ __typename }' }),
    });
    return response.ok;
  } catch {
    return false;
  }
};

describe('GraphQL real-time messaging', () => {
  let backendAvailable = false;

  beforeAll(async () => {
    backendAvailable = await isBackendAvailable();
  });

  it(
    'delivers messages to subscribed family members via WebSocket subscriptions',
    async () => {
      if (!backendAvailable) {
        console.log('Skipping test: backend not available at localhost:4000');
        return;
      }
      const fixture = await createMessagingFixture();
      const testMessage = `[vitest] message ${Date.now()}`;

      const subscription = waitForNextMessage(
        fixture.member.accessToken,
        fixture.channel.id,
      );

      const sent = await sendMessage(
        fixture.admin.accessToken,
        fixture.channel.id,
        testMessage,
      );

      const received = await subscription;

      expect(received.id).toBe(sent.id);
      expect(received.encryptedContent).toBe(testMessage);
      expect(received.user.id).toBe(fixture.admin.user.id);
      expect(received.channelId).toBe(fixture.channel.id);

      const history = await fetchMessages(
        fixture.member.accessToken,
        fixture.channel.id,
      );
      const ids = history.map((message) => message.id);
      expect(ids).toContain(sent.id);
    },
    20000,
  );
});
