import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { TestSupportService } from './test-support.service';
import { MessagingFixturePayload } from './test-support.types';
import { TestCreateMessagingFixtureInput } from './test-support.inputs';

@Resolver()
export class TestSupportResolver {
  constructor(private readonly testSupportService: TestSupportService) {}

  @Mutation(() => MessagingFixturePayload)
  async testCreateMessagingFixture(
    @Args('input') input: TestCreateMessagingFixtureInput,
  ): Promise<MessagingFixturePayload> {
    return this.testSupportService.createMessagingFixture(input);
  }
}
