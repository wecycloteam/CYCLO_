import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AdminAction, ListingStatus, WasteCategory } from '@cyclo/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { assertValidListingTransition } from '../marketplace/domain/listing-state-machine';
import { mapListing } from '../marketplace/marketplace.service';
import { PricingService } from '../pricing/pricing.service';
import { NotificationsService } from '../notifications/notifications.service';

const ACTIVITY_PAGE_SIZE = 20;
// CYCLO's commission on every completed (PAID) marketplace sale.
export const PLATFORM_COMMISSION_RATE = 0.05;
const PENDING_VERIFICATION_STATUSES = ['unverified', 'pending'];

function toCountRecord(
  rows: Array<{
    status?: string;
    verificationStatus?: string;
    role?: string;
    _count: number;
  }>,
) {
  const record: Record<string, number> = {};
  for (const row of rows) {
    const key = row.status ?? row.verificationStatus ?? row.role ?? 'unknown';
    record[key] = row._count;
  }
  return record;
}

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly notifications: NotificationsService,
  ) {}

  async dashboard() {
    const [
      usersByRole,
      usersByVerification,
      collectorsByStatus,
      orgsByStatus,
      listingsByStatus,
      pendingListings,
      pickupsByStatus,
      totalUsers,
      platformFeeAgg,
    ] = await Promise.all([
      this.prisma.user.groupBy({ by: ['role'], _count: true }),
      this.prisma.user.groupBy({ by: ['verificationStatus'], _count: true }),
      this.prisma.collectorProfile.groupBy({
        by: ['verificationStatus'],
        _count: true,
      }),
      this.prisma.organization.groupBy({
        by: ['verificationStatus'],
        _count: true,
      }),
      this.prisma.wasteListing.groupBy({ by: ['status'], _count: true }),
      this.prisma.wasteListing.count({
        where: { status: 'ACTIVE', moderationStatus: 'PENDING' },
      }),
      this.prisma.pickupRequest.groupBy({ by: ['status'], _count: true }),
      this.prisma.user.count(),
      // §17/§26 — platformFee is 0 on every Transaction until a real fee schedule exists
      // (see CollectionService.complete); this sums whatever is actually on record, so it
      // honestly reads TZS 0 today rather than showing a fabricated "profit" figure.
      this.prisma.transaction.aggregate({ _sum: { platformFee: true } }),
    ]);

    const [paidOrdersAgg, recentPaidOrders] = await Promise.all([
      this.prisma.order.aggregate({ where: { paymentStatus: 'PAID' }, _count: true, _sum: { agreedPrice: true } }),
      this.prisma.order.findMany({
        where: { paymentStatus: 'PAID' },
        orderBy: { updatedAt: 'desc' },
        take: 10,
        select: {
          id: true,
          agreedPrice: true,
          quantityKg: true,
          paymentMethod: true,
          updatedAt: true,
          buyer: { select: { name: true } },
          seller: { select: { name: true } },
          listing: { select: { material: { select: { label: true } } } },
        },
      }),
    ]);
    const totalTransactionValueTzs = paidOrdersAgg._sum.agreedPrice ?? 0;

    return {
      totalTransactions: paidOrdersAgg._count,
      totalTransactionValueTzs,
      commissionRate: PLATFORM_COMMISSION_RATE,
      recentTransactions: recentPaidOrders.map((o) => ({
        id: o.id,
        buyerName: o.buyer.name,
        sellerName: o.seller.name,
        materialLabel: o.listing.material.label,
        quantityKg: o.quantityKg,
        amountTzs: o.agreedPrice,
        commissionTzs: Math.round(o.agreedPrice * PLATFORM_COMMISSION_RATE),
        paymentMethod: o.paymentMethod,
        paidAt: o.updatedAt,
      })),
      totalUsers,
      usersByRole: toCountRecord(usersByRole),
      usersByVerificationStatus: toCountRecord(usersByVerification),
      collectorsByVerificationStatus: toCountRecord(collectorsByStatus),
      organizationsByVerificationStatus: toCountRecord(orgsByStatus),
      listingsByStatus: toCountRecord(listingsByStatus),
      pendingListingModerationCount: pendingListings,
      pickupsByStatus: toCountRecord(pickupsByStatus),
      totalPlatformRevenueTzs:
        Math.round(totalTransactionValueTzs * PLATFORM_COMMISSION_RATE) + (platformFeeAgg._sum.platformFee ?? 0),
    };
  }

  async recentActivity() {
    const logs = await this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: ACTIVITY_PAGE_SIZE,
    });
    const actorIds = [
      ...new Set(logs.map((l) => l.actorId).filter((id): id is string => !!id)),
    ];
    const actors = actorIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, name: true },
        })
      : [];
    const actorNames = new Map(actors.map((a) => [a.id, a.name]));

    return logs.map((log) => ({
      ...log,
      actorName: log.actorId
        ? (actorNames.get(log.actorId) ?? 'Unknown admin')
        : null,
    }));
  }

  async pendingUsers() {
    const [pendingAccounts, pendingCollectors, pendingOrganizations] = await Promise.all([
      this.prisma.user.findMany({
        where: { verificationStatus: { in: PENDING_VERIFICATION_STATUSES } },
        select: { id: true, name: true, username: true, phone: true, role: true, verificationStatus: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.collectorProfile.findMany({
        where: { verificationStatus: { in: PENDING_VERIFICATION_STATUSES } },
        include: {
          user: {
            select: { id: true, name: true, username: true, phone: true, createdAt: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.organization.findMany({
        where: { verificationStatus: { in: PENDING_VERIFICATION_STATUSES } },
        include: { owner: { select: { id: true, name: true, username: true, phone: true } } },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    return { pendingAccounts, pendingCollectors, pendingOrganizations };
  }

  async setUserVerification(adminId: string, userId: string, status: string, action: AdminAction, reason?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found.');

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { verificationStatus: status },
      select: { id: true, name: true, phone: true, role: true, verificationStatus: true },
    });
    await this.audit(adminId, action, 'User', userId, reason);
    return updated;
  }

  async setCollectorVerification(
    adminId: string,
    userId: string,
    status: string,
    action: AdminAction,
    reason?: string,
  ) {
    const profile = await this.prisma.collectorProfile.findUnique({
      where: { userId },
    });
    if (!profile) throw new NotFoundException('Collector profile not found.');

    const updated = await this.prisma.collectorProfile.update({
      where: { userId },
      data: { verificationStatus: status },
    });
    await this.audit(adminId, action, 'CollectorProfile', userId, reason);
    return updated;
  }

  async setOrganizationVerification(
    adminId: string,
    orgId: string,
    status: string,
    action: AdminAction,
    reason?: string,
  ) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
    });
    if (!org) throw new NotFoundException('Organization not found.');

    const updated = await this.prisma.organization.update({
      where: { id: orgId },
      data: { verificationStatus: status },
    });
    await this.audit(adminId, action, 'Organization', orgId, reason);
    return updated;
  }

  async pendingListings() {
    const listings = await this.prisma.wasteListing.findMany({
      where: { status: 'ACTIVE', moderationStatus: 'PENDING' },
      include: {
        material: true,
        location: true,
        seller: {
          select: {
            id: true,
            name: true,
            phone: true,
            role: true,
            collectorProfile: { select: { verificationStatus: true } },
            organizationMemberships: {
              select: {
                organization: {
                  select: {
                    id: true,
                    name: true,
                    type: true,
                    verificationStatus: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return listings.map(mapListing);
  }

  async approveListing(adminId: string, id: string) {
    const listing = await this.getPendingListing(id);
    const updated = await this.prisma.wasteListing.update({
      where: { id },
      data: { moderationStatus: 'APPROVED' },
    });
    await this.audit(adminId, 'LISTING_APPROVED', 'WasteListing', id);
    this.notifications.create(
      listing.sellerId,
      'LISTING_APPROVED',
      'Your listing was approved',
      `"${listing.material.label}" has been approved and is now live in the marketplace.`,
      `/marketplace/${id}`,
    );
    return mapListing(updated);
  }

  async rejectListing(adminId: string, id: string, reason?: string) {
    const listing = await this.getPendingListing(id);
    assertValidListingTransition(listing.status as ListingStatus, 'CANCELLED');

    const updated = await this.prisma.wasteListing.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        moderationStatus: 'REJECTED',
        moderationReason: reason,
      },
    });
    await this.audit(adminId, 'LISTING_REJECTED', 'WasteListing', id, reason);
    this.notifications.create(
      listing.sellerId,
      'LISTING_REJECTED',
      'Your listing was rejected',
      reason
        ? `"${listing.material.label}" was rejected: ${reason}`
        : `"${listing.material.label}" was rejected by an admin.`,
      '/marketplace?tab=mine',
    );
    return mapListing(updated);
  }

  // A middle ground between approve and reject — the listing isn't cancelled, it just
  // drops out of the moderation queue (moderationStatus no longer PENDING) until the
  // seller edits it. MarketplaceService.update puts it straight back into the queue on
  // save, so there's no separate "resubmit" action for the seller to remember to press.
  async requestListingChanges(adminId: string, id: string, advice: string) {
    const listing = await this.getPendingListing(id);
    const updated = await this.prisma.wasteListing.update({
      where: { id },
      data: { moderationStatus: 'CHANGES_REQUESTED', moderationReason: advice },
    });
    await this.audit(adminId, 'LISTING_CHANGES_REQUESTED', 'WasteListing', id, advice);
    this.notifications.create(
      listing.sellerId,
      'LISTING_CHANGES_REQUESTED',
      'Changes requested on your listing',
      `An admin asked for changes to "${listing.material.label}": ${advice}`,
      `/marketplace/new?editId=${id}`,
    );
    return mapListing(updated);
  }

  async setPrice(adminId: string, category: WasteCategory, pricePerKg: number) {
    const updated = await this.pricing.upsert(category, pricePerKg);
    await this.audit(adminId, 'PRICE_UPDATED', 'WastePrice', category, `pricePerKg=${pricePerKg}`);
    return updated;
  }

  private async getPendingListing(id: string) {
    const listing = await this.prisma.wasteListing.findUnique({
      where: { id },
      include: { material: true },
    });
    if (!listing) throw new NotFoundException('Listing not found.');
    if (listing.moderationStatus !== 'PENDING') {
      throw new BadRequestException('This listing has already been reviewed.');
    }
    return listing;
  }

  private audit(
    actorId: string,
    action: AdminAction,
    targetType: string,
    targetId: string,
    reason?: string,
  ) {
    return this.prisma.auditLog.create({
      data: {
        actorId,
        action,
        targetType,
        targetId,
        metadata: reason ? JSON.stringify({ reason }) : undefined,
      },
    });
  }
}
