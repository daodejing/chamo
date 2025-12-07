import { Test } from '@nestjs/testing';
import { MessagesService } from './messages.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Story 1.14 AC12: Content Preservation with "Deleted User" Attribution
 *
 * Tests that messages from soft-deleted users display "Deleted User"
 * instead of their original name.
 */
describe('MessagesService - Story 1.14: Deleted User Attribution', () => {
  let messagesService: MessagesService;

  const prismaMock: any = {
    channel: {
      findUnique: jest.fn(),
    },
    message: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        MessagesService,
        { provide: PrismaService, useValue: prismaMock as PrismaService },
      ],
    }).compile();

    messagesService = moduleRef.get(MessagesService);
  });

  describe('AC12: Content Preservation - Deleted User Attribution', () => {
    const userId = 'user-id';
    const channelId = 'channel-id';
    const familyId = 'family-id';

    beforeEach(() => {
      // Setup channel access mock
      prismaMock.channel.findUnique.mockResolvedValue({
        id: channelId,
        family: {
          id: familyId,
          memberships: [{ id: 'membership-id' }], // User has access
        },
      });
    });

    it('should return "Deleted User" for messages from soft-deleted users', async () => {
      const deletedUserId = 'deleted-user-id';

      prismaMock.message.findMany.mockResolvedValueOnce([
        {
          id: 'message-1',
          channelId,
          userId: deletedUserId,
          encryptedContent: 'encrypted-content',
          timestamp: new Date(),
          isEdited: false,
          editedAt: null,
          createdAt: new Date(),
          user: {
            id: deletedUserId,
            name: 'Original Name',
            avatar: 'avatar-url',
            deletedAt: new Date('2025-01-15'), // User is soft-deleted
          },
        },
      ]);

      const result = await messagesService.getMessages(userId, {
        channelId,
        limit: 50,
      });

      expect(result).toHaveLength(1);
      expect(result[0].user.name).toBe('Deleted User');
      expect(result[0].user.avatar).toBeNull();
      expect(result[0].user.id).toBe(deletedUserId); // ID is preserved
    });

    it('should return original name for messages from active users', async () => {
      const activeUserId = 'active-user-id';

      prismaMock.message.findMany.mockResolvedValueOnce([
        {
          id: 'message-1',
          channelId,
          userId: activeUserId,
          encryptedContent: 'encrypted-content',
          timestamp: new Date(),
          isEdited: false,
          editedAt: null,
          createdAt: new Date(),
          user: {
            id: activeUserId,
            name: 'Active User',
            avatar: 'avatar-url',
            deletedAt: null, // User is NOT deleted
          },
        },
      ]);

      const result = await messagesService.getMessages(userId, {
        channelId,
        limit: 50,
      });

      expect(result).toHaveLength(1);
      expect(result[0].user.name).toBe('Active User');
      expect(result[0].user.avatar).toBe('avatar-url');
    });

    it('should handle mixed messages from active and deleted users', async () => {
      prismaMock.message.findMany.mockResolvedValueOnce([
        {
          id: 'message-1',
          channelId,
          userId: 'active-user',
          encryptedContent: 'hello',
          timestamp: new Date('2025-01-10'),
          isEdited: false,
          editedAt: null,
          createdAt: new Date('2025-01-10'),
          user: {
            id: 'active-user',
            name: 'Alice',
            avatar: 'alice-avatar',
            deletedAt: null,
          },
        },
        {
          id: 'message-2',
          channelId,
          userId: 'deleted-user',
          encryptedContent: 'world',
          timestamp: new Date('2025-01-11'),
          isEdited: false,
          editedAt: null,
          createdAt: new Date('2025-01-11'),
          user: {
            id: 'deleted-user',
            name: 'Bob',
            avatar: 'bob-avatar',
            deletedAt: new Date('2025-01-12'),
          },
        },
        {
          id: 'message-3',
          channelId,
          userId: 'active-user',
          encryptedContent: 'how are you',
          timestamp: new Date('2025-01-13'),
          isEdited: false,
          editedAt: null,
          createdAt: new Date('2025-01-13'),
          user: {
            id: 'active-user',
            name: 'Alice',
            avatar: 'alice-avatar',
            deletedAt: null,
          },
        },
      ]);

      const result = await messagesService.getMessages(userId, {
        channelId,
        limit: 50,
      });

      expect(result).toHaveLength(3);

      // First message: Alice (active)
      expect(result[0].user.name).toBe('Alice');
      expect(result[0].user.avatar).toBe('alice-avatar');

      // Second message: Bob (deleted)
      expect(result[1].user.name).toBe('Deleted User');
      expect(result[1].user.avatar).toBeNull();

      // Third message: Alice (active)
      expect(result[2].user.name).toBe('Alice');
      expect(result[2].user.avatar).toBe('alice-avatar');
    });

    it('should handle message with null user (fallback)', async () => {
      prismaMock.message.findMany.mockResolvedValueOnce([
        {
          id: 'message-1',
          channelId,
          userId: 'orphan-user',
          encryptedContent: 'orphan message',
          timestamp: new Date(),
          isEdited: false,
          editedAt: null,
          createdAt: new Date(),
          user: null, // User record doesn't exist
        },
      ]);

      const result = await messagesService.getMessages(userId, {
        channelId,
        limit: 50,
      });

      expect(result).toHaveLength(1);
      expect(result[0].user.name).toBe('Deleted User');
      expect(result[0].user.avatar).toBeNull();
      expect(result[0].user.id).toBe(''); // Empty ID for null user
    });

    it('should preserve message content for deleted users (content is NOT deleted)', async () => {
      const deletedUserId = 'deleted-user-id';
      const encryptedContent = 'base64-encrypted-message-content';

      prismaMock.message.findMany.mockResolvedValueOnce([
        {
          id: 'message-1',
          channelId,
          userId: deletedUserId,
          encryptedContent,
          timestamp: new Date(),
          isEdited: true,
          editedAt: new Date(),
          createdAt: new Date(),
          user: {
            id: deletedUserId,
            name: 'Deleted Person',
            avatar: 'old-avatar',
            deletedAt: new Date(),
          },
        },
      ]);

      const result = await messagesService.getMessages(userId, {
        channelId,
        limit: 50,
      });

      expect(result).toHaveLength(1);
      // Message content is preserved
      expect(result[0].encryptedContent).toBe(encryptedContent);
      expect(result[0].isEdited).toBe(true);
      // But user info is anonymized
      expect(result[0].user.name).toBe('Deleted User');
    });
  });
});
