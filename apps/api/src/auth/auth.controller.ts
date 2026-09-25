import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { CurrentUserPayload } from './decorators/current-user.decorator';
import type { GoogleProfile } from './strategies/google.strategy';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  // Kicks off the Google OAuth redirect; GoogleAuthGuard does the actual redirecting
  // (via Passport) before this handler body would ever run.
  @UseGuards(GoogleAuthGuard)
  @Get('google')
  googleAuth() {}

  // Google redirects back here. GoogleAuthGuard has already run the strategy and
  // attached the profile to req.user; we exchange it for real app tokens and hand
  // the browser back to the frontend with them in the URL (§ same shape the
  // phone/email flows use, just delivered via redirect instead of a JSON response).
  @UseGuards(GoogleAuthGuard)
  @Get('google/callback')
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const profile = req.user as GoogleProfile;
    const tokens = await this.auth.loginWithGoogle(profile);

    const redirectPath = typeof req.query.state === 'string' ? req.query.state : '/home';
    const webOrigin = this.config.get<string>('WEB_ORIGIN', 'http://localhost:3001');
    // Always land on one dedicated frontend route rather than tacking tokens onto the
    // final destination directly — that page stores them then client-side-navigates to
    // `redirect`, so arbitrary target pages (including ones with their own query params)
    // never have to know about this handshake.
    const target = new URL('/auth/callback', webOrigin);
    target.searchParams.set('accessToken', tokens.accessToken);
    target.searchParams.set('refreshToken', tokens.refreshToken);
    target.searchParams.set('redirect', redirectPath);

    res.redirect(target.toString());
  }

  // Tighter than the app-wide default — OTP endpoints are the most sensitive
  // to brute-forcing/spamming (§42). Per-challenge attemptCount in
  // AuthService backs this up independent of the caller's IP.
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('otp/request')
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.auth.requestOtp(dto.phone);
  }

  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  // Tighter than the app-wide default — password login is a brute-force target
  // in the same way OTP verification is.
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Post('otp/verify')
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.auth.verifyOtp(dto);
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('logout')
  logout(@Body() dto: RefreshTokenDto) {
    return this.auth.logout(dto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  changePassword(@CurrentUser() principal: CurrentUserPayload, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(principal.userId, dto);
  }
}
