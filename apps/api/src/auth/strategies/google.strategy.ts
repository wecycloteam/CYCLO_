import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Strategy, StrategyOptions, VerifyCallback, Profile } from 'passport-google-oauth20';

export interface GoogleProfile {
  email: string;
  name: string;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  // Deliberately config.get(...) with fallbacks, not getOrThrow — this provider is built
  // at app bootstrap (every request in the Netlify Function), so a missing env var here
  // used to throw and take down the *entire* API, not just Google login. An empty
  // clientID/clientSecret still lets the app boot; hitting /auth/google with no real
  // credentials configured just fails at Google's end instead, which is the honest
  // "not configured yet" failure mode rather than a total outage.
  constructor(config: ConfigService) {
    super({
      clientID: config.get<string>('GOOGLE_CLIENT_ID', ''),
      clientSecret: config.get<string>('GOOGLE_CLIENT_SECRET', ''),
      callbackURL: config.get<string>('GOOGLE_CALLBACK_URL', 'http://localhost:3000/auth/google/callback'),
      scope: ['email', 'profile'],
    } satisfies StrategyOptions);
  }

  // Attached to req.user by Passport, same as JwtStrategy.validate — kept to just
  // the two fields AuthService.loginWithGoogle actually needs.
  validate(_accessToken: string, _refreshToken: string, profile: Profile, done: VerifyCallback) {
    const email = profile.emails?.[0]?.value;
    const name = profile.displayName || profile.name?.givenName || 'CYCLO User';
    if (!email) {
      return done(new Error('Google did not share an email address for this account.'));
    }
    const googleProfile: GoogleProfile = { email, name };
    done(null, googleProfile);
  }
}
