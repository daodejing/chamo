import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';
import { InviteStatus } from '@prisma/client';

// Register the Prisma enum with GraphQL
registerEnumType(InviteStatus, {
  name: 'InviteStatus',
  description: 'The status of a family invite',
});

@ObjectType()
export class InviteType {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  familyId: string;

  @Field(() => ID)
  inviterId: string;

  @Field()
  inviteeEmail: string;

  @Field(() => String, { nullable: true })
  encryptedFamilyKey?: string | null;

  @Field(() => String, { nullable: true })
  nonce?: string | null;

  @Field()
  inviteCode: string;

  @Field(() => InviteStatus)
  status: InviteStatus;

  @Field()
  expiresAt: Date;

  @Field(() => Date, { nullable: true })
  acceptedAt?: Date | null;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

@ObjectType()
export class CreateInviteResponse {
  @Field(() => InviteType)
  invite: InviteType;

  @Field()
  inviteCode: string;

  @Field()
  message: string;
}

@ObjectType()
export class AcceptInviteResponse {
  @Field()
  success: boolean;

  @Field()
  message: string;

  @Field(() => ID)
  familyId: string;

  @Field()
  familyName: string;

  @Field()
  encryptedFamilyKey: string;

  @Field()
  nonce: string;

  @Field()
  inviterPublicKey: string;
}

/**
 * Response type for Story 1.5 email-bound invite creation
 * Simpler than CreateInviteResponse - only returns essential fields
 */
@ObjectType()
export class InviteResponse {
  @Field()
  inviteCode: string;

  @Field()
  inviteeEmail: string;

  @Field()
  expiresAt: Date;
}
