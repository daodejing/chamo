import { InputType, Field, ID, Int } from '@nestjs/graphql';
import {
  IsNotEmpty,
  IsUUID,
  IsOptional,
  IsInt,
  Min,
  Max,
} from 'class-validator';

@InputType()
export class GetMessagesInput {
  @Field(() => ID)
  @IsNotEmpty()
  @IsUUID()
  channelId: string;

  @Field(() => Int, { nullable: true, defaultValue: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  cursor?: string; // Message ID to paginate from
}
