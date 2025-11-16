import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChannelsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get all channels for a family
   */
  async getChannelsByFamilyId(familyId: string) {
    if (!familyId) {
      return [];
    }
    return this.prisma.channel.findMany({
      where: { familyId },
      orderBy: [
        { isDefault: 'desc' }, // Default channels first
        { createdAt: 'asc' }, // Then by creation date
      ],
    });
  }

  /**
   * Get a single channel by ID
   */
  async getChannelById(id: string) {
    return this.prisma.channel.findUnique({
      where: { id },
    });
  }
}
