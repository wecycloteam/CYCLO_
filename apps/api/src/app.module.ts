import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { LocationsModule } from './locations/locations.module';
import { WasteMaterialsModule } from './waste-materials/waste-materials.module';
import { MarketplaceModule } from './marketplace/marketplace.module';
import { CollectionModule } from './collection/collection.module';
import { AdminModule } from './admin/admin.module';
import { AiModule } from './ai/ai.module';
import { PricingModule } from './pricing/pricing.module';
import { ImpactModule } from './impact/impact.module';
import { ReviewsModule } from './reviews/reviews.module';
import { ChatModule } from './chat/chat.module';
import { OrdersModule } from './orders/orders.module';
import { PublicStatsModule } from './public-stats/public-stats.module';
import { WalletModule } from './wallet/wallet.module';
import { CartModule } from './cart/cart.module';
import { ReportsModule } from './reports/reports.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Baseline abuse protection; the OTP endpoints layer a stricter, per-route
    // limit on top of this (see auth.controller.ts) since they're the most
    // sensitive to brute-forcing (§42).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 30 }]),
    PrismaModule,
    UsersModule,
    AuthModule,
    LocationsModule,
    WasteMaterialsModule,
    MarketplaceModule,
    CollectionModule,
    AdminModule,
    AiModule,
    PricingModule,
    ImpactModule,
    ReviewsModule,
    ChatModule,
    OrdersModule,
    PublicStatsModule,
    WalletModule,
    CartModule,
    ReportsModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
