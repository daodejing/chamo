import { InputType, Field } from '@nestjs/graphql';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

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
  @MaxLength(5)
  inviteeLanguage?: string;
}
