import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class Channel {
  @Field(() => ID)
  id: string;

  @Field()
  familyId: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  icon?: string;

  @Field()
  createdById: string;

  @Field()
  isDefault: boolean;

  @Field()
  createdAt: Date;
}
