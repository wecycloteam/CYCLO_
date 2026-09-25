import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { CartService } from './cart.service';
import { CartController } from './cart.controller';

@Module({
  imports: [OrdersModule],
  controllers: [CartController],
  providers: [CartService],
})
export class CartModule {}
