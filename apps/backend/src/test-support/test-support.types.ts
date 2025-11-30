import { Field, ObjectType } from '@nestjs/graphql';
import { AuthResponse } from '../auth/types/auth-response.type';
import { FamilyType } from '../auth/types/family.type';
import { Channel } from '../channels/types/channel.type';

@ObjectType()
export class MessagingFixturePayload {
  @Field(() => AuthResponse)
  admin: AuthResponse;

  @Field(() => AuthResponse)
  member: AuthResponse;

  @Field(() => FamilyType)
  family: FamilyType;

  @Field(() => Channel)
  channel: Channel;

  @Field()
  inviteCode: string;
}

/**
 * Payload for family admin fixture - used for invite-related tests
 */
@ObjectType()
export class FamilyAdminFixturePayload {
  @Field(() => AuthResponse)
  admin: AuthResponse;

  @Field(() => FamilyType)
  family: FamilyType;

  @Field()
  inviteCode: string;
}

/**
 * Result of cleanup operation
 */
@ObjectType()
export class CleanupResult {
  @Field()
  success: boolean;

  @Field()
  message: string;

  @Field()
  deletedUsers: number;

  @Field()
  deletedFamilies: number;
}
