import { InputType, Field } from '@nestjs/graphql';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, IsIn } from 'class-validator';
import { SUPPORTED_LANGUAGES } from './create-invite.input';

@InputType()
export class CreatePendingInviteInput {
  @Field()
  @IsNotEmpty()
  familyId: string;

  @Field()
  @IsEmail()
  inviteeEmail: string;

  @Field({ nullable: true, description: 'ISO 639-1 language code for the invite email (e.g., "en", "ja")' })
  @IsOptional()
  @IsString()
  @IsIn(SUPPORTED_LANGUAGES, {
    message:
      'Invalid language code. Must be one of: en, ja, es, fr, de, zh, ko, pt, ru, ar, it, nl, pl, tr, vi, th, id, hi, sv, no',
  })
  @MaxLength(5)
  inviteeLanguage?: string;
}
