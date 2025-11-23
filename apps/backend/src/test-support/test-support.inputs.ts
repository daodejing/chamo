import { Field, InputType } from '@nestjs/graphql';
import { IsEmail, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

@InputType()
export class TestUserSetupInput {
  @Field()
  @IsEmail()
  email: string;

  @Field()
  @IsNotEmpty()
  password: string;

  @Field()
  @IsNotEmpty()
  name: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  publicKey?: string;
}

@InputType()
export class TestCreateMessagingFixtureInput {
  @Field(() => TestUserSetupInput)
  @ValidateNested()
  @Type(() => TestUserSetupInput)
  admin: TestUserSetupInput;

  @Field(() => TestUserSetupInput)
  @ValidateNested()
  @Type(() => TestUserSetupInput)
  member: TestUserSetupInput;

  @Field()
  @IsNotEmpty()
  familyName: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  channelName?: string;
}
