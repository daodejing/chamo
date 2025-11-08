import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { TranslationService } from './translation.service';
import { GroqService } from './groq.service';
import { PrismaService } from '../prisma/prisma.service';

type PrismaMock = jest.Mocked<Pick<
  PrismaService,
  'messageTranslation' | 'message' | 'familyMembership'
>>;

describe('TranslationService', () => {
  let service: TranslationService;
  let prisma: PrismaMock;
  let groq: jest.Mocked<GroqService>;

  const baseMessage = {
    channel: {
      familyId: 'family-1',
    },
  };

  beforeEach(() => {
    prisma = {
      messageTranslation: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      message: {
        findUnique: jest.fn(),
      },
      familyMembership: {} as never,
    } as PrismaMock;

    groq = {
      translateText: jest.fn(),
    } as unknown as jest.Mocked<GroqService>;

    service = new TranslationService(prisma as unknown as PrismaService, groq);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  const accessParams = {
    messageId: 'msg-1',
    targetLanguage: 'en' as const,
    userId: 'user-1',
    familyId: 'family-1',
  };

  describe('translate', () => {
    it('returns cached translation without calling Groq', async () => {
      prisma.message.findUnique.mockResolvedValue(baseMessage);
      prisma.messageTranslation.findUnique.mockResolvedValue({
        encryptedTranslation: 'encrypted-text',
      } as any);

      const result = await service.translate({
        ...accessParams,
        text: 'Hola',
      });

      expect(result).toEqual({
        cached: true,
        encryptedTranslation: 'encrypted-text',
        targetLanguage: 'en',
      });
      expect(groq.translateText).not.toHaveBeenCalled();
    });

    it('calls Groq when cache miss occurs', async () => {
      prisma.message.findUnique.mockResolvedValue(baseMessage);
      prisma.messageTranslation.findUnique.mockResolvedValue(null);
      groq.translateText.mockResolvedValue('Hello');

      const result = await service.translate({
        ...accessParams,
        text: 'Hola',
      });

      expect(result).toEqual({
        cached: false,
        translation: 'Hello',
        targetLanguage: 'en',
      });
      expect(groq.translateText).toHaveBeenCalledWith('Hola', 'en');
    });

    it('throws ForbiddenException when family mismatch occurs', async () => {
      prisma.message.findUnique.mockResolvedValue({
        channel: { familyId: 'another-family' },
      });

      await expect(
        service.translate({
          ...accessParams,
          text: 'Hola',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws NotFoundException when message missing', async () => {
      prisma.message.findUnique.mockResolvedValue(null);

      await expect(
        service.translate({
          ...accessParams,
          text: 'Hola',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects unsupported language codes', async () => {
      prisma.message.findUnique.mockResolvedValue(baseMessage);
      await expect(
        service.translate({
          ...accessParams,
          targetLanguage: 'zz' as any,
          text: 'Hola',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('cacheTranslation', () => {
    it('upserts encrypted translation after access validation', async () => {
      prisma.message.findUnique.mockResolvedValue(baseMessage);
      prisma.messageTranslation.upsert.mockResolvedValue({
        id: 'cache-1',
      } as any);

      const result = await service.cacheTranslation({
        ...accessParams,
        encryptedTranslation: 'cipher',
      });

      expect(prisma.messageTranslation.upsert).toHaveBeenCalledWith({
        where: {
          messageId_targetLanguage: {
            messageId: 'msg-1',
            targetLanguage: 'en',
          },
        },
        update: {
          encryptedTranslation: 'cipher',
        },
        create: {
          messageId: 'msg-1',
          targetLanguage: 'en',
          encryptedTranslation: 'cipher',
        },
      });
      expect(result).toEqual({ id: 'cache-1' });
    });
  });

  describe('getCachedTranslation', () => {
    it('returns translation after validating membership', async () => {
      prisma.message.findUnique.mockResolvedValue(baseMessage);
      prisma.messageTranslation.findUnique.mockResolvedValue({
        id: 'cache',
      } as any);

      const result = await service.getCachedTranslation(accessParams);
      expect(result).toEqual({ id: 'cache' });
    });
  });
});
