import {
  Resolver,
  Mutation,
  Args,
  Query,
  ResolveField,
  Parent,
} from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterInput } from './dto/register.input';
import { CreateFamilyInput } from './dto/create-family.input';
import { JoinFamilyInput } from './dto/join-family.input';
import { JoinFamilyExistingInput } from './dto/join-family-existing.input';
import { SwitchFamilyInput } from './dto/switch-family.input';
import { LoginInput } from './dto/login.input';
import { UpdateUserPreferencesInput } from './dto/update-user-preferences.input';
import { CreateEncryptedInviteInput } from './dto/create-encrypted-invite.input';
import { AcceptInviteInput } from './dto/accept-invite.input';
import { CreatePendingInviteInput } from './dto/create-pending-invite.input';
import { CreateInviteInput } from './dto/create-invite.input';
import { ReportInviteDecryptFailureInput } from './dto/report-invite-decrypt-failure.input';
import { AuthResponse, UserType, EmailVerificationResponse, GenericResponse, CreateFamilyResponse } from './types/auth-response.type';
import { CreateInviteResponse, AcceptInviteResponse, InviteType, InviteResponse } from './types/invite.type';
import { FamilyType } from './types/family.type';
import { FamilyMembershipType } from './types/family-membership.type';
import { UserPreferencesType } from './types/user-preferences.type';
import { GqlAuthGuard } from './guards/gql-auth.guard';
import { CurrentUser } from './current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import type { User } from '@prisma/client';

@Resolver(() => UserType)
export class AuthResolver {
  constructor(
    private authService: AuthService,
    private prisma: PrismaService,
  ) {}

  @Mutation(() => EmailVerificationResponse)
  async register(@Args('input') input: RegisterInput): Promise<EmailVerificationResponse> {
    return this.authService.register(
      input.email,
      input.password,
      input.name,
      input.publicKey,
      input.pendingInviteCode ?? null,
    );
  }

  @Mutation(() => CreateFamilyResponse)
  @UseGuards(GqlAuthGuard)
  async createFamily(
    @CurrentUser() user: User,
    @Args('input') input: CreateFamilyInput,
  ): Promise<CreateFamilyResponse> {
    return this.authService.createFamily(
      user.id,
      input.name,
      input.inviteCode,
    );
  }

  @Mutation(() => EmailVerificationResponse)
  async joinFamily(
    @Args('input') input: JoinFamilyInput,
  ): Promise<EmailVerificationResponse> {
    return this.authService.joinFamily(
      input.email,
      input.password,
      input.name,
      input.inviteCode,
      input.publicKey,
    );
  }

  @Mutation(() => AuthResponse)
  async verifyEmail(@Args('token') token: string): Promise<AuthResponse> {
    return this.authService.verifyEmail(token);
  }

  @Mutation(() => GenericResponse)
  async resendVerificationEmail(@Args('email') email: string): Promise<GenericResponse> {
    return this.authService.resendVerificationEmail(email);
  }

  @Mutation(() => FamilyType)
  @UseGuards(GqlAuthGuard)
  async joinFamilyAsMember(
    @CurrentUser() user: User,
    @Args('input') input: JoinFamilyExistingInput,
  ): Promise<FamilyType> {
    return this.authService.joinFamilyAsMember(
      user.id,
      input.inviteCode,
      input.makeActive ?? true,
    );
  }

  @Mutation(() => UserType)
  @UseGuards(GqlAuthGuard)
  async switchActiveFamily(
    @CurrentUser() user: User,
    @Args('input') input: SwitchFamilyInput,
  ): Promise<UserType> {
    return this.authService.switchActiveFamily(user.id, input.familyId);
  }

  @Mutation(() => AuthResponse)
  async login(@Args('input') input: LoginInput): Promise<AuthResponse> {
    return this.authService.login(input.email, input.password);
  }

  @Query(() => UserType)
  @UseGuards(GqlAuthGuard)
  async me(@CurrentUser() user: User): Promise<UserType> {
    return this.authService.validateUser(user.id);
  }

  @ResolveField(() => FamilyType, { nullable: true, name: 'family' })
  family(@Parent() user: UserType): FamilyType | null {
    return user.activeFamily ?? null;
  }

  @ResolveField(() => FamilyType, { nullable: true })
  activeFamily(@Parent() user: UserType): FamilyType | null {
    return user.activeFamily ?? null;
  }

