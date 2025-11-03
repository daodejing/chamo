import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GroqService } from './groq.service';
import {
  SUPPORTED_LANGUAGE_CODES,
  SupportedLanguageCode,
} from './dto/translate.dto';
import { MessageTranslation } from '@prisma/client';

interface TranslateParams {
  messageId: string;
  targetLanguage: SupportedLanguageCode;
  text: string;
  userId: string;
  familyId: string;
}

interface GetCachedTranslationParams {
  messageId: string;
  targetLanguage: SupportedLanguageCode;
  userId: string;
  familyId: string;
}

interface CacheTranslationParams {
  messageId: string;
  targetLanguage: SupportedLanguageCode;
  encryptedTranslation: string;
  userId: string;
  familyId: string;
}

export interface TranslationResponse {
  cached: boolean;
  translation?: string;
  encryptedTranslation?: string;
  targetLanguage: SupportedLanguageCode;
}

@Injectable()
export class TranslationService {
  private readonly logger = new Logger(TranslationService.name);
  private static readonly supportedLanguages = new Set<string>(
    SUPPORTED_LANGUAGE_CODES,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly groqService: GroqService,
  ) {}

  async translate(params: TranslateParams): Promise<TranslationResponse> {
    const { messageId, targetLanguage, text, userId, familyId } = params;

    this.assertSupportedLanguage(targetLanguage);
    await this.ensureMessageAccess({ messageId, familyId, userId });

    const cachedTranslation = await this.prisma.messageTranslation.findUnique({
      where: {
        messageId_targetLanguage: {
          messageId,
          targetLanguage,
        },
      },
      select: {
        encryptedTranslation: true,
      },
    });

    if (cachedTranslation) {
      return {
        cached: true,
        encryptedTranslation: cachedTranslation.encryptedTranslation,
        targetLanguage,
      };
    }

    const translation = await this.groqService.translateText(
      text,
      targetLanguage,
    );

    return {
      cached: false,
      translation,
      targetLanguage,
    };
  }

  async getCachedTranslation(
    params: GetCachedTranslationParams,
  ): Promise<MessageTranslation | null> {
    const { messageId, targetLanguage, familyId, userId } = params;

    this.assertSupportedLanguage(targetLanguage);
    await this.ensureMessageAccess({ messageId, familyId, userId });

    return this.prisma.messageTranslation.findUnique({
      where: {
        messageId_targetLanguage: {
          messageId,
          targetLanguage,
        },
      },
    });
  }

  async cacheTranslation(
    params: CacheTranslationParams,
  ): Promise<MessageTranslation> {
    const {
      messageId,
      targetLanguage,
      encryptedTranslation,
      familyId,
      userId,
    } = params;

    this.assertSupportedLanguage(targetLanguage);
    await this.ensureMessageAccess({ messageId, familyId, userId });

    return this.prisma.messageTranslation.upsert({
      where: {
        messageId_targetLanguage: {
          messageId,
          targetLanguage,
        },
      },
      update: {
        encryptedTranslation,
      },
      create: {
        messageId,
        targetLanguage,
        encryptedTranslation,
      },
    });
  }

  private assertSupportedLanguage(targetLanguage: string) {
    if (!TranslationService.supportedLanguages.has(targetLanguage)) {
      throw new BadRequestException('Unsupported target language');
    }
  }

  private async ensureMessageAccess({
    messageId,
    familyId,
    userId,
  }: {
    messageId: string;
    familyId: string;
    userId: string;
  }) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: {
        channel: {
          select: {
            familyId: true,
          },
        },
      },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.channel.familyId !== familyId) {
      this.logger.warn(
        `User ${userId} attempted to access message ${messageId} outside their family`,
      );
      throw new ForbiddenException('Access to message translation denied');
    }
  }
}
