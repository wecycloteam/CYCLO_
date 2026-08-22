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

// Minimal, public-safe seller fields for the "Verified Seller" badge (§26) — never phone
// or anything else PII-adjacent; that stays behind the not-yet-built contact-buttons
// increment, which needs its own privacy decision (see CYCLO_IMPLEMENTATION_PLAN.md).
const PUBLIC_SELLER_SELECT = { id: true, name: true, verificationStatus: true } as const;

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

    const { photos, ...rest } = dto;
    const listing = await this.prisma.wasteListing.create({
      data: { sellerId, status: 'DRAFT', ...rest, photos: photos ? JSON.stringify(photos) : undefined },
    });
    return mapListing(listing);
  }

  async publish(sellerId: string, id: string) {
    const listing = await this.getOwned(sellerId, id);
    assertValidListingTransition(listing.status as ListingStatus, 'ACTIVE');
    await this.prisma.wasteListing.update({ where: { id }, data: { status: 'ACTIVE' } });
    return this.findOne(sellerId, id);
  }

  async cancel(sellerId: string, id: string) {
    const listing = await this.getOwned(sellerId, id);
    assertValidListingTransition(listing.status as ListingStatus, 'CANCELLED');
    await this.prisma.wasteListing.update({ where: { id }, data: { status: 'CANCELLED' } });
    return this.findOne(sellerId, id);
  }

  async listMine(sellerId: string) {
    const listings = await this.prisma.wasteListing.findMany({
      where: { sellerId },
      include: { material: true, location: true, seller: { select: PUBLIC_SELLER_SELECT } },
      orderBy: { createdAt: 'desc' },
    });
    return listings.map(mapListing);
  }

  // Public marketplace browse — only ACTIVE *and admin-approved* listings are
  // discoverable (§15 plus the admin moderation gate); a seller's own drafts/pending/
  // cancelled/etc. are only visible via listMine/findOne-as-owner.
  async browseActive(cursor?: string) {
    const listings = await this.prisma.wasteListing.findMany({
      where: { status: 'ACTIVE', moderationStatus: 'APPROVED' },
      include: { material: true, location: true, seller: { select: PUBLIC_SELLER_SELECT } },
      orderBy: { createdAt: 'desc' },
      take: BROWSE_PAGE_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    return listings.map(mapListing);
  }

  // Used by the collection module when a producer requests a pickup against one of their
  // own listings — a pickup can only be opened against a listing that is actually ACTIVE.
  async getActiveOwnedListing(sellerId: string, id: string) {
    const listing = await this.prisma.wasteListing.findUnique({
      where: { id },
    });
    if (!listing) throw new NotFoundException('Listing not found.');
    if (listing.sellerId !== sellerId) {
      throw new ForbiddenException(
        'You do not have permission to use this listing.',
      );
    }
    if (listing.status !== 'ACTIVE') {
      throw new BadRequestException(
        'A pickup can only be requested against an ACTIVE listing.',
      );
    }
    return listing;
  }

  async findOne(requesterId: string, id: string) {
    const listing = await this.prisma.wasteListing.findUnique({
      where: { id },
      include: { material: true, location: true, seller: { select: PUBLIC_SELLER_SELECT } },
    });
    if (!listing) throw new NotFoundException('Listing not found.');

    // DRAFT, and anything not yet admin-approved, is only visible to its owner —
    // everything else is at least discoverable in principle once it has left DRAFT (§15).
    const isOwner = listing.sellerId === requesterId;
    if (
      !isOwner &&
      (listing.status === 'DRAFT' || listing.moderationStatus !== 'APPROVED')
    ) {
      throw new NotFoundException('Listing not found.');
    }
    return mapListing(listing);
  }

  // Deliberate, narrow privacy decision (flagged as unmade in CYCLO_IMPLEMENTATION_PLAN.md
  // until now): a seller's phone is never in the listing payload itself — it's only
  // returned via this explicit, authenticated, per-click action, and never to the seller's
  // own request (nothing to "contact" on your own listing).
  async contact(requesterId: string, id: string) {
    const listing = await this.findOne(requesterId, id);
    if (listing.sellerId === requesterId) {
      throw new BadRequestException('This is your own listing.');
    }
    const seller = await this.prisma.user.findUnique({
      where: { id: listing.sellerId },
      select: { name: true, phone: true },
    });
    if (!seller) throw new NotFoundException('Seller not found.');
    return seller;
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

// `WasteListing.photos` is stored as a JSON-encoded string (no storage abstraction/blob
// column exists yet — see CYCLO_IMPLEMENTATION_PLAN.md §39 gap); every read path decodes
// it back to an array so the API's actual shape always matches what apps/web expects.
// Exported so admin.service.ts's approve/reject (which touch WasteListing directly) stay
// consistent with every other WasteListing read path instead of leaking the raw string.
export function mapListing<T extends { photos?: string | null }>(listing: T): T & { photos: string[] } {
  return { ...listing, photos: listing.photos ? JSON.parse(listing.photos) : [] };
}
