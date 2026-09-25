import { Injectable, Logger } from '@nestjs/common';
import { EmailProvider } from './email-provider.interface';

/**
 * Development-only stand-in used when RESEND_API_KEY isn't configured. It does not
 * deliver anything — it logs the reset code to the server console so local/dev flows
 * are testable end-to-end. Never used once RESEND_API_KEY is set — see EmailModule.
 */
@Injectable()
export class ConsoleEmailProvider implements EmailProvider {
  private readonly logger = new Logger(ConsoleEmailProvider.name);
  readonly exposesCodeInResponse = true;

  async sendPasswordResetCode(email: string, code: string): Promise<void> {
    this.logger.warn(`[DEV EMAIL STUB] Password reset code for ${email}: ${code} (not actually sent)`);
  }
}
