import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Round-trips the frontend's intended post-login destination (e.g. /marketplace/new)
// through Google's OAuth `state` param — read back in AuthController.googleCallback —
// so "Sell this material" → Google login → back on the new-listing form still works,
// not just a hardcoded /home.
@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  getAuthenticateOptions(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const redirect = typeof request.query.redirect === 'string' ? request.query.redirect : '/home';
    return { state: redirect };
  }
}
