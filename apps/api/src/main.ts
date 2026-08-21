import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
