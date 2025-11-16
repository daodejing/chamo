import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { JwtService } from '@nestjs/jwt';

/**
 * Authentication guard for GraphQL subscriptions that works with both HTTP and WebSocket.
 *
 * For HTTP requests: Extracts JWT from Authorization header
 * For WebSocket subscriptions: Extracts JWT from connectionParams.authorization
 */
@Injectable()
export class GqlSubscriptionAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const gqlContext = GqlExecutionContext.create(context);
    const ctx = gqlContext.getContext();

    let token: string | null = null;

    // For subscriptions, the context comes from the onConnect callback result
    // For queries/mutations, it comes from the HTTP request
    if (ctx.req?.headers?.authorization) {
      // HTTP request (queries/mutations) or WebSocket with formatted headers
      const authHeader = ctx.req.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      throw new UnauthorizedException('No authentication token provided');
    }

    try {
      // Verify and decode the JWT token
      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET,
      });

      // Attach user to context for resolver access
      ctx.user = payload;

      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
