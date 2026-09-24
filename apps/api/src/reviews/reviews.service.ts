import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  // Only the collector on a COMPLETED pickup — the closest thing this system has to a
  // "buyer" today (see Transaction.buyerId's still-null Phase 7 comment) — may review the
  // seller, and only once per transaction (Review.transactionId is unique). This is the
  // only path that can ever create a Review, so every rating shown anywhere traces back to
  // a real completed exchange — never seeded or fabricated.
  async create(reviewerId: string, dto: CreateReviewDto) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: dto.transactionId },
      include: { pickupRequest: { select: { status: true } } },
    });
    if (!transaction) throw new NotFoundException('Transaction not found.');
    if (transaction.collectorId !== reviewerId) {
      throw new ForbiddenException('Only the collector on this transaction can leave this review.');
    }
    if (transaction.pickupRequest.status !== 'COMPLETED') {
      throw new BadRequestException('This pickup has not been completed yet.');
    }

    const existing = await this.prisma.review.findUnique({ where: { transactionId: dto.transactionId } });
    if (existing) {
      throw new BadRequestException('You have already reviewed this transaction.');
    }

    return this.prisma.review.create({
      data: {
        transactionId: dto.transactionId,
        reviewerId,
        revieweeId: transaction.sellerId,
        rating: dto.rating,
        comment: dto.comment,
      },
    });
  }

  async forSeller(sellerId: string) {
    const [reviews, agg] = await Promise.all([
      this.prisma.review.findMany({
        where: { revieweeId: sellerId },
        orderBy: { createdAt: 'desc' },
        include: { reviewer: { select: { id: true, name: true } } },
      }),
      this.prisma.review.aggregate({
        where: { revieweeId: sellerId },
        _avg: { rating: true },
        _count: true,
      }),
    ]);

    return {
      average: Math.round((agg._avg.rating ?? 0) * 10) / 10,
      count: agg._count,
      reviews,
    };
  }

  // Drives the "leave a review" prompt on the activity detail page — only shown once a
  // completed transaction has neither been reviewed yet nor belongs to someone else.
  async reviewableTransactions(collectorId: string) {
    const transactions = await this.prisma.transaction.findMany({
      where: {
        collectorId,
        review: null,
        pickupRequest: { status: 'COMPLETED' },
      },
      select: { id: true, reference: true, sellerId: true, seller: { select: { name: true } } },
    });
    return transactions;
  }
}
