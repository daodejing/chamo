import { InputType, Field } from '@nestjs/graphql';

@InputType()
export class DeregisterSelfInput {
  @Field({ nullable: true })
  confirmationPhrase?: string;
}
