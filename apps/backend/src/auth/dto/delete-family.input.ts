import { Field, InputType, ID } from '@nestjs/graphql';
import { IsNotEmpty, IsUUID } from 'class-validator';

@InputType()
export class DeleteFamilyInput {
  @Field(() => ID)
  @IsNotEmpty({ message: 'Family ID is required' })
  @IsUUID('4', { message: 'Invalid family ID format' })
  familyId: string;
}
