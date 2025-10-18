import { InputType, Field, ID } from '@nestjs/graphql';
import { IsNotEmpty, IsUUID } from 'class-validator';

@InputType()
export class DeleteMessageInput {
  @Field(() => ID)
  @IsNotEmpty()
  @IsUUID()
  messageId: string;
}
