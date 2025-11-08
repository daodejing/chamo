import {
  Args,
  ArgsType,
  Field,
  InputType,
  Mutation,
  Query,
  Resolver,
} from '@nestjs/graphql';
import { UnauthorizedException, UseGuards } from '@nestjs/common';
import { MaxLength, IsIn, IsNotEmpty } from 'class-validator';
import { TranslationService } from './translation.service';
import { SUPPORTED_LANGUAGE_CODES } from './dto/translate.dto';
import type { SupportedLanguageCode } from './dto/translate.dto';
import { MessageTranslationType } from './types/message-translation.type';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

type AuthenticatedUser = {
  id: string;
  activeFamilyId?: string | null;
};

@ArgsType()
class MessageTranslationArgs {
  @Field()
  @IsNotEmpty()
  @MaxLength(128)
  messageId!: string;

  @Field()
  @IsIn(SUPPORTED_LANGUAGE_CODES)
  targetLanguage!: SupportedLanguageCode;
}

@InputType()
class CacheMessageTranslationInput {
  @Field()
  @IsNotEmpty()
  @MaxLength(128)
  messageId!: string;

  @Field()
  @IsIn(SUPPORTED_LANGUAGE_CODES)
  targetLanguage!: SupportedLanguageCode;

  @Field()
  @IsNotEmpty()
  encryptedTranslation!: string;
}

@Resolver(() => MessageTranslationType)
export class TranslationResolver {
  constructor(private readonly translationService: TranslationService) {}

  @Query(() => MessageTranslationType, { nullable: true })
  @UseGuards(GqlAuthGuard)
  async messageTranslation(
    @Args() args: MessageTranslationArgs,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MessageTranslationType | null> {
    if (!user?.id || !user.activeFamilyId) {
      throw new UnauthorizedException('User context required');
    }

    const record = await this.translationService.getCachedTranslation({
      messageId: args.messageId,
      targetLanguage: args.targetLanguage,
      userId: user.id,
      familyId: user.activeFamilyId,
    });

    return record;
  }

  @Mutation(() => MessageTranslationType)
  @UseGuards(GqlAuthGuard)
  async cacheMessageTranslation(
    @Args('input') input: CacheMessageTranslationInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MessageTranslationType> {
    if (!user?.id || !user.activeFamilyId) {
      throw new UnauthorizedException('User context required');
    }

    const record = await this.translationService.cacheTranslation({
      messageId: input.messageId,
      targetLanguage: input.targetLanguage,
      encryptedTranslation: input.encryptedTranslation,
      userId: user.id,
      familyId: user.activeFamilyId,
    });

    return record;
  }
}
