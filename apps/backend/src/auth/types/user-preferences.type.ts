import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
export class UserPreferencesType {
  @Field(() => String, { nullable: true })
  preferredLanguage?: string | null;
}
