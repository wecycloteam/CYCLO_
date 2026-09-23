import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory, AbstractHttpAdapter } from '@nestjs/core';
import { AppModule } from './app.module';

// Shared between main.ts (local dev / Render-style long-running server) and serverless.ts
// (Netlify Functions) so the two entry points can't drift on CORS or validation config.
export async function createApp(
  adapter?: AbstractHttpAdapter,
  options?: { bodyParser?: boolean },
): Promise<INestApplication> {
  const app = adapter
    ? await NestFactory.create(AppModule, adapter, options)
    : await NestFactory.create(AppModule, options);

  app.enableCors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:3001', credentials: true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // RolesGuard is applied per-controller via @UseGuards(JwtAuthGuard, RolesGuard), not
  // globally here — a global guard (APP_GUARD or app.useGlobalGuards()) runs *before*
  // controller-scoped guards in Nest's execution order, so a global RolesGuard would read
  // request.user before JwtAuthGuard has populated it, rejecting every @Roles()-gated
  // route regardless of the caller's actual role (§42 — verified via collection.e2e-spec).

  return app;
}
