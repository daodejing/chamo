import { InputType, Field, ID } from '@nestjs/graphql';
import { IsNotEmpty, IsUUID, IsString } from 'class-validator';

@InputType()
export class EditMessageInput {
  @Field(() => ID)
  @IsNotEmpty()
  @IsUUID()
  messageId: string;

  @Field()
  @IsNotEmpty()
  @IsString()
  encryptedContent: string;
}
