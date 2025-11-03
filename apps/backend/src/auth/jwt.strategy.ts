import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from './auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        process.env.JWT_SECRET ||
        'dev-jwt-secret-change-in-production-use-openssl-rand-base64-32',
    });
  }

  async validate(payload: any) {
    // payload contains: { sub: userId, familyId: familyId, iat, exp }
    const user = await this.authService.validateUser(payload.sub);
    return user; // This gets attached to request.user
  }
}
