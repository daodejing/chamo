import { InputType, Field } from '@nestjs/graphql';
import { IsString, IsEmail, IsDateString } from 'class-validator';

@InputType()
export class CreateEncryptedInviteInput {
  @Field()
  @IsString()
  familyId: string;

  @Field()
  @IsEmail()
  inviteeEmail: string;

  @Field()
  @IsString()
  encryptedFamilyKey: string; // Base64-encoded encrypted family key

  @Field()
  @IsString()
  nonce: string; // Base64-encoded nonce for nacl.box

  @Field()
  @IsString()
  inviteCode: string; // Client-generated unique invite code (e.g., INV-XXXX-YYYY)

  @Field()
  @IsDateString()
  expiresAt: string; // ISO 8601 date string
}
