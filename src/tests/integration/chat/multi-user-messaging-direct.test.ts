/**
 * Integration Test: Multi-User Messaging (Direct API Handler Testing)
 * Tests that messages sent by one user can be fetched and read by another user in the same family
 *
 * This test calls the API route handlers directly, bypassing HTTP.
 * Run: `pnpm supabase:test:start` then `pnpm test src/tests/integration/chat/multi-user-messaging-direct.test.ts`
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { POST as registerHandler } from '@/app/api/auth/register/route';
import { POST as joinHandler } from '@/app/api/auth/join/route';
import { POST as sendMessageHandler, GET as getMessagesHandler } from '@/app/api/messages/route';
import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

describe('Multi-User Messaging API (Story 2.1 AC3) - Direct Handler', () => {
  let user1Token: string;
  let user2Token: string;
  let familyId: string;
  let channelId: string;
  let user1Id: string;
  let user2Id: string;

  beforeAll(async () => {
    const timestamp = Date.now();

    // Create User 1 (family creator) by calling the register handler directly
    const registerRequest = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `test-user1-${timestamp}@example.com`,
        password: 'TestPassword123!',
        userName: 'Test User 1',
        familyName: `Test Family ${timestamp}`,
      }),
    });

    const user1Response = await registerHandler(registerRequest);
    expect(user1Response.status).toBe(201);

    const user1Data = await user1Response.json();
    user1Token = user1Data.session.accessToken;
    user1Id = user1Data.user.id;
    familyId = user1Data.user.familyId;
    const inviteCode = user1Data.family.inviteCode;

    // Get the default "General" channel ID for this family
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: channel } = await supabase
      .from('channels')
      .select('id')
      .eq('family_id', familyId)
      .eq('name', 'General')
      .single();

    expect(channel).toBeTruthy();
    channelId = channel!.id;

    // Create User 2 (joins family) by calling the join handler directly
    const joinRequest = new NextRequest('http://localhost:3000/api/auth/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `test-user2-${timestamp}@example.com`,
        password: 'TestPassword123!',
        userName: 'Test User 2',
        inviteCode,
      }),
    });

    const user2Response = await joinHandler(joinRequest);
    expect(user2Response.status).toBe(201);

    const user2Data = await user2Response.json();
    user2Token = user2Data.session.accessToken;
    user2Id = user2Data.user.id;

    // Verify both users are in the same family
    expect(user2Data.user.familyId).toBe(familyId);
  });

  afterAll(async () => {
    // Cleanup: Delete test users and family
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Delete messages
    await supabase.from('messages').delete().eq('channel_id', channelId);

    // Delete users
    await supabase.from('users').delete().eq('family_id', familyId);

    if (user1Id) await supabase.auth.admin.deleteUser(user1Id);
    if (user2Id) await supabase.auth.admin.deleteUser(user2Id);

    // Delete family (channels will cascade delete)
    if (familyId) await supabase.from('families').delete().eq('id', familyId);
  });

  it('should allow User 2 to fetch messages sent by User 1', async () => {
    const testMessage = `Multi-user test message ${Date.now()}`;
    const encryptedContent = Buffer.from(testMessage).toString('base64');

    // User 1 sends a message via the messages API handler
    const sendRequest = new NextRequest('http://localhost:3000/api/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user1Token}`,
      },
      body: JSON.stringify({
        channelId,
        encryptedContent,
      }),
    });

    const sendResponse = await sendMessageHandler(sendRequest);
    expect(sendResponse.status).toBe(201);

    const sentMessage = await sendResponse.json();
    expect(sentMessage.message).toBeTruthy();
    expect(sentMessage.message.channelId).toBe(channelId);

    // User 2 fetches messages via the GET handler
    const fetchRequest = new NextRequest(
      `http://localhost:3000/api/messages?channelId=${channelId}`,
      {
        headers: {
          'Authorization': `Bearer ${user2Token}`,
        },
      }
    );

    const fetchResponse = await getMessagesHandler(fetchRequest);
    expect(fetchResponse.status).toBe(200);

    const fetchData = await fetchResponse.json();

    expect(fetchData.messages).toBeDefined();
    expect(Array.isArray(fetchData.messages)).toBe(true);
    expect(fetchData.messages.length).toBeGreaterThan(0);

    // Verify User 2 can see User 1's message
    const user1Message = fetchData.messages.find(
      (msg: any) => msg.id === sentMessage.message.id
    );

    expect(user1Message).toBeTruthy();
    expect(user1Message.userId).toBe(user1Id);
    expect(user1Message.encryptedContent).toBe(encryptedContent);
  });

  it('should deliver message within acceptable time (< 2 seconds)', async () => {
    const testMessage = `Timing test ${Date.now()}`;
    const encryptedContent = Buffer.from(testMessage).toString('base64');

    const startTime = Date.now();

    // User 1 sends message
    const sendRequest = new NextRequest('http://localhost:3000/api/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user1Token}`,
      },
      body: JSON.stringify({
        channelId,
        encryptedContent,
      }),
    });

    const sendResponse = await sendMessageHandler(sendRequest);
    expect(sendResponse.status).toBe(201);
    const sentMessage = await sendResponse.json();

    // User 2 fetches messages immediately
    const fetchRequest = new NextRequest(
      `http://localhost:3000/api/messages?channelId=${channelId}`,
      {
        headers: {
          'Authorization': `Bearer ${user2Token}`,
        },
      }
    );

    const fetchResponse = await getMessagesHandler(fetchRequest);
    const endTime = Date.now();
    const deliveryTime = endTime - startTime;

    expect(fetchResponse.status).toBe(200);
    const fetchData = await fetchResponse.json();

    // Verify message is available
    const message = fetchData.messages.find(
      (msg: any) => msg.id === sentMessage.message.id
    );
    expect(message).toBeTruthy();

    // Verify delivery time is reasonable (< 2 seconds for direct API calls)
    expect(deliveryTime).toBeLessThan(2000);
    console.log(`Message delivery time: ${deliveryTime}ms`);
  });

  it('should only show messages from the correct channel', async () => {
    const channelMessage = `Channel message ${Date.now()}`;
    const encryptedContent = Buffer.from(channelMessage).toString('base64');

    // User 1 sends a message
    const sendRequest = new NextRequest('http://localhost:3000/api/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user1Token}`,
      },
      body: JSON.stringify({
        channelId,
        encryptedContent,
      }),
    });

    await sendMessageHandler(sendRequest);

    // User 2 fetches messages for this specific channel
    const fetchRequest = new NextRequest(
      `http://localhost:3000/api/messages?channelId=${channelId}`,
      {
        headers: {
          'Authorization': `Bearer ${user2Token}`,
        },
      }
    );

    const fetchResponse = await getMessagesHandler(fetchRequest);
    const fetchData = await fetchResponse.json();

    // All messages should belong to the requested channel
    expect(fetchData.messages).toBeDefined();
    fetchData.messages.forEach((msg: any) => {
      expect(msg.channelId).toBe(channelId);
    });
  });

  it('should include sender information in messages', async () => {
    const testMessage = `Sender info test ${Date.now()}`;
    const encryptedContent = Buffer.from(testMessage).toString('base64');

    // User 1 sends message
    const sendRequest = new NextRequest('http://localhost:3000/api/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user1Token}`,
      },
      body: JSON.stringify({
        channelId,
        encryptedContent,
      }),
    });

    const sendResponse = await sendMessageHandler(sendRequest);
    const sentMessage = await sendResponse.json();

    // User 2 fetches messages
    const fetchRequest = new NextRequest(
      `http://localhost:3000/api/messages?channelId=${channelId}`,
      {
        headers: {
          'Authorization': `Bearer ${user2Token}`,
        },
      }
    );

    const fetchResponse = await getMessagesHandler(fetchRequest);
    const fetchData = await fetchResponse.json();

    const message = fetchData.messages.find(
      (msg: any) => msg.id === sentMessage.message.id
    );

    // Verify message includes sender information
    expect(message.userId).toBe(user1Id);
    expect(message.createdAt).toBeTruthy();

    // Should include user info if joined
    if (message.user) {
      expect(message.user.name).toBe('Test User 1');
    }
  });
});
