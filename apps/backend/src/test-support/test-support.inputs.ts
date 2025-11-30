import { Field, InputType } from '@nestjs/graphql';
import { IsEmail, IsNotEmpty, IsOptional, IsString, ValidateNested, IsArray } from 'class-validator';
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

/**
 * Input for creating a family admin fixture (single user with family)
 */
@InputType()
export class TestCreateFamilyAdminFixtureInput {
  @Field(() => TestUserSetupInput)
  @ValidateNested()
  @Type(() => TestUserSetupInput)
  admin: TestUserSetupInput;

  @Field()
  @IsNotEmpty()
  familyName: string;
}

/**
 * Input for cleaning up test data
 */
@InputType()
export class TestCleanupInput {
  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  userIds?: string[];

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  familyIds?: string[];

  @Field(() => [String], { nullable: true, description: 'Email patterns to match (e.g., test-*@example.com)' })
  @IsOptional()
  @IsArray()
  emailPatterns?: string[];
}
