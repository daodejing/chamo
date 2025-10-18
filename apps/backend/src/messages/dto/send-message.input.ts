import { InputType, Field, ID } from '@nestjs/graphql';
import { IsNotEmpty, IsUUID, IsString } from 'class-validator';

@InputType()
export class SendMessageInput {
  @Field(() => ID)
  @IsNotEmpty()
  @IsUUID()
  channelId: string;

  @Field()
  @IsNotEmpty()
  @IsString()
  encryptedContent: string;
}
