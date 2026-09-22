import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  // A failed initial connect used to throw here and take the entire Nest app down —
  // every route, including ones that don't touch the database (e.g. the Google OAuth
  // redirect step), became unreachable because app.listen() never completed. Logging
  // instead of throwing lets the server boot regardless; any request that actually
  // needs the database still fails normally, with Prisma's real error, the moment it
  // runs a query — nothing about DB-dependent behavior is silently faked.
  async onModuleInit() {
    try {
      await this.$connect();
    } catch (err) {
      this.logger.error(
        `Could not connect to the database at startup — the server will still boot, but any request that touches the database will fail until connectivity is restored. ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
