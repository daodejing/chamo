import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { TranslateDto } from './dto/translate.dto';
import { TranslationService } from './translation.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

type AuthenticatedUser = {
  id: string;
  activeFamilyId?: string | null;
};

const isProd = process.env.NODE_ENV === 'production';
const throttleConfig = isProd
  ? {
      short: { limit: 10, ttl: 60_000 },
      long: { limit: 100, ttl: 86_400_000 },
    }
  : {
      // Loosen limits for local/dev to avoid noisy rate limits during debugging
      short: { limit: 1_000, ttl: 60_000 },
      long: { limit: 10_000, ttl: 86_400_000 },
    };

@Controller('api/translate')
@UseGuards(JwtAuthGuard)
export class TranslationController {
  private readonly logger = new Logger(TranslationController.name);

  constructor(private readonly translationService: TranslationService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @Throttle(throttleConfig)
  async translate(
    @Body() dto: TranslateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!user?.id || !user.activeFamilyId) {
      throw new UnauthorizedException('User context required');
    }

    this.logger.debug(
      `Translation requested messageId=${dto.messageId} target=${dto.targetLanguage} user=${user.id} family=${user.activeFamilyId}`,
    );

    const result = await this.translationService.translate({
      messageId: dto.messageId,
      targetLanguage: dto.targetLanguage,
      text: dto.text,
      userId: user.id,
      familyId: user.activeFamilyId,
    });

    return {
      messageId: dto.messageId,
      ...result,
    };
  }
}
