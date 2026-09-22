import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Runs the same JWT strategy as JwtAuthGuard but never rejects a request that has no
// (or an invalid) token — request.user just stays undefined. Lets a route serve both
// anonymous visitors and logged-in owners (e.g. public listing browse vs. an owner
// checking their own draft) without two separate endpoints.
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = unknown>(_err: unknown, user: TUser): TUser {
    return user;
  }
}
