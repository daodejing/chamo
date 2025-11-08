import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class JoinFamilyExistingInput {
  @Field()
  inviteCode: string;

  @Field({ defaultValue: true })
  makeActive?: boolean;
}
