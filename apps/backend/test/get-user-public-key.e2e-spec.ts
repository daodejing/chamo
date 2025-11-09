import 'reflect-metadata';
import { UnauthorizedException } from '@nestjs/common';
import { AuthResolver } from '../src/auth/auth.resolver';
import { GqlAuthGuard } from '../src/auth/guards/gql-auth.guard';

// NOTE: The sandboxed CI runners block binding/listening on 0.0.0.0, so
// spinning up the GraphQL HTTP server (and issuing supertest POSTs) is not
// feasible here. Instead, we validate guard coverage by inspecting the
// resolver metadata and exercising the guard's Unauthorized branch directly.
const GUARD_METADATA_KEY = '__guards__';

function getGuardMetadata(): unknown[] {
  return (
    Reflect.getMetadata(
      GUARD_METADATA_KEY,
      AuthResolver.prototype.getUserPublicKey,
    ) || []
  ) as unknown[];
}

describe('getUserPublicKey guard protections', () => {
  it('is decorated with GqlAuthGuard to enforce authentication', () => {
    const guards = getGuardMetadata();
    expect(guards.length).toBeGreaterThan(0);
    expect(guards).toEqual(expect.arrayContaining([GqlAuthGuard]));
  });

  it('throws UnauthorizedException when the guard receives no authenticated user', () => {
    const guard = new GqlAuthGuard();
    expect(() => guard.handleRequest(null, null)).toThrow(
      UnauthorizedException,
    );
  });
});
