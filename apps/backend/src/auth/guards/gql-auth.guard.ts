import { Injectable, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { JwtAuthGuard } from './jwt-auth.guard';
import { TelemetryService } from '../../telemetry/telemetry.service';

@Injectable()
export class GqlAuthGuard extends JwtAuthGuard {
  constructor(telemetry: TelemetryService) {
    super(telemetry);
  }

  getRequest(context: ExecutionContext) {
    const ctx = GqlExecutionContext.create(context);
    return ctx.getContext().req;
  }
}
