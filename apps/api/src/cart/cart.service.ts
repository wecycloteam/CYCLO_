import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';

const CART_ITEM_SELECT = {
  id: true,
  listingId: true,
  quantityKg: true,
  createdAt: true,
  listing: {
    select: {
      id: true,
      status: true,
      photos: true,
      askingPrice: true,
      estimatedWeightKg: true,
      quantityUnit: true,
      material: { select: { label: true } },
      seller: { select: { id: true, name: true } },
    },
  },
} as const;

function mapCartItem<T extends { quantityKg: number; listing: { photos?: string | null; askingPrice: number | null; estimatedWeightKg: number } }>(
  item: T,
) {
  const photos = item.listing.photos ? JSON.parse(item.listing.photos) : [];
  const pricePerUnit = item.listing.askingPrice != null ? item.listing.askingPrice / item.listing.estimatedWeightKg : null;
  const subtotal = pricePerUnit != null ? Math.round(pricePerUnit * item.quantityKg) : null;
  return { ...item, listing: { ...item.listing, photos }, subtotal };
}

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
  ) {}

  async myCart(buyerId: string) {
    const items = await this.prisma.cartItem.findMany({
      where: { buyerId },
      orderBy: { createdAt: 'desc' },
      select: CART_ITEM_SELECT,
    });
    const mapped = items.map(mapCartItem);
    const total = mapped.reduce((sum, i) => sum + (i.subtotal ?? 0), 0);
    return { items: mapped, total };
  }

  async addItem(buyerId: string, buyerRole: string, listingId: string, quantityKg: number) {
    if (buyerRole === 'household') {
      throw new BadRequestException('Switch to buyer mode in your profile to purchase waste.');
    }
    const listing = await this.prisma.wasteListing.findUnique({ where: { id: listingId } });
    if (!listing) throw new NotFoundException('Listing not found.');
    if (listing.sellerId === buyerId) throw new BadRequestException('You cannot buy your own listing.');
    if (listing.status !== 'ACTIVE') throw new BadRequestException('This listing is no longer available.');
    if (quantityKg <= 0 || quantityKg > listing.estimatedWeightKg) {
      throw new BadRequestException(`Quantity must be between 0 and ${listing.estimatedWeightKg} ${listing.quantityUnit} (the listed amount).`);
    }

    await this.prisma.cartItem.upsert({
      where: { buyerId_listingId: { buyerId, listingId } },
      create: { buyerId, listingId, quantityKg },
      update: { quantityKg },
    });
    return this.myCart(buyerId);
  }

  async updateQuantity(buyerId: string, itemId: string, quantityKg: number) {
    const item = await this.getOwnedItem(itemId, buyerId);
    const listing = await this.prisma.wasteListing.findUnique({ where: { id: item.listingId } });
    if (!listing) throw new NotFoundException('Listing not found.');
    if (quantityKg <= 0 || quantityKg > listing.estimatedWeightKg) {
      throw new BadRequestException(`Quantity must be between 0 and ${listing.estimatedWeightKg} ${listing.quantityUnit} (the listed amount).`);
    }
    await this.prisma.cartItem.update({ where: { id: itemId }, data: { quantityKg } });
    return this.myCart(buyerId);
  }

  async removeItem(buyerId: string, itemId: string) {
    await this.getOwnedItem(itemId, buyerId);
    await this.prisma.cartItem.delete({ where: { id: itemId } });
    return this.myCart(buyerId);
  }

  private async getOwnedItem(itemId: string, buyerId: string) {
    const item = await this.prisma.cartItem.findUnique({ where: { id: itemId } });
    if (!item || item.buyerId !== buyerId) throw new NotFoundException('Cart item not found.');
    return item;
  }

  // Creates one Order per cart item (OrdersService.create already validates availability
  // and reserves the listing) — an item that fails (someone else bought it first, price
  // changed, etc.) is reported back and left in the cart rather than silently dropped or
  // aborting the whole checkout.
  async checkout(buyerId: string, buyerRole: string) {
    const items = await this.prisma.cartItem.findMany({ where: { buyerId } });
    if (items.length === 0) throw new BadRequestException('Your cart is empty.');

    const created: Awaited<ReturnType<OrdersService['create']>>[] = [];
    const failed: { listingId: string; message: string }[] = [];

    for (const item of items) {
      try {
        const order = await this.orders.create(buyerId, buyerRole, item.listingId, item.quantityKg);
        created.push(order);
        await this.prisma.cartItem.delete({ where: { id: item.id } });
      } catch (err) {
        failed.push({ listingId: item.listingId, message: err instanceof Error ? err.message : 'Could not purchase this item.' });
      }
    }

    return { orders: created, failed };
  }
}
