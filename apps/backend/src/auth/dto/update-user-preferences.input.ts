import { InputType, Field } from '@nestjs/graphql';
import { IsOptional, IsString, IsIn } from 'class-validator';

// Translation language codes as per AC#2
const TRANSLATION_LANGUAGES = [
  'en', 'ja', 'es', 'fr', 'de', 'zh', 'ko', 'pt',
  'ru', 'ar', 'it', 'nl', 'pl', 'tr', 'vi', 'th',
  'id', 'hi', 'sv', 'no',
] as const;

@InputType()
export class UpdateUserPreferencesInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @IsIn(TRANSLATION_LANGUAGES, {
    message: `preferredLanguage must be one of: ${TRANSLATION_LANGUAGES.join(', ')}`,
  })
  preferredLanguage?: string;
}
