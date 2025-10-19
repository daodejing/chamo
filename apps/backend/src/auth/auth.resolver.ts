import { Resolver, Mutation, Args, Query, ResolveField, Parent } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterInput } from './dto/register.input';
import { JoinFamilyInput } from './dto/join-family.input';
import { LoginInput } from './dto/login.input';
import { AuthResponse, UserType } from './types/auth-response.type';
import { FamilyType } from './types/family.type';
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

  @Mutation(() => AuthResponse)
  async register(@Args('input') input: RegisterInput): Promise<AuthResponse> {
    return this.authService.register(
      input.email,
      input.password,
      input.name,
      input.familyName,
    );
  }

  @Mutation(() => AuthResponse)
  async joinFamily(
    @Args('input') input: JoinFamilyInput,
  ): Promise<AuthResponse> {
    return this.authService.joinFamily(
      input.email,
      input.password,
      input.name,
      input.inviteCode,
    );
  }

  @Mutation(() => AuthResponse)
  async login(@Args('input') input: LoginInput): Promise<AuthResponse> {
    return this.authService.login(input.email, input.password);
  }

  @Query(() => UserType)
  @UseGuards(GqlAuthGuard)
  async me(@CurrentUser() user: User): Promise<UserType> {
    return user as UserType;
  }

  @ResolveField(() => FamilyType, { nullable: true })
  async family(@Parent() user: UserType): Promise<FamilyType | null> {
    return this.prisma.family.findUnique({
      where: { id: user.familyId },
    });
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard)
  async logout(): Promise<boolean> {
    // In a full implementation, this would invalidate the token
    // For now, client will just delete the token
    return true;
  }
}
