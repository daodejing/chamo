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
