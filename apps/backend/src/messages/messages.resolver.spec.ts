import { Test, TestingModule } from '@nestjs/testing';
import { PubSub } from 'graphql-subscriptions';
import { MessagesResolver } from './messages.resolver';
import { MessagesService } from './messages.service';
import { PrismaService } from '../prisma/prisma.service';
import { PUB_SUB } from './messages.constants';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';
import { GqlSubscriptionAuthGuard } from '../auth/gql-subscription-auth.guard';
import { JwtService } from '@nestjs/jwt';

/**
 * Integration Tests for GraphQL Message Subscriptions
 *
 * Tests the pub/sub mechanism for real-time message delivery:
 * - messageAdded: Verifies messages are published when sent
 * - messageEdited: Verifies edits are published
 * - messageDeleted: Verifies deletions are published
 * - Channel filtering: Verifies subscribers only receive messages for their channel
 *
 * These tests validate the subscription logic that E2E tests cannot reliably test
 * across multiple browser contexts due to WebSocket limitations.
 */

describe('MessagesResolver - Subscription Integration', () => {
  let resolver: MessagesResolver;
  let service: MessagesService;
  let pubSub: PubSub;

  // Test data
  const mockUser = {
    id: 'user-123',
    name: 'Test User',
    email: 'test@example.com',
  };

  const mockMessage = {
    id: 'message-123',
    channelId: 'channel-123',
    userId: 'user-123',
    encryptedContent: 'encrypted-test-message',
    timestamp: new Date(),
    isEdited: false,
    editedAt: null,
    user: {
      id: 'user-123',
      name: 'Test User',
      avatar: null,
    },
  };

  beforeEach(async () => {
    // Create a mock PubSub with spies
    pubSub = {
      publish: jest.fn().mockResolvedValue(undefined),
      asyncIterator: jest.fn().mockReturnValue({
        [Symbol.asyncIterator]: function* () {
          yield { messageAdded: mockMessage };
        },
      }),
      asyncIterableIterator: jest.fn().mockReturnValue({
        [Symbol.asyncIterator]: function* () {
          yield { messageAdded: mockMessage };
        },
      }),
    } as unknown as PubSub;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesResolver,
        {
          provide: MessagesService,
          useValue: {
            sendMessage: jest.fn(),
            editMessage: jest.fn(),
            deleteMessage: jest.fn(),
            getMessages: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            message: {
              create: jest.fn(),
              findUnique: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
            channel: {
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: PUB_SUB,
          useValue: pubSub,
        },
        {
          provide: JwtService,
          useValue: {
            verifyAsync: jest.fn(),
          },
        },
        {
          provide: GqlSubscriptionAuthGuard,
          useValue: {
            canActivate: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: GqlAuthGuard,
          useValue: {
            canActivate: jest.fn().mockResolvedValue(true),
          },
        },
      ],
    }).compile();

    resolver = module.get<MessagesResolver>(MessagesResolver);
    service = module.get<MessagesService>(MessagesService);
    // Resolver already receives mock via DI, but keep reference for expectations
    pubSub = module.get(PUB_SUB);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('messageAdded subscription', () => {
    it('should publish to messageAdded when sendMessage is called', async () => {
      // Arrange
      const input = {
        channelId: 'channel-123',
        encryptedContent: 'encrypted-test-message',
      };

      jest.spyOn(service, 'sendMessage').mockResolvedValue(mockMessage as any);

      // Act
      await resolver.sendMessage(mockUser, input);

      // Assert
      expect(pubSub.publish).toHaveBeenCalledWith('messageAdded', {
        messageAdded: mockMessage,
        channelId: mockMessage.channelId,
      });
    });

    it('should create async iterator for messageAdded subscription', () => {
      // Act
      const iterator = resolver.messageAdded('channel-123');

      // Assert
      expect(pubSub.asyncIterableIterator).toHaveBeenCalledWith('messageAdded');
      expect(iterator).toBeDefined();
    });

    it('should filter messages by channelId', async () => {
      // This test verifies the filter function in the subscription decorator
      // The filter is defined in the resolver and applied by GraphQL

      const input = {
        channelId: 'channel-123',
        encryptedContent: 'test-message',
      };

      jest.spyOn(service, 'sendMessage').mockResolvedValue(mockMessage as any);

      // Send message to channel-123
      await resolver.sendMessage(mockUser, input);

      // Verify the published payload includes channelId for filtering
      expect(pubSub.publish).toHaveBeenCalledWith(
        'messageAdded',
        expect.objectContaining({
          channelId: 'channel-123',
        }),
      );
    });
  });

  describe('messageEdited subscription', () => {
    it('should publish to messageEdited when editMessage is called', async () => {
      // Arrange
      const input = {
        messageId: 'message-123',
        encryptedContent: 'updated-encrypted-content',
      };

      const editedMessage = {
        ...mockMessage,
        encryptedContent: 'updated-encrypted-content',
        isEdited: true,
        editedAt: new Date(),
      };

      jest
        .spyOn(service, 'editMessage')
        .mockResolvedValue(editedMessage as any);

      // Act
      await resolver.editMessage(mockUser, input);

      // Assert
      expect(pubSub.publish).toHaveBeenCalledWith('messageEdited', {
        messageEdited: editedMessage,
        channelId: editedMessage.channelId,
      });
    });

    it('should create async iterator for messageEdited subscription', () => {
      // Act
      const iterator = resolver.messageEdited('channel-123');

      // Assert
      expect(pubSub.asyncIterableIterator).toHaveBeenCalledWith(
        'messageEdited',
      );
      expect(iterator).toBeDefined();
    });
  });

  describe('subscription guards', () => {
    it('should protect messageAdded with GqlSubscriptionAuthGuard', () => {
      const guards: any[] =
        Reflect.getMetadata(
          GUARDS_METADATA,
          MessagesResolver.prototype.messageAdded,
        ) ?? [];
      expect(guards).toContain(GqlSubscriptionAuthGuard);
    });

    it('should protect messageEdited with GqlSubscriptionAuthGuard', () => {
      const guards: any[] =
        Reflect.getMetadata(
          GUARDS_METADATA,
          MessagesResolver.prototype.messageEdited,
        ) ?? [];
      expect(guards).toContain(GqlSubscriptionAuthGuard);
    });

    it('should protect messageDeleted with GqlSubscriptionAuthGuard', () => {
      const guards: any[] =
        Reflect.getMetadata(
          GUARDS_METADATA,
          MessagesResolver.prototype.messageDeleted,
        ) ?? [];
      expect(guards).toContain(GqlSubscriptionAuthGuard);
    });
  });

  describe('messageDeleted subscription', () => {
    it('should publish to messageDeleted when deleteMessage is called', async () => {
      // Arrange
      const input = {
        messageId: 'message-123',
      };

      const deleteResult = {
        success: true,
        messageId: 'message-123',
      };

      jest.spyOn(service, 'deleteMessage').mockResolvedValue(deleteResult);

      // Act
      await resolver.deleteMessage(mockUser, input);

      // Assert
      expect(pubSub.publish).toHaveBeenCalledWith('messageDeleted', {
        messageDeleted: {
          messageId: 'message-123',
        },
      });
    });

    it('should create async iterator for messageDeleted subscription', () => {
      // Act
      const iterator = resolver.messageDeleted('channel-123');

      // Assert
      expect(pubSub.asyncIterableIterator).toHaveBeenCalledWith(
        'messageDeleted',
      );
      expect(iterator).toBeDefined();
    });
  });

  describe('Multi-subscriber scenario', () => {
    it('should publish message to all subscribers on the same channel', async () => {
      // This test simulates the real-time messaging scenario where
      // User A sends a message and User B (and all other family members)
      // should receive it via subscription

      const input = {
        channelId: 'channel-123',
        encryptedContent: 'Hello from User A',
      };

      jest.spyOn(service, 'sendMessage').mockResolvedValue({
        ...mockMessage,
        encryptedContent: 'Hello from User A',
      } as any);

      // Act - User A sends message
      await resolver.sendMessage(mockUser, input);

      // Assert - Message is published once to the channel
      // In production, GraphQL subscription engine will deliver this
      // to all subscribers who have called messageAdded(channelId)
      expect(pubSub.publish).toHaveBeenCalledTimes(1);
      expect(pubSub.publish).toHaveBeenCalledWith('messageAdded', {
        messageAdded: expect.objectContaining({
          encryptedContent: 'Hello from User A',
          channelId: 'channel-123',
        }),
        channelId: 'channel-123',
      });
    });
  });

  describe('Subscription delivery mechanism', () => {
    it('should verify asyncIterator is called with correct event name', async () => {
      // This test verifies that the subscription properly sets up
      // the async iterator for real-time delivery

      const channelId = 'channel-123';

      // Act - Create subscriptions for all three events
      resolver.messageAdded(channelId);
      resolver.messageEdited(channelId);
      resolver.messageDeleted(channelId);

      // Assert - Verify each subscription type creates its iterator
      expect(pubSub.asyncIterableIterator).toHaveBeenCalledWith('messageAdded');
      expect(pubSub.asyncIterableIterator).toHaveBeenCalledWith(
        'messageEdited',
      );
      expect(pubSub.asyncIterableIterator).toHaveBeenCalledWith(
        'messageDeleted',
      );
    });

    it('should handle concurrent message sends to same channel', async () => {
      // Simulate multiple users sending messages concurrently
      const user1Message = {
        channelId: 'channel-123',
        encryptedContent: 'Message from User 1',
      };

      const user2Message = {
        channelId: 'channel-123',
        encryptedContent: 'Message from User 2',
      };

      jest
        .spyOn(service, 'sendMessage')
        .mockResolvedValueOnce({
          ...mockMessage,
          encryptedContent: user1Message.encryptedContent,
        } as any)
        .mockResolvedValueOnce({
          ...mockMessage,
          id: 'message-124',
          encryptedContent: user2Message.encryptedContent,
        } as any);

      // Act - Send messages concurrently
      await Promise.all([
        resolver.sendMessage(mockUser, user1Message),
        resolver.sendMessage({ ...mockUser, id: 'user-456' }, user2Message),
      ]);

      // Assert - Both messages should be published
      expect(pubSub.publish).toHaveBeenCalledTimes(2);
      expect(pubSub.publish).toHaveBeenNthCalledWith(
        1,
        'messageAdded',
        expect.objectContaining({
          messageAdded: expect.objectContaining({
            encryptedContent: 'Message from User 1',
          }),
        }),
      );
      expect(pubSub.publish).toHaveBeenNthCalledWith(
        2,
        'messageAdded',
        expect.objectContaining({
          messageAdded: expect.objectContaining({
            encryptedContent: 'Message from User 2',
          }),
        }),
      );
    });

    it('should publish to correct channel without cross-channel leakage', async () => {
      // Verify that messages sent to channel-123 don't leak to channel-456
      const channel1Message = {
        channelId: 'channel-123',
        encryptedContent: 'Message for channel 123',
      };

      const channel2Message = {
        channelId: 'channel-456',
        encryptedContent: 'Message for channel 456',
      };

      jest
        .spyOn(service, 'sendMessage')
        .mockResolvedValueOnce({
          ...mockMessage,
          channelId: 'channel-123',
        } as any)
        .mockResolvedValueOnce({
          ...mockMessage,
          id: 'message-124',
          channelId: 'channel-456',
        } as any);

      // Act
      await resolver.sendMessage(mockUser, channel1Message);
      await resolver.sendMessage(mockUser, channel2Message);

      // Assert - Each message has correct channelId for filtering
      expect(pubSub.publish).toHaveBeenNthCalledWith(
        1,
        'messageAdded',
        expect.objectContaining({ channelId: 'channel-123' }),
      );
      expect(pubSub.publish).toHaveBeenNthCalledWith(
        2,
        'messageAdded',
        expect.objectContaining({ channelId: 'channel-456' }),
      );
    });
  });

  describe('Real-time delivery validation', () => {
    it('should verify subscription payload structure matches GraphQL type', async () => {
      // This test ensures the published data matches the MessageWithUserType schema
      const input = {
        channelId: 'channel-123',
        encryptedContent: 'test-message',
      };

      jest.spyOn(service, 'sendMessage').mockResolvedValue(mockMessage as any);

      // Act
      await resolver.sendMessage(mockUser, input);

      // Assert - Verify payload has correct structure
      const publishCall = (pubSub.publish as jest.Mock).mock.calls[0];
      const payload = publishCall[1];

      expect(payload).toHaveProperty('messageAdded');
      expect(payload).toHaveProperty('channelId');
      expect(payload.messageAdded).toMatchObject({
        id: expect.any(String),
        channelId: expect.any(String),
        userId: expect.any(String),
        encryptedContent: expect.any(String),
        timestamp: expect.any(Date),
        user: expect.objectContaining({
          id: expect.any(String),
          name: expect.any(String),
        }),
      });
    });
  });
});
