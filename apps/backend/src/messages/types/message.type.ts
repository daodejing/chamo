import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class MessageUserType {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field(() => String, { nullable: true })
  avatar: string | null;
}

@ObjectType()
export class MessageType {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  channelId: string;

  @Field(() => ID)
  userId: string;

  @Field()
  encryptedContent: string;

  @Field()
  timestamp: Date;

  @Field()
  isEdited: boolean;

  @Field(() => Date, { nullable: true })
  editedAt: Date | null;

  @Field()
  createdAt: Date;
}

@ObjectType()
export class MessageWithUserType extends MessageType {
  @Field(() => MessageUserType)
  user: MessageUserType;
}
