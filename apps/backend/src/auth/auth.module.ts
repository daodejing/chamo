import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthResolver } from './auth.resolver';
import { JwtStrategy } from './jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';
import { EmailModule } from '../email/email.module';
import { TelemetryService } from '../telemetry/telemetry.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret:
        process.env.JWT_SECRET ||
        'dev-jwt-secret-change-in-production-use-openssl-rand-base64-32',
    }),
    EmailModule,
  ],
  providers: [
    AuthService,
    AuthResolver,
    JwtStrategy,
    PrismaService,
    TelemetryService,
    JwtAuthGuard,
  ],
  exports: [AuthService, JwtStrategy, PassportModule],
})
export class AuthModule {}
