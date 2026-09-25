import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { CartService } from './cart.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

@UseGuards(JwtAuthGuard)
@Controller('cart')
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Get()
  myCart(@CurrentUser() principal: CurrentUserPayload) {
    return this.cart.myCart(principal.userId);
  }

  @Post()
  addItem(@CurrentUser() principal: CurrentUserPayload, @Body() dto: AddCartItemDto) {
    return this.cart.addItem(principal.userId, principal.role, dto.listingId, dto.quantityKg);
  }

  @Patch(':id')
  updateQuantity(@CurrentUser() principal: CurrentUserPayload, @Param('id') id: string, @Body() dto: UpdateCartItemDto) {
    return this.cart.updateQuantity(principal.userId, id, dto.quantityKg);
  }

  @Delete(':id')
  removeItem(@CurrentUser() principal: CurrentUserPayload, @Param('id') id: string) {
    return this.cart.removeItem(principal.userId, id);
  }

  @Post('checkout')
  checkout(@CurrentUser() principal: CurrentUserPayload) {
    return this.cart.checkout(principal.userId, principal.role);
  }
}
