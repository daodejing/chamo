import { Resolver, Mutation, Args, Query } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterInput } from './dto/register.input';
import { JoinFamilyInput } from './dto/join-family.input';
import { LoginInput } from './dto/login.input';
import { AuthResponse, UserType } from './types/auth-response.type';
import { GqlAuthGuard } from './guards/gql-auth.guard';
import { CurrentUser } from './current-user.decorator';
import type { User } from '@prisma/client';

@Resolver()
export class AuthResolver {
  constructor(private authService: AuthService) {}

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

  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard)
  async logout(): Promise<boolean> {
    // In a full implementation, this would invalidate the token
    // For now, client will just delete the token
    return true;
  }
}
