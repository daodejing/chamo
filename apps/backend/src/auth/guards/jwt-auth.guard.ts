import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: unknown, user: any, info?: unknown) {
    if (err || !user) {
      throw err || new UnauthorizedException();
    }

    if (!user.emailVerified) {
      throw new ForbiddenException({
        message: 'Email not verified. Please check your inbox.',
        requiresEmailVerification: true,
        email: user.email,
      });
    }

    return user;
  }
}
