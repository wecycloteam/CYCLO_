import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@cyclo/shared-types';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByPhone(phone: string) {
    return this.prisma.user.findUnique({ where: { phone } });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  // A collector account has nothing else to configure up front (vehicle/service-area
  // fields are all optional), so its CollectorProfile is created here, atomically with
  // the User row — otherwise a collector would exist with no verificationStatus at all,
  // and the admin verification queue (§21) would never see them.
  create(data: { phone: string; name: string; role: UserRole }) {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data });
      if (data.role === 'collector') {
        await tx.collectorProfile.create({ data: { userId: user.id } });
      }
      return user;
    });
  }
}
