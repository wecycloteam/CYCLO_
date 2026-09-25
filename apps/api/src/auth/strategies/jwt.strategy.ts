import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';

export interface JwtPayload {
  sub: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  // The token's own `role` claim is deliberately NOT trusted here — it's frozen at whatever
  // it was when the access token was issued (login, or the last /auth/refresh), so a user
  // who switches between household/collector mode in their profile (UsersController.updateMe)
  // would keep hitting role checks against their OLD role for up to JWT_ACCESS_TTL (15m)
  // until their token happened to refresh — which is exactly what caused "I switched to
  // buyer mode but it still says switch to buyer mode" (Buy Now/Add to Cart both check
  // principal.role). One extra indexed lookup per request is the honest fix: role checks
  // always reflect the database, never a stale claim.
  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, role: true } });
    if (!user) throw new UnauthorizedException('Session expired. Please log in again.');
    return { userId: user.id, role: user.role };
  }
}
