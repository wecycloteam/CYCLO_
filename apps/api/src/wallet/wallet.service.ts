import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Prisma } from '@prisma/client';

// CC costs and real, functional effects for each seller perk — kept together so the
// price a seller sees and what redeeming it actually changes stay in one place. Only
// perks with a real, visible effect are offered: no "transaction fee discount" exists
// because the app doesn't charge a platform fee on Orders today, so there'd be nothing
// real to discount.
const BOOST_COST_CC = 500;
const BOOST_DAYS = 3;
const FEATURED_COST_CC = 1000;
const FEATURED_DAYS = 7;
const LISTING_UPGRADE_COST_CC = 300;
const LISTING_UPGRADE_EXTRA_DAYS = 14;

// Real Tanzanian mobile money / mobile banking providers — shown with real names/icons on
// the top-up screen. Selecting one and "topping up" does not move any real money yet: see
// the note on the Wallet model in schema.prisma. This list is exactly what a future real
// aggregator integration would need to support, so nothing about the UI has to change when
// that lands — only WalletService.topUp's implementation would.
export const WALLET_PROVIDERS = [
  { id: 'mpesa', label: 'M-Pesa' },
  { id: 'mixx_by_yas', label: 'Mixx by Yas' },
  { id: 'airtel_money', label: 'Airtel Money' },
  { id: 'halopesa', label: 'HaloPesa' },
  { id: 'nmb_mkononi', label: 'NMB Mkononi' },
  { id: 'crdb_simbanking', label: 'CRDB SimBanking' },
  { id: 'nbc_mobile', label: 'NBC Mobile Banking' },
] as const;

