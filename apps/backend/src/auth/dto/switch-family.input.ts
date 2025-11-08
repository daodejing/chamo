import { Field, InputType, ID } from '@nestjs/graphql';

@InputType()
export class SwitchFamilyInput {
  @Field(() => ID)
  familyId: string;
}
