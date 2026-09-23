import { Module } from '@nestjs/common';
import { SMS_PROVIDER } from './sms-provider.interface';
import { ConsoleSmsProvider } from './console-sms.provider';

/**
 * Phone/OTP sign-up is no longer part of the primary auth flow (phone+password and
 * Google are) — see AuthService.login/register/loginWithGoogle. NextSmsProvider was
 * disconnected after NextSMS rejected real requests (403 Not Authorized, sender name
 * still pending approval); the /auth/otp/* endpoints and this binding are left in place,
 * dev-only, rather than deleted, in case OTP is revisited later.
 */
@Module({
  providers: [{ provide: SMS_PROVIDER, useClass: ConsoleSmsProvider }],
  exports: [SMS_PROVIDER],
})
export class SmsModule {}