  @ResolveField(() => [FamilyMembershipType])
  memberships(@Parent() user: UserType): FamilyMembershipType[] {
    return user.memberships ?? [];
  }

  @Query(() => String, { nullable: true })
  @UseGuards(GqlAuthGuard)
  async getUserPublicKey(
    @Args('email') email: string,
  ): Promise<string | null> {
    return this.authService.getUserPublicKey(email);
  }

  @ResolveField(() => UserPreferencesType, { nullable: true })
  preferences(@Parent() user: UserType): UserPreferencesType | null {
    const rawPreferences = (user as any).preferences;
    if (!rawPreferences || typeof rawPreferences !== 'object') {
      return null;
    }

    const { preferredLanguage } = rawPreferences as Record<string, unknown>;

    return {
      preferredLanguage:
        typeof preferredLanguage === 'string' ? preferredLanguage : null,
    };
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard)
  async logout(): Promise<boolean> {
    return true;
  }

  @Mutation(() => UserType)
  @UseGuards(GqlAuthGuard)
  async updateUserPreferences(
    @CurrentUser() user: User,
    @Args('input') input: UpdateUserPreferencesInput,
  ): Promise<UserType> {
    const currentPreferences = (user.preferences as Record<string, any>) || {};

    const updatedPreferences = {
      ...currentPreferences,
      ...(input.preferredLanguage !== undefined && {
        preferredLanguage: input.preferredLanguage,
      }),
    };

    await this.prisma.user.update({
      where: { id: user.id },
      data: { preferences: updatedPreferences },
    });

    return (await this.authService.validateUser(user.id)) as UserType;
  }

  @Mutation(() => CreateInviteResponse)
  @UseGuards(GqlAuthGuard)
  async createEncryptedInvite(
    @CurrentUser() user: User,
    @Args('input') input: CreateEncryptedInviteInput,
  ): Promise<CreateInviteResponse> {
    return this.authService.createEncryptedInvite(
      user.id,
      input.familyId,
      input.inviteeEmail,
      input.encryptedFamilyKey,
      input.nonce,
      input.inviteCode,
      new Date(input.expiresAt),
    );
  }

  @Mutation(() => AcceptInviteResponse)
  @UseGuards(GqlAuthGuard)
  async acceptInvite(
    @CurrentUser() user: User,
    @Args('input') input: AcceptInviteInput,
  ): Promise<AcceptInviteResponse> {
    return this.authService.acceptInvite(user.id, input.inviteCode);
  }

  @Mutation(() => CreateInviteResponse)
  @UseGuards(GqlAuthGuard)
  async createPendingInvite(
    @CurrentUser() user: User,
    @Args('input') input: CreatePendingInviteInput,
  ): Promise<CreateInviteResponse> {
    return this.authService.createPendingInvite(
      user.id,
      input.familyId,
      input.inviteeEmail,
    );
  }

  /**
   * Story 1.5: Create email-bound invite
   * Generates secure invite code bound to specific email address
   * Story 1.13: Added inviteeLanguage parameter for email language preference
   */
  @Mutation(() => InviteResponse)
  @UseGuards(GqlAuthGuard)
  async createInvite(
    @CurrentUser() user: User,
    @Args('input') input: CreateInviteInput,
  ): Promise<InviteResponse> {
    return this.authService.createInvite(user.id, input.inviteeEmail, input.inviteeLanguage);
  }

  @Query(() => [InviteType])
  @UseGuards(GqlAuthGuard)
  async getPendingInvites(
    @CurrentUser() user: User,
    @Args('familyId') familyId: string,
  ): Promise<InviteType[]> {
    return this.authService.getPendingInvites(user.id, familyId);
  }

  @Query(() => [InviteType])
  @UseGuards(GqlAuthGuard)
  async getFamilyInvites(
    @CurrentUser() user: User,
    @Args('familyId') familyId: string,
  ): Promise<InviteType[]> {
    return this.authService.getFamilyInvites(user.id, familyId);
  }

  @Mutation(() => GenericResponse)
  @UseGuards(GqlAuthGuard)
  async reportInviteDecryptFailure(
    @CurrentUser() user: User,
    @Args('input') input: ReportInviteDecryptFailureInput,
  ): Promise<GenericResponse> {
    return this.authService.recordInviteDecryptFailure(user.id, input.inviteCode, input.reason);
  }
}
