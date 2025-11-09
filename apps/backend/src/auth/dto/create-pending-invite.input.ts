import { InputType, Field } from '@nestjs/graphql';
import { IsEmail, IsNotEmpty } from 'class-validator';

@InputType()
export class CreatePendingInviteInput {
  @Field()
  @IsNotEmpty()
  familyId: string;

  @Field()
  @IsEmail()
  inviteeEmail: string;
}
