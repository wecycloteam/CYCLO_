import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const LIST_PAGE_SIZE = 50;

export type NotificationType =
  | 'LISTING_PENDING'
  | 'LISTING_APPROVED'
  | 'LISTING_REJECTED'
  | 'ORDER_PLACED'
  | 'PAYMENT_SUBMITTED'
  | 'PAYMENT_CONFIRMED_BUYER'
  | 'PAYMENT_CONFIRMED_SELLER';

// The bell icon's real content — one row per user-facing event. Callers across
// marketplace/admin/orders create these inline (best-effort, never inside the same
// $transaction as the event itself) so a notification write failing never blocks the
// actual listing/order/payment action it's describing.
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, type: NotificationType, title: string, body: string, link?: string) {
    try {
      await this.prisma.notification.create({ data: { userId, type, title, body, link } });
    } catch (error) {
      console.error(`Failed to create notification (${type}) for user ${userId}:`, error);
    }
  }

  listMine(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: LIST_PAGE_SIZE,
    });
  }

  unreadCount(userId: string) {
    return this.prisma.notification.count({ where: { userId, read: false } });
  }

  async markRead(userId: string, id: string) {
    await this.prisma.notification.updateMany({ where: { id, userId }, data: { read: true } });
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({ where: { userId, read: false }, data: { read: true } });
  }
}
