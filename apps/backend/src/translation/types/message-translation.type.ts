import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class MessageTranslationType {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  messageId: string;

  @Field()
  targetLanguage: string;

  @Field()
  encryptedTranslation: string;

  @Field()
  createdAt: Date;
}
