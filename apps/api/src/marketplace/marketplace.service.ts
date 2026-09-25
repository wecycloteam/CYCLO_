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
import { NotificationsService } from '../notifications/notifications.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { assertValidListingTransition } from './domain/listing-state-machine';

const BROWSE_PAGE_SIZE = 20;

// Minimal, public-safe seller fields for the "Verified Seller" badge (§26) — never phone
// or anything else PII-adjacent; that stays behind the not-yet-built contact-buttons
// increment, which needs its own privacy decision (see CYCLO_IMPLEMENTATION_PLAN.md).
const PUBLIC_SELLER_SELECT = { id: true, name: true, verificationStatus: true, featuredUntil: true } as const;

@Injectable()
export class MarketplaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly locations: LocationsService,
    private readonly materials: WasteMaterialsService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(sellerId: string, sellerRole: string, dto: CreateListingDto) {
    // collector is the "buyer" side of the self-service mode switch (see
    // UsersController.updateMe's SELF_SWITCHABLE_ROLES) — listing waste for sale is a
    // household action. Not enforced for business/recycler/authority/admin, which sit
    // outside that switch.
    if (sellerRole === 'collector') {
      throw new BadRequestException('Switch to seller mode in your profile to list waste for sale.');
    }
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
    const published = await this.findOne(sellerId, id);
    this.notifications.create(
      sellerId,
      'LISTING_PENDING',
      'Listing submitted for review',
      `Your listing "${published.material.label}" is pending admin review before it goes live in the marketplace.`,
      `/marketplace/${id}`,
    );
    return published;
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
    return this.attachSellerRatings(listings.map(mapListing));
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
    // A currently-active "Marketplace Boost" (redeemed with CC — see WalletService) sorts
    // its listing to the top of this page, ahead of the normal recency order. Compared
    // in-memory rather than in the query because "boosted" means boostedUntil > right now,
    // not merely non-null (an expired boost must not out-rank a fresh, unboosted listing).
    const now = Date.now();
    const sorted = [...listings].sort((a, b) => {
      const aBoosted = a.boostedUntil != null && a.boostedUntil.getTime() > now;
      const bBoosted = b.boostedUntil != null && b.boostedUntil.getTime() > now;
      if (aBoosted !== bBoosted) return aBoosted ? -1 : 1;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
    return this.attachSellerRatings(sorted.map(mapListing));
  }

  // Ratings live on the SELLER (real reviews left by the collector/buyer on a completed
  // Transaction — see ReviewsService), not the listing itself, since a listing has no
  // buyer until it's sold. Attached here as { average, count } so the marketplace card/
  // detail view can show real stars without ever fabricating a number — count 0 means
  // "no ratings yet", shown as such, not hidden behind a made-up default.
  private async attachSellerRatings<T extends { seller: { id: string } }>(listings: T[]) {
    const sellerIds = [...new Set(listings.map((l) => l.seller.id))];
    if (sellerIds.length === 0) return listings as (T & { seller: { rating: { average: number; count: number } } })[];

    const grouped = await this.prisma.review.groupBy({
      by: ['revieweeId'],
      where: { revieweeId: { in: sellerIds } },
      _avg: { rating: true },
      _count: true,
    });
    const ratingBySeller = new Map(grouped.map((g) => [g.revieweeId, { average: Math.round((g._avg.rating ?? 0) * 10) / 10, count: g._count }]));

    return listings.map((l) => ({
      ...l,
      seller: { ...l.seller, rating: ratingBySeller.get(l.seller.id) ?? { average: 0, count: 0 } },
    }));
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

  async findOne(requesterId: string | undefined, id: string) {
    const listing = await this.prisma.wasteListing.findUnique({
      where: { id },
      include: { material: true, location: true, seller: { select: PUBLIC_SELLER_SELECT } },
    });
    if (!listing) throw new NotFoundException('Listing not found.');

    // DRAFT, and anything not yet admin-approved, is only visible to its owner —
    // everything else is at least discoverable in principle once it has left DRAFT (§15).
    // An anonymous requester (requesterId undefined, from the public browse path) is
    // never the owner.
    const isOwner = requesterId != null && listing.sellerId === requesterId;
    if (
      !isOwner &&
      (listing.status === 'DRAFT' || listing.moderationStatus !== 'APPROVED')
    ) {
      throw new NotFoundException('Listing not found.');
    }
    const [withRating] = await this.attachSellerRatings([mapListing(listing)]);
    return withRating;
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
