import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TelemetryService } from '../../telemetry/telemetry.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly telemetry: TelemetryService) {
    super();
  }

  handleRequest(err: unknown, user: any, info?: unknown) {
    if (err || !user) {
      throw err || new UnauthorizedException();
    }

    if (!user.emailVerified) {
      this.telemetry.recordUnverifiedLogin(user.email, 'guard');
      throw new ForbiddenException({
        message: 'Email not verified. Please check your inbox.',
        requiresEmailVerification: true,
        email: user.email,
      });
    }

    return user;
  }
}
