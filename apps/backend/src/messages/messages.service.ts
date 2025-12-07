import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SendMessageInput } from './dto/send-message.input';
import { EditMessageInput } from './dto/edit-message.input';
import { DeleteMessageInput } from './dto/delete-message.input';
import { GetMessagesInput } from './dto/get-messages.input';

const DELETED_USER_PLACEHOLDER = 'Deleted User';

interface MessageWithUserAndDeletedAt {
  id: string;
  channelId: string;
  userId: string;
  encryptedContent: string;
  timestamp: Date;
  isEdited: boolean;
  editedAt: Date | null;
  createdAt: Date;
  user: {
    id: string;
    name: string;
    avatar: string | null;
    deletedAt: Date | null;
  } | null;
}

interface MessageWithUser {
  id: string;
  channelId: string;
  userId: string;
  encryptedContent: string;
  timestamp: Date;
  isEdited: boolean;
  editedAt: Date | null;
  createdAt: Date;
  user: {
    id: string;
    name: string;
    avatar: string | null;
  };
}

@Injectable()
export class MessagesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Story 1.14 AC12: Transform user data to show "Deleted User" for soft-deleted users
   */
  private transformMessageUser(message: MessageWithUserAndDeletedAt): MessageWithUser {
    const { user, ...rest } = message;

    if (user?.deletedAt) {
      return {
        ...rest,
        user: {
          id: user.id,
          name: DELETED_USER_PLACEHOLDER,
          avatar: null,
        },
      };
    }

    return {
      ...rest,
      user: user
        ? { id: user.id, name: user.name, avatar: user.avatar }
        : { id: '', name: DELETED_USER_PLACEHOLDER, avatar: null },
    };
  }

  private async requireChannelAccess(channelId: string, userId: string) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      include: {
        family: {
          include: {
            memberships: {
              where: { userId },
              select: { id: true },
            },
          },
        },
      },
    });

    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    if (channel.family.memberships.length === 0) {
      throw new ForbiddenException('You do not have access to this channel');
    }

    return channel;
  }

  async sendMessage(userId: string, input: SendMessageInput) {
    const { channelId, encryptedContent } = input;

    await this.requireChannelAccess(channelId, userId);

    // Create message
    const message = await this.prisma.message.create({
      data: {
        channelId,
        userId,
        encryptedContent,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    });

    return message;
  }

  async getMessages(userId: string, input: GetMessagesInput) {
    const { channelId, limit = 50, cursor } = input;

    // Verify user has access to this channel
    await this.requireChannelAccess(channelId, userId);

    // Build query with cursor-based pagination
    const messages = await this.prisma.message.findMany({
      where: {
        channelId,
        ...(cursor ? { id: { lt: cursor } } : {}), // Messages before cursor
      },
      orderBy: {
        timestamp: 'asc', // Oldest first (standard chat order)
      },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
            deletedAt: true, // Story 1.14: Include for deleted user detection
          },
        },
      },
    });

    // Story 1.14 AC12: Transform deleted user names
    return messages.map((msg) => this.transformMessageUser(msg));
  }

  async editMessage(userId: string, input: EditMessageInput) {
    const { messageId, encryptedContent } = input;

    // Find message and verify ownership
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.userId !== userId) {
      throw new ForbiddenException('You can only edit your own messages');
    }

    // Update message
    const updatedMessage = await this.prisma.message.update({
      where: { id: messageId },
      data: {
        encryptedContent,
        isEdited: true,
        editedAt: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    });

    return updatedMessage;
  }

  async deleteMessage(userId: string, input: DeleteMessageInput) {
    const { messageId } = input;

    // Find message and verify ownership
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.userId !== userId) {
      throw new ForbiddenException('You can only delete your own messages');
    }

    // Delete message
    await this.prisma.message.delete({
      where: { id: messageId },
    });

    return { success: true, messageId };
  }
}
