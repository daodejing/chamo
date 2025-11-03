import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { TranslationService } from './translation.service';
import { PrismaService } from '../prisma/prisma.service';
import { GroqService } from './groq.service';

const prismaMock = {
  message: {
    findUnique: jest.fn(),
  },
  messageTranslation: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
} as unknown as jest.Mocked<PrismaService>;

const groqMock = {
  translateText: jest.fn(),
} as unknown as jest.Mocked<GroqService>;

const buildService = () =>
  new TranslationService(
    prismaMock as unknown as PrismaService,
    groqMock as unknown as GroqService,
  );

describe('TranslationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns cached translation when present', async () => {
    prismaMock.message.findUnique.mockResolvedValue({
      channel: { familyId: 'family-1' },
    } as any);
    prismaMock.messageTranslation.findUnique.mockResolvedValue({
      encryptedTranslation: 'ciphertext',
    } as any);

    const service = buildService();
    const result = await service.translate({
      messageId: 'msg-1',
      targetLanguage: 'ja',
      text: 'こんにちは',
      userId: 'user-1',
      familyId: 'family-1',
    });

    expect(result).toEqual({
      cached: true,
      encryptedTranslation: 'ciphertext',
      targetLanguage: 'ja',
    });
    expect(groqMock.translateText).not.toHaveBeenCalled();
  });

  it('fetches translation when cache miss occurs', async () => {
    prismaMock.message.findUnique.mockResolvedValue({
      channel: { familyId: 'family-1' },
    } as any);
    prismaMock.messageTranslation.findUnique.mockResolvedValue(null);
    groqMock.translateText.mockResolvedValue('Hello');

    const service = buildService();
    const result = await service.translate({
      messageId: 'msg-1',
      targetLanguage: 'en',
      text: 'こんにちは',
      userId: 'user-1',
      familyId: 'family-1',
    });

    expect(result).toEqual({
      cached: false,
      translation: 'Hello',
      targetLanguage: 'en',
    });
    expect(groqMock.translateText).toHaveBeenCalledWith('こんにちは', 'en');
  });

  it('throws when message does not exist', async () => {
    prismaMock.message.findUnique.mockResolvedValue(null);

    const service = buildService();
    await expect(
      service.translate({
        messageId: 'missing',
        targetLanguage: 'en',
        text: 'hola',
        userId: 'user-1',
        familyId: 'family-1',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('blocks access when family does not match', async () => {
    prismaMock.message.findUnique.mockResolvedValue({
      channel: { familyId: 'different-family' },
    } as any);

    const service = buildService();
    await expect(
      service.translate({
        messageId: 'msg-1',
        targetLanguage: 'en',
        text: 'hola',
        userId: 'user-1',
        familyId: 'family-1',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('retrieves cached translation via dedicated method', async () => {
    prismaMock.message.findUnique.mockResolvedValue({
      channel: { familyId: 'family-1' },
    } as any);
    prismaMock.messageTranslation.findUnique.mockResolvedValue({
      id: 'translation-1',
    } as any);

    const service = buildService();
    const result = await service.getCachedTranslation({
      messageId: 'msg-1',
      targetLanguage: 'en',
      userId: 'user-1',
      familyId: 'family-1',
    });

    expect(result).toEqual({
      id: 'translation-1',
    });
  });

  it('caches encrypted translation via upsert', async () => {
    prismaMock.message.findUnique.mockResolvedValue({
      channel: { familyId: 'family-1' },
    } as any);
    prismaMock.messageTranslation.upsert.mockResolvedValue({
      id: 'translation-1',
    } as any);

    const service = buildService();
    const result = await service.cacheTranslation({
      messageId: 'msg-1',
      targetLanguage: 'en',
      encryptedTranslation: 'ciphertext',
      userId: 'user-1',
      familyId: 'family-1',
    });

    expect(prismaMock.messageTranslation.upsert).toHaveBeenCalledWith({
      where: {
        messageId_targetLanguage: {
          messageId: 'msg-1',
          targetLanguage: 'en',
        },
      },
      update: { encryptedTranslation: 'ciphertext' },
      create: {
        messageId: 'msg-1',
        targetLanguage: 'en',
        encryptedTranslation: 'ciphertext',
      },
    });
    expect(result).toEqual({ id: 'translation-1' });
  });

  it('rejects unsupported languages', async () => {
    prismaMock.message.findUnique.mockResolvedValue({
      channel: { familyId: 'family-1' },
    } as any);

    const service = buildService();
    await expect(
      service.getCachedTranslation({
        messageId: 'msg-1',
        targetLanguage: 'xx' as any,
        userId: 'user-1',
        familyId: 'family-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
