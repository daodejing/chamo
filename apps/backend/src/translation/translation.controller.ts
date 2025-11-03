import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
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
  familyId: string;
};

@Controller('api/translate')
@UseGuards(JwtAuthGuard)
export class TranslationController {
  constructor(private readonly translationService: TranslationService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @Throttle({
    short: { limit: 10, ttl: 60_000 },
    long: { limit: 100, ttl: 86_400_000 },
  })
  async translate(
    @Body() dto: TranslateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!user?.id || !user.familyId) {
      throw new UnauthorizedException('User context required');
    }

    const result = await this.translationService.translate({
      messageId: dto.messageId,
      targetLanguage: dto.targetLanguage,
      text: dto.text,
      userId: user.id,
      familyId: user.familyId,
    });

    return {
      messageId: dto.messageId,
      ...result,
    };
  }
}
