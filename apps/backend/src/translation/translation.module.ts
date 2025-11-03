import { Module } from '@nestjs/common';
import { TranslationController } from './translation.controller';
import { TranslationService } from './translation.service';
import { GroqService } from './groq.service';
import { PrismaModule } from '../prisma/prisma.module';
import { TranslationResolver } from './translation.resolver';

@Module({
  imports: [PrismaModule],
  controllers: [TranslationController],
  providers: [TranslationService, GroqService, TranslationResolver],
})
export class TranslationModule {}