const PROVIDER_IDS = WALLET_PROVIDERS.map((p) => p.id) as string[];

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  // Every user has exactly one wallet, created lazily on first touch rather than at
  // registration — most accounts (browsing-only visitors, sellers who never buy) never
  // need one, and this keeps User creation free of a second table write.
  async getOrCreateWallet(userId: string) {
    const existing = await this.prisma.wallet.findUnique({ where: { userId } });
    if (existing) return existing;
    return this.prisma.wallet.create({ data: { userId } });
  }

  async myWallet(userId: string) {
    const wallet = await this.getOrCreateWallet(userId);
    const transactions = await this.prisma.walletTransaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    return { ...wallet, transactions };
  }

  async topUp(userId: string, provider: string, amountTzs: number) {
    if (amountTzs <= 0) throw new BadRequestException('Enter an amount greater than 0.');
    if (!PROVIDER_IDS.includes(provider)) throw new BadRequestException('Unsupported payment provider.');

    const wallet = await this.getOrCreateWallet(userId);
    const providerLabel = WALLET_PROVIDERS.find((p) => p.id === provider)?.label ?? provider;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balanceTzs: { increment: amountTzs } },
      });
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'TOPUP',
          amountTzs,
          provider,
          description: `Top-up via ${providerLabel}`,
        },
      });
      return updated;
    });
  }

  // Used by OrdersService.payWithWallet — both sides of a wallet-funded purchase happen in
  // one Prisma transaction (see caller), so the debit and the seller's credit either both
  // land or neither does.
  async debitForPurchase(tx: Prisma.TransactionClient, userId: string, amountTzs: number, orderId: string) {
    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet || wallet.balanceTzs < amountTzs) {
      throw new BadRequestException('Not enough money in your CYCLO wallet to complete this purchase.');
    }
    await tx.wallet.update({ where: { id: wallet.id }, data: { balanceTzs: { decrement: amountTzs } } });
    await tx.walletTransaction.create({
      data: { walletId: wallet.id, type: 'PURCHASE', amountTzs: -amountTzs, relatedOrderId: orderId, description: 'Marketplace purchase' },
    });
  }

  // 1 CC per TZS 1,000 of a completed sale (minimum 1) — the only CC-earning mechanism in
  // the app today. Modest and simple on purpose: it's a real, transparent reward tied
  // directly to real completed transactions, not an arbitrary number.
  private ccForAmount(amountTzs: number): number {
    return Math.max(1, Math.round(amountTzs / 1000));
  }

  async creditSaleEarning(tx: Prisma.TransactionClient, userId: string, amountTzs: number, orderId: string) {
    const wallet = await tx.wallet.upsert({ where: { userId }, create: { userId }, update: {} });
    const ccEarned = this.ccForAmount(amountTzs);
    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balanceTzs: { increment: amountTzs }, creditsCC: { increment: ccEarned } },
    });
    await tx.walletTransaction.create({
      data: { walletId: wallet.id, type: 'SALE_EARNING', amountTzs, amountCC: ccEarned, relatedOrderId: orderId, description: 'Sale earning' },
    });
  }

  // For an order paid by real off-app mobile money (Order.submitPayment/confirmPayment) —
  // the seller already received real cash directly into their own mobile money account, so
  // crediting the same amount into their CYCLO wallet TZS balance would double-count real
  // money the app never touched. Only the CC loyalty reward (not real currency) is safe to
  // grant here regardless of payment channel.
  async creditSaleCCOnly(tx: Prisma.TransactionClient, userId: string, amountTzs: number, orderId: string) {
    const wallet = await tx.wallet.upsert({ where: { userId }, create: { userId }, update: {} });
    const ccEarned = this.ccForAmount(amountTzs);
    await tx.wallet.update({ where: { id: wallet.id }, data: { creditsCC: { increment: ccEarned } } });
    await tx.walletTransaction.create({
      data: { walletId: wallet.id, type: 'CC_EARNED', amountCC: ccEarned, relatedOrderId: orderId, description: 'Sale reward' },
    });
  }

  // The buyer's side of the same completed transaction earns CC too (spent, not earned,
  // in TZS terms — no balance change beyond the purchase debit already applied).
  async creditBuyerCC(tx: Prisma.TransactionClient, userId: string, amountTzs: number, orderId: string) {
    const wallet = await tx.wallet.upsert({ where: { userId }, create: { userId }, update: {} });
    const ccEarned = this.ccForAmount(amountTzs);
    await tx.wallet.update({ where: { id: wallet.id }, data: { creditsCC: { increment: ccEarned } } });
    await tx.walletTransaction.create({
      data: { walletId: wallet.id, type: 'CC_EARNED', amountCC: ccEarned, relatedOrderId: orderId, description: 'Purchase reward' },
    });
  }

  async hasSufficientBalance(userId: string, amountTzs: number): Promise<boolean> {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    return (wallet?.balanceTzs ?? 0) >= amountTzs;
  }

  async redeemCredits(userId: string, ccAmount: number, purpose: string) {
    if (ccAmount <= 0) throw new BadRequestException('Enter a CC amount greater than 0.');
    const wallet = await this.getOrCreateWallet(userId);
    if (wallet.creditsCC < ccAmount) throw new BadRequestException('Not enough CYCLO Credits.');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.wallet.update({ where: { id: wallet.id }, data: { creditsCC: { decrement: ccAmount } } });
      await tx.walletTransaction.create({
        data: { walletId: wallet.id, type: 'CC_REDEMPTION', amountCC: -ccAmount, description: purpose },
      });
      return updated;
    });
  }

  listPerks() {
    return [
      { id: 'boost', label: 'Marketplace Boost', description: `Push a listing to the top of browse results for ${BOOST_DAYS} days.`, costCC: BOOST_COST_CC, requiresListing: true },
      { id: 'featured', label: 'Featured Seller Placement', description: `Show a Featured badge on your profile and listings for ${FEATURED_DAYS} days.`, costCC: FEATURED_COST_CC, requiresListing: false },
      { id: 'listing_upgrade', label: 'Listing Upgrade', description: `Extend a listing's visibility by ${LISTING_UPGRADE_EXTRA_DAYS} extra days.`, costCC: LISTING_UPGRADE_COST_CC, requiresListing: true },
    ];
  }

  async redeemBoost(userId: string, listingId: string) {
    const listing = await this.prisma.wasteListing.findUnique({ where: { id: listingId } });
    if (!listing) throw new NotFoundException('Listing not found.');
    if (listing.sellerId !== userId) throw new ForbiddenException('You can only boost your own listing.');

    const boostedUntil = new Date(Date.now() + BOOST_DAYS * 24 * 60 * 60 * 1000);
    await this.redeemCredits(userId, BOOST_COST_CC, `Marketplace Boost — ${listing.id}`);
    return this.prisma.wasteListing.update({ where: { id: listingId }, data: { boostedUntil } });
  }

  async redeemFeatured(userId: string) {
    const featuredUntil = new Date(Date.now() + FEATURED_DAYS * 24 * 60 * 60 * 1000);
    await this.redeemCredits(userId, FEATURED_COST_CC, 'Featured Seller Placement');
    return this.prisma.user.update({ where: { id: userId }, data: { featuredUntil } });
  }

  async redeemListingUpgrade(userId: string, listingId: string) {
    const listing = await this.prisma.wasteListing.findUnique({ where: { id: listingId } });
    if (!listing) throw new NotFoundException('Listing not found.');
    if (listing.sellerId !== userId) throw new ForbiddenException('You can only upgrade your own listing.');

    const base = listing.expiresAt && listing.expiresAt > new Date() ? listing.expiresAt : new Date();
    const expiresAt = new Date(base.getTime() + LISTING_UPGRADE_EXTRA_DAYS * 24 * 60 * 60 * 1000);
    await this.redeemCredits(userId, LISTING_UPGRADE_COST_CC, `Listing Upgrade — ${listing.id}`);
    return this.prisma.wasteListing.update({ where: { id: listingId }, data: { expiresAt } });
  }
}
