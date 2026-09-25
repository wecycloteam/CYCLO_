import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { WalletService, WALLET_PROVIDERS } from './wallet.service';
import { TopUpDto } from './dto/top-up.dto';

@UseGuards(JwtAuthGuard)
@Controller('wallet')
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @Get('providers')
  providers() {
    return WALLET_PROVIDERS;
  }

  @Get('me')
  myWallet(@CurrentUser() principal: CurrentUserPayload) {
    return this.wallet.myWallet(principal.userId);
  }

  @Post('topup')
  topUp(@CurrentUser() principal: CurrentUserPayload, @Body() dto: TopUpDto) {
    return this.wallet.topUp(principal.userId, dto.provider, dto.amountTzs);
  }

  @Get('perks')
  perks() {
    return this.wallet.listPerks();
  }

  @Post('perks/boost/:listingId')
  redeemBoost(@CurrentUser() principal: CurrentUserPayload, @Param('listingId') listingId: string) {
    return this.wallet.redeemBoost(principal.userId, listingId);
  }

  @Post('perks/featured')
  redeemFeatured(@CurrentUser() principal: CurrentUserPayload) {
    return this.wallet.redeemFeatured(principal.userId);
  }

  @Post('perks/listing-upgrade/:listingId')
  redeemListingUpgrade(@CurrentUser() principal: CurrentUserPayload, @Param('listingId') listingId: string) {
    return this.wallet.redeemListingUpgrade(principal.userId, listingId);
  }
}
