import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class FamilyMemberType {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  email: string;

  @Field(() => String, { nullable: true })
  avatar: string | null;

  @Field()
  role: string;

  @Field()
  joinedAt: Date;
}
