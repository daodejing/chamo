import { InputType, Field } from '@nestjs/graphql';
import { IsEmail, IsNotEmpty } from 'class-validator';

/**
 * Input DTO for Story 1.5 email-bound invite creation
 * Admin specifies invitee email address to create invite code
 */
@InputType()
export class CreateInviteInput {
  @Field()
  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty({ message: 'Email is required' })
  inviteeEmail: string;
}
