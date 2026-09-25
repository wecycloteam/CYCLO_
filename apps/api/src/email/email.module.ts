import { Module } from '@nestjs/common';
import { EMAIL_PROVIDER } from './email-provider.interface';
import { ConsoleEmailProvider } from './console-email.provider';
import { ResendEmailProvider } from './resend-email.provider';

// Picked at boot, not per-request — RESEND_API_KEY is a static deploy-time config value,
// never something that changes while the process is running. Mirrors SmsModule's shape.
@Module({
  providers: [
    {
      provide: EMAIL_PROVIDER,
      useClass: process.env.RESEND_API_KEY ? ResendEmailProvider : ConsoleEmailProvider,
    },
  ],
  exports: [EMAIL_PROVIDER],
})
export class EmailModule {}
