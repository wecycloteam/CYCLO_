import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes, randomInt, createHash } from 'crypto';
import type { GoogleProfile } from './strategies/google.strategy';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { SMS_PROVIDER } from '../sms/sms-provider.interface';
import type { SmsProvider } from '../sms/sms-provider.interface';
import { EMAIL_PROVIDER } from '../email/email-provider.interface';
import type { EmailProvider } from '../email/email-provider.interface';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

const OTP_TTL_MINUTES = 5;
const OTP_LENGTH = 6;
const MAX_OTP_ATTEMPTS = 5;

const RESET_CODE_TTL_MINUTES = 10;
const RESET_CODE_LENGTH = 6;
const MAX_RESET_ATTEMPTS = 5;

function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @Inject(SMS_PROVIDER) private readonly sms: SmsProvider,
    @Inject(EMAIL_PROVIDER) private readonly email: EmailProvider,
  ) {}

  async requestOtp(phone: string) {
    const code = randomInt(0, 10 ** OTP_LENGTH).toString().padStart(OTP_LENGTH, '0');
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    await this.prisma.otpChallenge.create({ data: { phone, codeHash, expiresAt } });
    await this.sms.sendOtp(phone, code);

    return {
      message: 'Verification code sent.',
      expiresInSeconds: OTP_TTL_MINUTES * 60,
      // Only ever set when the bound provider is a non-delivering dev stub (see
      // SmsProvider.exposesCodeInResponse) — never present once a real provider is wired in.
      devCode: this.sms.exposesCodeInResponse ? code : undefined,
    };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const challenge = await this.prisma.otpChallenge.findFirst({
      where: { phone: dto.phone, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!challenge) {
      throw new BadRequestException('No active verification code for this number. Request a new one.');
    }

    if (challenge.attemptCount >= MAX_OTP_ATTEMPTS) {
      await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { consumedAt: new Date() },
      });
      throw new BadRequestException('Too many incorrect attempts. Request a new code.');
    }

    const matches = await bcrypt.compare(dto.code, challenge.codeHash);
    if (!matches) {
      await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { attemptCount: { increment: 1 } },
      });
      throw new BadRequestException('Incorrect verification code.');
    }

    await this.prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });

    let user = await this.users.findByPhone(dto.phone);
    if (!user) {
      user = await this.users.create({
        phone: dto.phone,
        name: dto.name?.trim() || 'CYCLO User',
        role: dto.role ?? 'household',
      });
    }

    return this.issueTokens(user.id, user.role);
  }

  // Username+password is the primary credential-based signup path (alongside Google) —
  // phone is still collected (contact info for pickup/marketplace) but no longer used to
  // log in; email is optional, kept only because Google sign-in links accounts by it.
  async register(dto: RegisterDto) {
    const [existingUsername, existingEmail, existingPhone] = await Promise.all([
      this.users.findByUsername(dto.username),
      dto.email ? this.users.findByEmail(dto.email) : null,
      this.users.findByPhone(dto.phone),
    ]);
    if (existingUsername) {
      throw new BadRequestException('That username is already taken.');
    }
    if (existingEmail) {
      throw new BadRequestException('An account with this email already exists.');
    }
    if (existingPhone) {
      throw new BadRequestException('An account with this phone number already exists.');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.users.create({
      username: dto.username,
      phone: dto.phone,
      name: dto.name.trim(),
      role: dto.role ?? 'household',
      email: dto.email,
      passwordHash,
    });

    return this.issueTokens(user.id, user.role);
  }

  async login(dto: LoginDto) {
    const user = await this.users.findByUsername(dto.username);
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Incorrect username or password.');
    }

    const matches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Incorrect username or password.');
    }

    return this.issueTokens(user.id, user.role);
  }

  // googleId is the real identity for a Google sign-in (Google's stable OAuth "sub"), not
  // a phone placeholder — User.phone stays genuinely optional for these accounts. Google
  // never gives us a phone at all, so the account works immediately for browsing/buying;
  // selling still needs a real phone, which isn't collectible from Google alone and has
  // no "add your phone" flow yet.
  async loginWithGoogle(profile: GoogleProfile) {
    let user = await this.users.findByGoogleId(profile.googleId);
    if (user?.phone?.startsWith('google:')) {
      // Self-heals accounts created by an earlier, buggy version of this method that
      // stuffed a random placeholder into User.phone instead of leaving it unset — that
      // garbage value was showing up on the profile page in place of a real phone number.
      user = await this.users.clearLegacyPlaceholderPhone(user.id);
    }
    if (!user) {
      // Someone who already has an account under this email (phone/OTP or email+password)
      // signing in with Google for the first time — link it instead of creating a duplicate.
      const existingByEmail = await this.users.findByEmail(profile.email);
      if (existingByEmail) {
        user = await this.users.linkGoogleId(existingByEmail.id, profile.googleId);
        if (user.phone?.startsWith('google:')) {
          user = await this.users.clearLegacyPlaceholderPhone(user.id);
        }
      } else {
        user = await this.users.create({
          name: profile.name,
          role: 'household',
          email: profile.email,
          googleId: profile.googleId,
        });
      }
    }
    return this.issueTokens(user.id, user.role);
  }

  async refresh(refreshToken: string) {
    const tokenHash = hashRefreshToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Session expired. Please log in again.');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const user = await this.users.findById(stored.userId);
    if (!user) {
      throw new UnauthorizedException('Session expired. Please log in again.');
    }

    return this.issueTokens(user.id, user.role);
  }

  // Deliberately does NOT reveal whether the email has an account — always returns the
  // same message either way, and only actually creates a challenge/sends an email when a
  // matching, password-capable account exists. Otherwise this endpoint would let anyone
  // enumerate which emails are registered on CYCLO just by watching the response differ.
  async requestPasswordReset(dto: RequestPasswordResetDto) {
    const user = await this.users.findByEmail(dto.email);
    const genericResponse = {
      message: 'If an account exists for that email, a verification code has been sent.',
      expiresInSeconds: RESET_CODE_TTL_MINUTES * 60,
    };

    if (!user) return genericResponse;

    const code = randomInt(0, 10 ** RESET_CODE_LENGTH).toString().padStart(RESET_CODE_LENGTH, '0');
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + RESET_CODE_TTL_MINUTES * 60 * 1000);

    await this.prisma.passwordResetChallenge.create({ data: { email: dto.email, codeHash, expiresAt } });
    await this.email.sendPasswordResetCode(dto.email, code);

    return {
      ...genericResponse,
      // Same shape as requestOtp's devCode — only present for the console dev stub that
      // doesn't actually deliver anything, never once a real EmailProvider is wired in.
      devCode: this.email.exposesCodeInResponse ? code : undefined,
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const challenge = await this.prisma.passwordResetChallenge.findFirst({
      where: { email: dto.email, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!challenge) {
      throw new BadRequestException('No active reset code for this email. Request a new one.');
    }

    if (challenge.attemptCount >= MAX_RESET_ATTEMPTS) {
      await this.prisma.passwordResetChallenge.update({
        where: { id: challenge.id },
        data: { consumedAt: new Date() },
      });
      throw new BadRequestException('Too many incorrect attempts. Request a new code.');
    }

    const matches = await bcrypt.compare(dto.code, challenge.codeHash);
    if (!matches) {
      await this.prisma.passwordResetChallenge.update({
        where: { id: challenge.id },
        data: { attemptCount: { increment: 1 } },
      });
      throw new BadRequestException('Incorrect verification code.');
    }

    const user = await this.users.findByEmail(dto.email);
    if (!user) {
      // The challenge existed (requestPasswordReset only creates one for a real account),
      // so this would mean the account was deleted in between — genuinely exceptional.
      throw new BadRequestException('No account found for this email.');
    }

    await this.prisma.passwordResetChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

    return { message: 'Password reset. You can now log in with your new password.' };
  }

  // The current password can't be shown back to the user (only its hash is ever stored),
  // so this is the only way to change it: prove you know the old one (if one exists —
  // a Google-only account has none yet) and supply a new one, which gets re-hashed here.
  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Session expired. Please log in again.');
    }

    if (user.passwordHash) {
      if (!dto.currentPassword) {
        throw new BadRequestException('Enter your current password.');
      }
      const matches = await bcrypt.compare(dto.currentPassword, user.passwordHash);
      if (!matches) {
        throw new BadRequestException('Current password is incorrect.');
      }
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    return { message: 'Password updated.' };
  }

  async logout(refreshToken: string) {
    const tokenHash = hashRefreshToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { message: 'Logged out.' };
  }

  private async issueTokens(userId: string, role: string) {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, role },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get<string>('JWT_ACCESS_TTL', '15m') as `${number}${'s' | 'm' | 'h' | 'd'}`,
      },
    );

    const refreshTtlDays = Number(this.config.get<string>('JWT_REFRESH_TTL_DAYS', '30'));
    const refreshToken = randomBytes(48).toString('hex');
    const expiresAt = new Date(Date.now() + refreshTtlDays * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: { userId, tokenHash: hashRefreshToken(refreshToken), expiresAt },
    });

    return { accessToken, refreshToken };
  }
}
