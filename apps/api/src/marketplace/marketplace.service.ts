import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ListingStatus } from '@cyclo/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { LocationsService } from '../locations/locations.service';
import { WasteMaterialsService } from '../waste-materials/waste-materials.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { assertValidListingTransition } from './domain/listing-state-machine';

const BROWSE_PAGE_SIZE = 20;

@Injectable()
export class MarketplaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly locations: LocationsService,
    private readonly materials: WasteMaterialsService,
  ) {}

  async create(sellerId: string, dto: CreateListingDto) {
    await this.materials.assertExists(dto.materialId);
    await this.locations.assertOwnedBy(dto.locationId, sellerId);

    return this.prisma.wasteListing.create({
      data: { sellerId, status: 'DRAFT', ...dto },
    });
  }

  async publish(sellerId: string, id: string) {
    const listing = await this.getOwned(sellerId, id);
    assertValidListingTransition(listing.status as ListingStatus, 'ACTIVE');
    return this.prisma.wasteListing.update({
      where: { id },
      data: { status: 'ACTIVE' },
    });
  }

  async cancel(sellerId: string, id: string) {
    const listing = await this.getOwned(sellerId, id);
    assertValidListingTransition(listing.status as ListingStatus, 'CANCELLED');
    return this.prisma.wasteListing.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }

  listMine(sellerId: string) {
    return this.prisma.wasteListing.findMany({
      where: { sellerId },
      include: { material: true, location: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Public marketplace browse — only ACTIVE listings are discoverable (§15); a seller's
  // own drafts/cancelled/etc. are only visible via listMine/findOne-as-owner.
  browseActive(cursor?: string) {
    return this.prisma.wasteListing.findMany({
      where: { status: 'ACTIVE' },
      include: { material: true, location: true },
      orderBy: { createdAt: 'desc' },
      take: BROWSE_PAGE_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
  }

  // Used by the collection module when a producer requests a pickup against one of their
  // own listings — a pickup can only be opened against a listing that is actually ACTIVE.
  async getActiveOwnedListing(sellerId: string, id: string) {
    const listing = await this.prisma.wasteListing.findUnique({ where: { id } });
    if (!listing) throw new NotFoundException('Listing not found.');
    if (listing.sellerId !== sellerId) {
      throw new ForbiddenException('You do not have permission to use this listing.');
    }
    if (listing.status !== 'ACTIVE') {
      throw new BadRequestException('A pickup can only be requested against an ACTIVE listing.');
    }
    return listing;
  }

  async findOne(requesterId: string, id: string) {
    const listing = await this.prisma.wasteListing.findUnique({
      where: { id },
      include: { material: true, location: true },
    });
    if (!listing) throw new NotFoundException('Listing not found.');

    // DRAFT is only visible to its owner — everything else is at least discoverable
    // in principle once it has left DRAFT (§15).
    if (listing.status === 'DRAFT' && listing.sellerId !== requesterId) {
      throw new NotFoundException('Listing not found.');
    }
    return listing;
  }

  private async getOwned(sellerId: string, id: string) {
    const listing = await this.prisma.wasteListing.findUnique({
      where: { id },
    });
    if (!listing) throw new NotFoundException('Listing not found.');
    if (listing.sellerId !== sellerId) {
      throw new ForbiddenException(
        'You do not have permission to modify this listing.',
      );
    }
    return listing;
  }
}
