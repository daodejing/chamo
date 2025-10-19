import { ObjectType, Field, ID } from '@nestjs/graphql';
import { FamilyType } from './family.type';

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

  @Field(() => FamilyType, { nullable: true })
  family?: FamilyType;
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
