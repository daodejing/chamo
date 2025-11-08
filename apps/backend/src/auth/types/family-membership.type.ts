import { ObjectType, Field, ID } from '@nestjs/graphql';
import { FamilyType } from './family.type';

@ObjectType()
export class FamilyMembershipType {
  @Field(() => ID)
  id: string;

  @Field()
  role: string;

  @Field()
  joinedAt: Date;

  @Field(() => String)
  familyId: string;

  @Field(() => FamilyType)
  family: FamilyType;
}
