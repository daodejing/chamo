import { ObjectType, Field, ID } from '@nestjs/graphql';

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

  @Field(() => ID)
  familyId: string;
}

@ObjectType()
export class FamilyType {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field(() => String, { nullable: true })
  avatar: string | null;

  @Field()
  inviteCode: string;

  @Field()
  maxMembers: number;
}

@ObjectType()
export class AuthResponse {
  @Field(() => UserType)
  user: UserType;

  @Field(() => FamilyType)
  family: FamilyType;

  @Field()
  accessToken: string;

  @Field()
  refreshToken: string;
}
