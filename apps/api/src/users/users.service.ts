import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@cyclo/shared-types';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByUsername(username: string) {
    return this.prisma.user.findUnique({ where: { username } });
  }

  findByPhone(phone: string) {
    return this.prisma.user.findUnique({ where: { phone } });
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findByGoogleId(googleId: string) {
    return this.prisma.user.findUnique({ where: { googleId } });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  // A collector account has nothing else to configure up front (vehicle/service-area
  // fields are all optional), so its CollectorProfile is created here, atomically with
  // the User row — otherwise a collector would exist with no verificationStatus at all,
  // and the admin verification queue (§21) would never see them.
  //
  // phone is optional because a Google-only sign-up never provides one (see
  // AuthService.loginWithGoogle) — every other path (OTP, register) still always passes one.
  create(data: {
    phone?: string;
    name: string;
    role: UserRole;
    email?: string;
    passwordHash?: string;
    googleId?: string;
    username?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data });
      if (data.role === 'collector') {
        await tx.collectorProfile.create({ data: { userId: user.id } });
      }
      return user;
    });
  }

  // Links a Google account to a User row that already exists under the same email
  // (e.g. someone who first registered by phone/OTP or email+password now signs in with
  // Google) — so they end up with one account, not two.
  linkGoogleId(userId: string, googleId: string) {
    return this.prisma.user.update({ where: { id: userId }, data: { googleId } });
  }

  // Self-heals accounts created by an earlier version of loginWithGoogle that stuffed a
  // random `google:<hex>` placeholder into User.phone instead of leaving it unset — that
  // garbage value was showing up on the profile page in place of a real phone number.
  // Postgres allows multiple NULLs in a unique column, so this never collides.
  clearLegacyPlaceholderPhone(userId: string) {
    return this.prisma.user.update({ where: { id: userId }, data: { phone: null } });
  }

  // Switching into 'collector' needs a CollectorProfile to exist — the same row
  // UsersService.create makes at signup — otherwise every @Roles('collector') pickup
  // action (accept/weigh/complete, see CollectionController) would 500 on the missing
  // profile the first time this user tries to act as a buyer.
  updateProfile(
    userId: string,
    data: { name?: string; phone?: string; username?: string; avatarUrl?: string; role?: string },
  ) {
    return this.prisma.$transaction(async (tx) => {
      if (data.role === 'collector') {
        await tx.collectorProfile.upsert({
          where: { userId },
          create: { userId },
          update: {},
        });
      }
      return tx.user.update({ where: { id: userId }, data });
    });
  }

  // §13/§34 — home-dashboard impact stats. Only ever derived from real completed
  // Transaction rows (one per completed pickup, see CollectionService.complete) — never a
  // fabricated number. co2AvoidedKg uses a widely-cited rough recycling-vs-landfill factor
  // (~2.5kg CO2e avoided per kg diverted) and is always labeled "estimated" in the UI.
  async impact(userId: string) {
    const CO2_FACTOR_PER_KG = 2.5;
    const [sellerTx, collectorTx] = await Promise.all([
      this.prisma.transaction.findMany({ where: { sellerId: userId }, select: { verifiedWeightKg: true, agreedPrice: true } }),
      this.prisma.transaction.findMany({ where: { collectorId: userId }, select: { verifiedWeightKg: true } }),
    ]);

    const wasteRecycledKg = sellerTx.reduce((sum, t) => sum + t.verifiedWeightKg, 0);
    const estimatedEarnings = sellerTx.reduce((sum, t) => sum + (t.agreedPrice ?? 0), 0);
    const collectedWeightKg = collectorTx.reduce((sum, t) => sum + t.verifiedWeightKg, 0);

    return {
      asSeller: {
        completedCount: sellerTx.length,
        wasteRecycledKg,
        estimatedEarnings,
        co2AvoidedKg: Math.round(wasteRecycledKg * CO2_FACTOR_PER_KG * 10) / 10,
      },
      asCollector: {
        completedCount: collectorTx.length,
        collectedWeightKg,
      },
    };
  }
}
