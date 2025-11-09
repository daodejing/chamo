import { Injectable, Logger } from '@nestjs/common';

type UnverifiedSource = 'login' | 'guard';

@Injectable()
export class TelemetryService {
  private readonly logger = new Logger('Telemetry');

  recordUnverifiedLogin(email: string, source: UnverifiedSource) {
    this.logger.warn(
      JSON.stringify({
        event: 'unverified_login_blocked',
        email,
        source,
        timestamp: new Date().toISOString(),
      }),
    );
  }

  recordInviteDecryptFailure(userId: string, inviteCode: string, reason: string) {
    this.logger.error(
      JSON.stringify({
        event: 'invite_decrypt_failure',
        userId,
        inviteCode,
        reason,
        timestamp: new Date().toISOString(),
      }),
    );
  }
}
