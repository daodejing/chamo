/**
 * Integration Test: Multi-User Messaging API
 * Tests that messages sent by one user can be fetched and read by another user in the same family
 *
 * PREREQUISITES:
 * 1. Start Supabase: `pnpm supabase:start`
 * 2. Start Next.js dev server: `pnpm dev` (in another terminal)
 * 3. Run test: `NEXT_PUBLIC_API_URL=http://localhost:3002 pnpm test src/tests/integration/chat/multi-user-messaging.test.ts`
 *
 * This test uses SuperTest (2025 industry standard) with cookie agents to properly handle
 * cookie-based authentication, matching the production architecture where sessions are
 * stored in HTTP-only cookies.
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import request from 'supertest';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

describe('Multi-User Messaging API (Story 2.1 AC3)', () => {
  // SuperTest agents maintain cookies across requests automatically
  let user1Agent: request.SuperAgentTest;
  let user2Agent: request.SuperAgentTest;
  let familyId: string;
  let channelId: string;
  let user1Id: string;
  let user2Id: string;

  beforeAll(async () => {
    // Create cookie-aware agents for each user
    user1Agent = request.agent(API_BASE_URL);
    user2Agent = request.agent(API_BASE_URL);

    // Create User 1 (family creator)
    const timestamp = Date.now();
    const user1Response = await user1Agent
      .post('/api/auth/register')
      .send({
        email: `test-user1-${timestamp}@example.com`,
        password: 'TestPassword123!',
        userName: 'Test User 1',
        familyName: `Test Family ${timestamp}`,
      })
      .expect(201);

    const user1Data = user1Response.body;
    user1Id = user1Data.user.id;
    familyId = user1Data.user.familyId;
    const inviteCode = user1Data.family.inviteCode;

    // Get the default "General" channel ID for this family via API
    // Retry logic: The channel is created by a trigger, which may take a moment
    let channelsResponse;
    let channelsData: any = null;

    for (let attempt = 0; attempt < 5; attempt++) {
      channelsResponse = await user1Agent.get('/api/channels');

      if (channelsResponse.status === 200) {
        channelsData = channelsResponse.body;
        if (channelsData.channels && channelsData.channels.length > 0) {
          break; // Channels found!
        }
      }

      // Wait a bit before retrying
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    expect(channelsResponse!.status).toBe(200);
    expect(channelsData.channels).toBeDefined();
    expect(channelsData.channels.length).toBeGreaterThan(0);

    // Find the "General" channel
    const generalChannel = channelsData.channels.find((c: any) => c.name === 'General');
    expect(generalChannel).toBeTruthy();
    channelId = generalChannel.id;

    // Create User 2 (joins family)
    const user2Response = await user2Agent
      .post('/api/auth/join')
      .send({
        email: `test-user2-${timestamp}@example.com`,
        password: 'TestPassword123!',
        userName: 'Test User 2',
        inviteCode,
      })
      .expect(201);

    const user2Data = user2Response.body;
    user2Id = user2Data.user.id;

    // Verify both users are in the same family
    expect(user2Data.user.familyId).toBe(familyId);
  });

  afterAll(async () => {
    // Cleanup: Delete test users and family
    const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    // Delete messages
    if (channelId) {
      await supabase.from('messages').delete().eq('channel_id', channelId);
    }

    // Delete users
    if (familyId) {
      await supabase.from('users').delete().eq('family_id', familyId);
    }

    if (user1Id) {
      await supabase.auth.admin.deleteUser(user1Id);
    }
    if (user2Id) {
      await supabase.auth.admin.deleteUser(user2Id);
    }

    // Delete family (channels will cascade delete)
    if (familyId) {
      await supabase.from('families').delete().eq('id', familyId);
    }
  });

  it('should allow User 2 to fetch messages sent by User 1', async () => {
    const testMessage = `Multi-user test message ${Date.now()}`;

    // User 1 sends a message
    const sendResponse = await user1Agent
      .post('/api/messages')
      .send({
        channelId,
        encryptedContent: Buffer.from(testMessage).toString('base64'), // Simulated encryption
      })
      .expect(201);

    const sentMessage = sendResponse.body;
    expect(sentMessage.message).toBeTruthy();
    expect(sentMessage.message.channelId).toBe(channelId);

    // User 2 fetches messages from the channel
    const fetchResponse = await user2Agent
      .get(`/api/messages?channelId=${channelId}`)
      .expect(200);
    const fetchData = fetchResponse.body;

    expect(fetchData.messages).toBeDefined();
    expect(Array.isArray(fetchData.messages)).toBe(true);
    expect(fetchData.messages.length).toBeGreaterThan(0);

    // Verify User 2 can see User 1's message
    const user1Message = fetchData.messages.find(
      (msg: any) => msg.id === sentMessage.message.id
    );

    expect(user1Message).toBeTruthy();
    expect(user1Message.userId).toBe(user1Id);
    expect(user1Message.encryptedContent).toBe(
      Buffer.from(testMessage).toString('base64')
    );
  });

  it('should deliver message within acceptable time (< 2 seconds)', async () => {
    const testMessage = `Timing test ${Date.now()}`;

    const startTime = Date.now();

    // User 1 sends message
    const sendResponse = await user1Agent
      .post('/api/messages')
      .send({
        channelId,
        encryptedContent: Buffer.from(testMessage).toString('base64'),
      })
      .expect(201);

    const sentMessage = sendResponse.body;

    // User 2 fetches messages immediately
    const fetchResponse = await user2Agent
      .get(`/api/messages?channelId=${channelId}`)
      .expect(200);

    const endTime = Date.now();
    const deliveryTime = endTime - startTime;

    const fetchData = fetchResponse.body;

    // Verify message is available
    const message = fetchData.messages.find(
      (msg: any) => msg.id === sentMessage.message.id
    );
    expect(message).toBeTruthy();

    // Verify delivery time is reasonable (< 2 seconds for API calls)
    expect(deliveryTime).toBeLessThan(2000);
    console.log(`Message delivery time: ${deliveryTime}ms`);
  });

  it('should only show messages from the correct channel', async () => {
    // User 1 sends a message
    const channelMessage = `Channel message ${Date.now()}`;
    await user1Agent
      .post('/api/messages')
      .send({
        channelId,
        encryptedContent: Buffer.from(channelMessage).toString('base64'),
      })
      .expect(201);

    // User 2 fetches messages for this specific channel
    const fetchResponse = await user2Agent
      .get(`/api/messages?channelId=${channelId}`)
      .expect(200);

    const fetchData = fetchResponse.body;

    // All messages should belong to the requested channel
    expect(fetchData.messages).toBeDefined();
    fetchData.messages.forEach((msg: any) => {
      expect(msg.channelId).toBe(channelId);
    });
  });

  it('should include sender information in messages', async () => {
    const testMessage = `Sender info test ${Date.now()}`;

    // User 1 sends message
    const sendResponse = await user1Agent
      .post('/api/messages')
      .send({
        channelId,
        encryptedContent: Buffer.from(testMessage).toString('base64'),
      })
      .expect(201);

    const sentMessage = sendResponse.body;

    // User 2 fetches messages
    const fetchResponse = await user2Agent
      .get(`/api/messages?channelId=${channelId}`)
      .expect(200);

    const fetchData = fetchResponse.body;
    const message = fetchData.messages.find(
      (msg: any) => msg.id === sentMessage.message.id
    );

    // Verify message includes sender information
    expect(message.userId).toBe(user1Id);
    expect(message.timestamp).toBeTruthy();
  });
});
