import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@CurrentUser() principal: CurrentUserPayload, @Body() dto: CreateReviewDto) {
    return this.reviews.create(principal.userId, dto);
  }

  // Public — the same "Verified Seller"-style trust signal shown on marketplace listings,
  // readable without an account like the rest of the browse surface.
  @Get('seller/:sellerId')
  forSeller(@Param('sellerId') sellerId: string) {
    return this.reviews.forSeller(sellerId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('reviewable')
  reviewable(@CurrentUser() principal: CurrentUserPayload) {
    return this.reviews.reviewableTransactions(principal.userId);
  }
}
