import { InputType, Field } from '@nestjs/graphql';
import { IsString, Length } from 'class-validator';

@InputType()
export class ReportInviteDecryptFailureInput {
  @Field()
  @IsString()
  inviteCode: string;

  @Field()
  @IsString()
  @Length(1, 500)
  reason: string;
}
