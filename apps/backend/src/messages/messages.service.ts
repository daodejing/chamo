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

@Injectable()
export class MessagesService {
  constructor(private prisma: PrismaService) {}

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
          },
        },
      },
    });

    return messages;
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
