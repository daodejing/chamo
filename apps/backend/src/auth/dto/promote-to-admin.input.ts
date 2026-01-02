import { Field, InputType, ID } from '@nestjs/graphql';
import { IsNotEmpty, IsUUID } from 'class-validator';

@InputType()
export class PromoteToAdminInput {
  @Field(() => ID)
  @IsNotEmpty({ message: 'User ID is required' })
  @IsUUID('4', { message: 'Invalid user ID format' })
  userId: string;

  @Field(() => ID)
  @IsNotEmpty({ message: 'Family ID is required' })
  @IsUUID('4', { message: 'Invalid family ID format' })
  familyId: string;
}
