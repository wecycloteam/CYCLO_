import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PricingService } from './pricing.service';

// §17/§7 — "Waste Prices" must be visible to every authenticated user, not just admins;
// only writing a price is admin-gated (see admin.controller.ts).
@UseGuards(JwtAuthGuard)
@Controller('waste-prices')
export class PricingController {
  constructor(private readonly pricing: PricingService) {}

  @Get()
  list() {
    return this.pricing.list();
  }
}
