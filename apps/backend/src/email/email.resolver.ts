import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { EmailService } from './email.service';

@Resolver()
export class EmailResolver {
  constructor(private readonly emailService: EmailService) {}

  /**
   * Test mutation to manually send verification email
   * Usage: mutation { sendTestVerificationEmail(email: "your@email.com", token: "test-token-123") }
   */
  @Mutation(() => Boolean, {
    description:
      'Send a test verification email (for development/testing only)',
  })
  async sendTestVerificationEmail(
    @Args('email') email: string,
    @Args('token', { defaultValue: 'test-token-123' }) token: string,
  ): Promise<boolean> {
    await this.emailService.sendVerificationEmail(email, token);
    return true;
  }

  /**
   * Test mutation to manually send welcome email
   * Usage: mutation { sendTestWelcomeEmail(email: "your@email.com", userName: "Test User") }
   */
  @Mutation(() => Boolean, {
    description: 'Send a test welcome email (for development/testing only)',
  })
  async sendTestWelcomeEmail(
    @Args('email') email: string,
    @Args('userName', { defaultValue: 'Test User' }) userName: string,
  ): Promise<boolean> {
    await this.emailService.sendWelcomeEmail(email, userName);
    return true;
  }

  /**
   * Test mutation to manually send invite notification
   * Usage: mutation { sendTestInviteEmail(email: "your@email.com", familyName: "Smith Family", inviteCode: "SMITH123") }
   */
  @Mutation(() => Boolean, {
    description:
      'Send a test invite notification email (for development/testing only)',
  })
  async sendTestInviteEmail(
    @Args('email') email: string,
    @Args('familyName', { defaultValue: 'Test Family' }) familyName: string,
    @Args('inviteCode', { defaultValue: 'TEST123' }) inviteCode: string,
  ): Promise<boolean> {
    await this.emailService.sendInviteNotification(
      email,
      familyName,
      inviteCode,
    );
    return true;
  }
}
