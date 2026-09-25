import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const ACTIVITY_DAYS = 7;

@Injectable()
export class PublicStatsService {
  constructor(private readonly prisma: PrismaService) {}

  // Backs the landing page's "Today's value" card (app/page.tsx) — every number here is
  // a real, live aggregate, never a fabricated marketing figure. "Value recovered"
  // combines both transaction pipelines the app has: the older pickup-collection
  // Transaction rows (paymentStatus is always 'PENDING' there — no real payment gateway
  // is wired up, see CollectionService.complete — so a completed, weighed pickup is
  // itself the signal of realized value, same precedent as UsersService.impact) and the
  // newer Order rows, where only PAID orders represent money that's actually changed
  // hands.
  async landingStats() {
    const [materialsListed, transactions, paidOrders, dailyListingCounts] = await Promise.all([
      this.prisma.wasteListing.count(),
      this.prisma.transaction.findMany({ select: { agreedPrice: true } }),
      this.prisma.order.findMany({ where: { paymentStatus: 'PAID' }, select: { agreedPrice: true } }),
      this.recentDailyListingCounts(),
    ]);

    const valueFromTransactions = transactions.reduce((sum, t) => sum + (t.agreedPrice ?? 0), 0);
    const valueFromOrders = paidOrders.reduce((sum, o) => sum + o.agreedPrice, 0);

    return {
      materialsListed,
      valueRecoveredTzs: Math.round(valueFromTransactions + valueFromOrders),
      dailyListingCounts,
    };
  }

  // Real listings-per-day for the last ACTIVITY_DAYS days (oldest first) — replaces what
  // used to be a hardcoded, fake bar-chart shape on the landing page.
  private async recentDailyListingCounts(): Promise<number[]> {
    const since = new Date();
    since.setDate(since.getDate() - (ACTIVITY_DAYS - 1));
    since.setHours(0, 0, 0, 0);

    const listings = await this.prisma.wasteListing.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true },
    });

    const counts = new Array(ACTIVITY_DAYS).fill(0);
    for (const { createdAt } of listings) {
      const dayIndex = Math.floor((createdAt.getTime() - since.getTime()) / (24 * 60 * 60 * 1000));
      if (dayIndex >= 0 && dayIndex < ACTIVITY_DAYS) counts[dayIndex]++;
    }
    return counts;
  }
}
