import { ObjectType, Field, ID } from '@nestjs/graphql';
import type { Prisma } from '@prisma/client';
import { FamilyType } from './family.type';
import { FamilyMembershipType } from './family-membership.type';
import { UserPreferencesType } from './user-preferences.type';

@ObjectType()
export class UserType {
  @Field(() => ID)
  id: string;

  @Field()
  email: string;

  @Field()
  name: string;

  @Field(() => String, { nullable: true })
  avatar: string | null;

  @Field()
  role: string;

  @Field()
  publicKey: string;

  @Field(() => Boolean)
  emailVerified: boolean;

  @Field(() => ID, { nullable: true })
  activeFamilyId?: string;

  @Field(() => FamilyType, { nullable: true })
  activeFamily?: FamilyType;

  @Field(() => [FamilyMembershipType])
  memberships: FamilyMembershipType[];

  @Field(() => UserPreferencesType, { nullable: true })
  preferences?: UserPreferencesType | Prisma.JsonValue | null;
}

@ObjectType()
export class AuthResponse {
  @Field(() => UserType)
  user: UserType;

  @Field(() => FamilyType, { nullable: true })
  family: FamilyType | null;

  @Field()
  accessToken: string;

  @Field()
  refreshToken: string;

  @Field(() => String, { nullable: true })
  pendingInviteCode?: string | null;
}

@ObjectType()
export class EmailVerificationResponse {
  @Field()
  message: string;

  @Field()
  requiresEmailVerification: boolean;

  @Field(() => ID)
  userId: string;
}

@ObjectType()
export class GenericResponse {
  @Field()
  success: boolean;

  @Field()
  message: string;
}

@ObjectType()
export class CreateFamilyResponse {
  @Field(() => FamilyType)
  family: FamilyType;

  @Field()
  inviteCode: string;
}

@ObjectType()
export class BlockingFamilyType {
  @Field(() => ID)
  familyId: string;

  @Field()
  familyName: string;

  @Field()
  memberCount: number;

  @Field()
  requiresAction: boolean;
}

@ObjectType()
export class AdminStatusResponse {
  @Field()
  canDelete: boolean;

  @Field(() => [BlockingFamilyType])
  blockingFamilies: BlockingFamilyType[];
}
