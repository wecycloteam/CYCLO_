import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLocationDto } from './dto/create-location.dto';

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  create(userId: string, dto: CreateLocationDto) {
    return this.prisma.location.create({
      data: { ownerType: 'user', userId, ...dto },
    });
  }

  listMine(userId: string) {
    return this.prisma.location.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Used by other modules (marketplace) to confirm the current user actually owns the
  // location they're attaching to a listing — never trust a locationId from the client alone.
  async assertOwnedBy(locationId: string, userId: string) {
    const location = await this.prisma.location.findUnique({
      where: { id: locationId },
    });
    if (!location) throw new NotFoundException('Location not found.');
    if (location.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to use this location.',
      );
    }
    return location;
  }
}
