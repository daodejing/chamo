import { InputType, Field } from '@nestjs/graphql';
import { IsString } from 'class-validator';

@InputType()
export class AcceptInviteInput {
  @Field()
  @IsString()
  inviteCode: string;
}
