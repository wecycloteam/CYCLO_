import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { SubmitPaymentDto } from './dto/submit-payment.dto';
import { PayWithWalletDto } from './dto/pay-with-wallet.dto';

@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  create(@CurrentUser() principal: CurrentUserPayload, @Body() dto: CreateOrderDto) {
    return this.orders.create(principal.userId, principal.role, dto.listingId, dto.quantityKg);
  }

  @Get('mine')
  listMine(@CurrentUser() principal: CurrentUserPayload) {
    return this.orders.listMine(principal.userId);
  }

  @Patch(':id/submit-payment')
  submitPayment(@CurrentUser() principal: CurrentUserPayload, @Param('id') id: string, @Body() dto: SubmitPaymentDto) {
    return this.orders.submitPayment(principal.userId, id, dto.reference);
  }

  @Patch(':id/pay-with-wallet')
  payWithWallet(@CurrentUser() principal: CurrentUserPayload, @Param('id') id: string, @Body() dto: PayWithWalletDto) {
    return this.orders.payWithWallet(principal.userId, id, dto.password);
  }

  @Patch(':id/confirm-payment')
  confirmPayment(@CurrentUser() principal: CurrentUserPayload, @Param('id') id: string) {
    return this.orders.confirmPayment(principal.userId, id);
  }

  @Patch(':id/cancel')
  cancel(@CurrentUser() principal: CurrentUserPayload, @Param('id') id: string) {
    return this.orders.cancel(principal.userId, id);
  }
}
