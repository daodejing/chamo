import { InputType, Field } from '@nestjs/graphql';
import { IsEmail, IsString, Length, Matches, MinLength } from 'class-validator';

@InputType()
export class RegisterInput {
  @Field()
  @IsEmail()
  email: string;

  @Field()
  @IsString()
  @MinLength(8)
  password: string;

  @Field()
  @IsString()
  @MinLength(2)
  name: string;

  @Field()
  @IsString()
  @MinLength(2)
  familyName: string;

  @Field()
  @IsString()
  inviteCode: string; // Client-generated invite code for family lookup

  @Field()
  @IsString()
  @Length(44, 44)
  @Matches(/^[A-Za-z0-9+/]+={0,2}$/, {
    message: 'publicKey must be base64-encoded (44 chars)',
  })
  publicKey: string;
}
