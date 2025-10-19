import { ObjectType, Field, ID } from '@nestjs/graphql';

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
