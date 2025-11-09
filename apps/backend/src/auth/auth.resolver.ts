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
import { JoinFamilyInput } from './dto/join-family.input';
import { JoinFamilyExistingInput } from './dto/join-family-existing.input';
import { SwitchFamilyInput } from './dto/switch-family.input';
import { LoginInput } from './dto/login.input';
import { UpdateUserPreferencesInput } from './dto/update-user-preferences.input';
import { AuthResponse, UserType, EmailVerificationResponse, GenericResponse } from './types/auth-response.type';
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
      input.familyName,
      input.inviteCode,
      input.publicKey,
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
}
