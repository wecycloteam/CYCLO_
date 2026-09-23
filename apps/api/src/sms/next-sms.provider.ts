import { Injectable, Logger } from '@nestjs/common';
import { SmsProvider } from './sms-provider.interface';

// Real SMS delivery via NextSMS (messaging-service.co.tz) — replaces ConsoleSmsProvider
// for anything beyond local dev. See sms-provider.interface.ts: exposesCodeInResponse
// must be false here since this actually delivers the code to the user's phone.
@Injectable()
export class NextSmsProvider implements SmsProvider {
  private readonly logger = new Logger(NextSmsProvider.name);
  readonly exposesCodeInResponse = false;

  async sendOtp(phone: string, code: string): Promise<void> {
    const formattedPhone = this.formatPhoneNumber(phone);
    const message = `Your CYCLO verification code is ${code}. It expires in 5 minutes.`;

    const response = await fetch('https://messaging-service.co.tz/api/sms/v1/text/single', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${process.env.NEXT_SMS_API_TOKEN}`,
      },
      body: JSON.stringify({
        from: process.env.NEXT_SMS_SENDER_ID || 'CYCLO',
        to: formattedPhone,
        text: message,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`NextSMS delivery failed (${response.status}): ${errorText}`);
      throw new Error('Failed to send verification SMS.');
    }
  }

  private formatPhoneNumber(phone: string): string {
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('0')) {
      cleaned = '255' + cleaned.slice(1);
    } else if (!cleaned.startsWith('255')) {
      cleaned = '255' + cleaned;
    }
    return cleaned;
  }
}
