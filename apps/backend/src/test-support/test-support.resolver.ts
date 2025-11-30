import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { TestSupportService } from './test-support.service';
import { MessagingFixturePayload, FamilyAdminFixturePayload, CleanupResult } from './test-support.types';
import { TestCreateMessagingFixtureInput, TestCreateFamilyAdminFixtureInput, TestCleanupInput } from './test-support.inputs';

@Resolver()
export class TestSupportResolver {
  constructor(private readonly testSupportService: TestSupportService) {}

  @Mutation(() => MessagingFixturePayload)
  async testCreateMessagingFixture(
    @Args('input') input: TestCreateMessagingFixtureInput,
  ): Promise<MessagingFixturePayload> {
    return this.testSupportService.createMessagingFixture(input);
  }

  @Mutation(() => FamilyAdminFixturePayload, {
    description: 'Create a family admin fixture for invite tests',
  })
  async testCreateFamilyAdminFixture(
    @Args('input') input: TestCreateFamilyAdminFixtureInput,
  ): Promise<FamilyAdminFixturePayload> {
    return this.testSupportService.createFamilyAdminFixture(input);
  }

  @Mutation(() => CleanupResult, {
    description: 'Clean up test data by user IDs, family IDs, or email patterns',
  })
  async testCleanup(
    @Args('input') input: TestCleanupInput,
  ): Promise<CleanupResult> {
    return this.testSupportService.cleanup(input);
  }
}
