import { describe, it, expect } from 'vitest';
import {
  createMessagingFixture,
  sendMessage,
  waitForNextMessage,
  fetchMessages,
} from './backend-test-client';

describe('GraphQL real-time messaging', () => {
  it(
    'delivers messages to subscribed family members via WebSocket subscriptions',
    async () => {
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
