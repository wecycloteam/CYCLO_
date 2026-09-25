import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { ListingStatus } from '@cyclo/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PLATFORM_COMMISSION_RATE } from '../admin/admin.service';
import { assertValidListingTransition } from '../marketplace/domain/listing-state-machine';

const ORDER_SELECT = {
  id: true,
  listingId: true,
  buyerId: true,
  sellerId: true,
  quantityKg: true,
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

type OrderWithSelect = {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  quantityKg: number;
  agreedPrice: number;
  paymentMethod: string | null;
  paymentReference: string | null;
  paymentStatus: string;
  createdAt: Date;
  updatedAt: Date;
  listing: { id: string; photos: string | null; material: { label: string } };
  buyer: { id: string; name: string; phone: string | null };
  seller: { id: string; name: string; phone: string | null };
};

// Same JSON-encoded-string decode as marketplace.service.ts's mapListing — every read
// path returns a real array, never the raw stored string.
function mapOrder(order: OrderWithSelect) {
  return { ...order, listing: { ...order.listing, photos: order.listing.photos ? JSON.parse(order.listing.photos) : [] } };
}

type MappedOrder = ReturnType<typeof mapOrder>;

// §14/§26 — a buyer's in-app purchase confirmation, paid by mobile money and confirmed by
// hand on both sides (no payment gateway exists for this app — see SubmitPaymentDto). This
// reuses the listing's own ACTIVE->RESERVED->SOLD transitions (already defined for the
// collector/pickup flow) so "someone bought this" is the same real state everywhere a
// listing's status is read, not a second parallel concept.
@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(buyerId: string, buyerRole: string, listingId: string, quantityKg: number) {
    // household is the "seller" side of the self-service mode switch (see
    // UsersController.updateMe's SELF_SWITCHABLE_ROLES) — buying is a collector action.
    // Not enforced for business/recycler/authority/admin, which sit outside that switch.
    if (buyerRole === 'household') {
      throw new BadRequestException('Switch to buyer mode in your profile to purchase waste.');
    }

    const listing = await this.prisma.wasteListing.findUnique({ where: { id: listingId } });
    if (!listing) throw new NotFoundException('Listing not found.');
    if (listing.sellerId === buyerId) throw new BadRequestException('You cannot buy your own listing.');
    if (listing.askingPrice == null) throw new BadRequestException('This listing has no asking price set.');
    if (quantityKg <= 0 || quantityKg > listing.estimatedWeightKg) {
      throw new BadRequestException(`Quantity must be between 0 and ${listing.estimatedWeightKg} kg (the listed amount).`);
    }
    assertValidListingTransition(listing.status as ListingStatus, 'RESERVED');

    const pricePerKg = listing.askingPrice / listing.estimatedWeightKg;
    const agreedPrice = Math.round(pricePerKg * quantityKg);

    const order = await this.prisma.$transaction(
      async (tx) => {
        const created = await tx.order.create({
          data: {
            listingId,
            buyerId,
            sellerId: listing.sellerId,
            quantityKg,
            agreedPrice,
          },
          select: ORDER_SELECT,
        });
        await tx.wasteListing.update({ where: { id: listingId }, data: { status: 'RESERVED' } });
        return mapOrder(created);
      },
      { timeout: 15000 },
    );
    this.notifications.create(
      order.sellerId,
      'ORDER_PLACED',
      'New order received',
      `${order.buyer.name} wants to buy "${order.listing.material.label}" for TZS ${order.agreedPrice.toLocaleString()}.`,
      `/orders/${order.id}`,
    );
    return order;
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
    const mapped = mapOrder(updated);
    this.notifications.create(
      mapped.sellerId,
      'PAYMENT_SUBMITTED',
      'Payment code submitted',
      `${mapped.buyer.name} submitted a payment code for "${mapped.listing.material.label}". Confirm receipt to complete the sale.`,
      `/orders/${mapped.id}`,
    );
    return mapped;
  }

  async confirmPayment(sellerId: string, id: string) {
    const order = await this.getOwnedOrder(id, sellerId);
    if (order.sellerId !== sellerId) throw new ForbiddenException('Only the seller can confirm payment receipt.');
    if (order.paymentStatus !== 'AWAITING_CONFIRMATION') {
      throw new BadRequestException('This order has no payment reference awaiting confirmation.');
    }

    const updated = await this.prisma.$transaction(
      async (tx) => {
        const result = await tx.order.update({
          where: { id },
          data: { paymentStatus: 'PAID' },
          select: ORDER_SELECT,
        });
        const listing = await tx.wasteListing.findUnique({ where: { id: order.listingId } });
        if (listing && listing.status === 'RESERVED') {
          assertValidListingTransition('RESERVED', 'SOLD');
          await tx.wasteListing.update({ where: { id: order.listingId }, data: { status: 'SOLD' } });
        }
        // Real money already moved directly between buyer and seller by mobile money —
        // only the CC loyalty reward is granted here, never the TZS itself (see
        // WalletService.creditSaleCCOnly for why crediting TZS too would double-count it).
        await this.wallet.creditSaleCCOnly(tx, order.sellerId, order.agreedPrice, id);
        await this.wallet.creditBuyerCC(tx, order.buyerId, order.agreedPrice, id);
        return mapOrder(result);
      },
      { timeout: 15000 },
    );
    this.notifyPaymentConfirmed(updated);
    return updated;
  }

  // A wallet-funded purchase is a real, atomic database transaction CYCLO itself performs
  // (debit buyer, credit seller, mark PAID, all in one $transaction) — fundamentally
  // different from submitPayment/confirmPayment above, which exists because CYCLO can't
  // see real mobile-money transfers and has to trust the seller's own manual confirmation.
  // Here there's nothing to "confirm" after the fact: the password check IS the
  // confirmation step (§ wallet spec item 4), required precisely because there's no
  // second party in the loop to catch a mistaken or unauthorized purchase.
  async payWithWallet(buyerId: string, id: string, password: string) {
    const order = await this.getOwnedOrder(id, buyerId);
    if (order.buyerId !== buyerId) throw new ForbiddenException('Only the buyer can pay for this order.');
    if (order.paymentStatus !== 'PENDING') {
      throw new BadRequestException('This order has already been paid, submitted, or cancelled.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: buyerId } });
    if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Incorrect password.');
    }

    const sufficientBalance = await this.wallet.hasSufficientBalance(buyerId, order.agreedPrice);
    if (!sufficientBalance) {
      throw new BadRequestException('Not enough money in your CYCLO wallet to complete this purchase. Top up and try again.');
    }

    const updated = await this.prisma.$transaction(
      async (tx) => {
        await this.wallet.debitForPurchase(tx, buyerId, order.agreedPrice, id);
        // Seller receives the sale price minus CYCLO's commission.
        await this.wallet.creditSaleEarning(tx, order.sellerId, Math.round(order.agreedPrice * (1 - PLATFORM_COMMISSION_RATE)), id);
        await this.wallet.creditBuyerCC(tx, buyerId, order.agreedPrice, id);

        const result = await tx.order.update({
          where: { id },
          data: { paymentStatus: 'PAID', paymentMethod: 'cyclo_wallet' },
          select: ORDER_SELECT,
        });
        const listing = await tx.wasteListing.findUnique({ where: { id: order.listingId } });
        if (listing && listing.status === 'RESERVED') {
          assertValidListingTransition('RESERVED', 'SOLD');
          await tx.wasteListing.update({ where: { id: order.listingId }, data: { status: 'SOLD' } });
        }
        return mapOrder(result);
      },
      { timeout: 15000 },
    );
    this.notifyPaymentConfirmed(updated);
    return updated;
  }

  private notifyPaymentConfirmed(order: MappedOrder) {
    this.notifications.create(
      order.buyerId,
      'PAYMENT_CONFIRMED_BUYER',
      'Purchase successful',
      `Your purchase of "${order.listing.material.label}" for TZS ${order.agreedPrice.toLocaleString()} is complete.`,
      `/orders/${order.id}`,
    );
    this.notifications.create(
      order.sellerId,
      'PAYMENT_CONFIRMED_SELLER',
      'Sale confirmed',
      `Payment for "${order.listing.material.label}" (TZS ${order.agreedPrice.toLocaleString()}) from ${order.buyer.name} is confirmed.`,
      `/orders/${order.id}`,
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
