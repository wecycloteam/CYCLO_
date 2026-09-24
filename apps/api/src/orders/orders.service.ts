import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ListingStatus } from '@cyclo/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { assertValidListingTransition } from '../marketplace/domain/listing-state-machine';

const ORDER_SELECT = {
  id: true,
  listingId: true,
  buyerId: true,
  sellerId: true,
  agreedPrice: true,
  paymentMethod: true,
  paymentReference: true,
  paymentStatus: true,
  createdAt: true,
  updatedAt: true,
  listing: { select: { id: true, photos: true, material: { select: { label: true } } } },
  buyer: { select: { id: true, name: true, phone: true } },
  seller: { select: { id: true, name: true, phone: true } },
} as const;

// Same JSON-encoded-string decode as marketplace.service.ts's mapListing — every read
// path returns a real array, never the raw stored string.
function mapOrder<T extends { listing: { photos?: string | null } }>(order: T) {
  return { ...order, listing: { ...order.listing, photos: order.listing.photos ? JSON.parse(order.listing.photos) : [] } };
}

// §14/§26 — a buyer's in-app purchase confirmation, paid by mobile money and confirmed by
// hand on both sides (no payment gateway exists for this app — see SubmitPaymentDto). This
// reuses the listing's own ACTIVE->RESERVED->SOLD transitions (already defined for the
// collector/pickup flow) so "someone bought this" is the same real state everywhere a
// listing's status is read, not a second parallel concept.
@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(buyerId: string, listingId: string) {
    const listing = await this.prisma.wasteListing.findUnique({ where: { id: listingId } });
    if (!listing) throw new NotFoundException('Listing not found.');
    if (listing.sellerId === buyerId) throw new BadRequestException('You cannot buy your own listing.');
    if (listing.askingPrice == null) throw new BadRequestException('This listing has no asking price set.');
    assertValidListingTransition(listing.status as ListingStatus, 'RESERVED');

    return this.prisma.$transaction(
      async (tx) => {
        const order = await tx.order.create({
          data: {
            listingId,
            buyerId,
            sellerId: listing.sellerId,
            agreedPrice: listing.askingPrice!,
          },
          select: ORDER_SELECT,
        });
        await tx.wasteListing.update({ where: { id: listingId }, data: { status: 'RESERVED' } });
        return mapOrder(order);
      },
      { timeout: 15000 },
    );
  }

  async listMine(userId: string) {
    const orders = await this.prisma.order.findMany({
      where: { OR: [{ buyerId: userId }, { sellerId: userId }] },
      orderBy: { createdAt: 'desc' },
      select: ORDER_SELECT,
    });
    return orders.map(mapOrder);
  }

  private async getOwnedOrder(id: string, userId: string) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Order not found.');
    if (order.buyerId !== userId && order.sellerId !== userId) {
      throw new ForbiddenException('You are not part of this order.');
    }
    return order;
  }

  async submitPayment(buyerId: string, id: string, reference: string) {
    const order = await this.getOwnedOrder(id, buyerId);
    if (order.buyerId !== buyerId) throw new ForbiddenException('Only the buyer can submit a payment reference.');
    if (order.paymentStatus !== 'PENDING') {
      throw new BadRequestException('A payment reference has already been submitted for this order.');
    }
    const updated = await this.prisma.order.update({
      where: { id },
      data: { paymentReference: reference, paymentStatus: 'AWAITING_CONFIRMATION' },
      select: ORDER_SELECT,
    });
    return mapOrder(updated);
  }

  async confirmPayment(sellerId: string, id: string) {
    const order = await this.getOwnedOrder(id, sellerId);
    if (order.sellerId !== sellerId) throw new ForbiddenException('Only the seller can confirm payment receipt.');
    if (order.paymentStatus !== 'AWAITING_CONFIRMATION') {
      throw new BadRequestException('This order has no payment reference awaiting confirmation.');
    }

    return this.prisma.$transaction(
      async (tx) => {
        const updated = await tx.order.update({
          where: { id },
          data: { paymentStatus: 'PAID' },
          select: ORDER_SELECT,
        });
        const listing = await tx.wasteListing.findUnique({ where: { id: order.listingId } });
        if (listing && listing.status === 'RESERVED') {
          assertValidListingTransition('RESERVED', 'SOLD');
          await tx.wasteListing.update({ where: { id: order.listingId }, data: { status: 'SOLD' } });
        }
        return mapOrder(updated);
      },
      { timeout: 15000 },
    );
  }

  async cancel(userId: string, id: string) {
    const order = await this.getOwnedOrder(id, userId);
    if (order.paymentStatus === 'PAID') {
      throw new BadRequestException('A paid order cannot be cancelled here.');
    }

    return this.prisma.$transaction(
      async (tx) => {
        const updated = await tx.order.update({
          where: { id },
          data: { paymentStatus: 'CANCELLED' },
          select: ORDER_SELECT,
        });
        const listing = await tx.wasteListing.findUnique({ where: { id: order.listingId } });
        if (listing && listing.status === 'RESERVED') {
          assertValidListingTransition('RESERVED', 'ACTIVE');
          await tx.wasteListing.update({ where: { id: order.listingId }, data: { status: 'ACTIVE' } });
        }
        return mapOrder(updated);
      },
      { timeout: 15000 },
    );
  }
}
