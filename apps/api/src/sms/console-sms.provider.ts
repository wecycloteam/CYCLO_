import { Injectable, Logger } from '@nestjs/common';
import { SmsProvider } from './sms-provider.interface';

/**
 * Development-only stand-in for a real SMS gateway. It does not deliver anything —
 * it logs the OTP to the server console so local/dev flows are testable end-to-end.
 * A real provider (e.g. Africa's Talking) must be selected and wired in behind
 * SmsProvider before staging/production use — see CYCLO_IMPLEMENTATION_PLAN.md §8.
 * This must never be used outside development.
 */
@Injectable()
export class ConsoleSmsProvider implements SmsProvider {
  private readonly logger = new Logger(ConsoleSmsProvider.name);
  readonly exposesCodeInResponse = true;

  async sendOtp(phone: string, code: string): Promise<void> {
    this.logger.warn(`[DEV SMS STUB] OTP for ${phone}: ${code} (not actually sent)`);
  }
}
