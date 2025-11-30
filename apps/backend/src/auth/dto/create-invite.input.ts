import { InputType, Field } from '@nestjs/graphql';
import { IsEmail, IsNotEmpty, IsOptional, IsIn } from 'class-validator';

/**
 * Supported language codes (ISO 639-1) for invite emails
 * Same as Story 5.4 translation languages
 */
export const SUPPORTED_LANGUAGES = [
  'en', 'ja', 'es', 'fr', 'de', 'zh', 'ko', 'pt',
  'ru', 'ar', 'it', 'nl', 'pl', 'tr', 'vi', 'th',
  'id', 'hi', 'sv', 'no',
] as const;

export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

/**
 * Input DTO for Story 1.5 email-bound invite creation
 * Admin specifies invitee email address to create invite code
 * Story 1.13: Added optional inviteeLanguage for email language preference
 */
@InputType()
export class CreateInviteInput {
  @Field()
  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty({ message: 'Email is required' })
  inviteeEmail: string;

  @Field(() => String, { nullable: true, description: 'ISO 639-1 language code for invite email (defaults to en)' })
  @IsOptional()
  @IsIn(SUPPORTED_LANGUAGES, { message: 'Invalid language code. Must be one of: en, ja, es, fr, de, zh, ko, pt, ru, ar, it, nl, pl, tr, vi, th, id, hi, sv, no' })
  inviteeLanguage?: string;
}
