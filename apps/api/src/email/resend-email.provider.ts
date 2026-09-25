import { Injectable, Logger } from '@nestjs/common';
import { EmailProvider } from './email-provider.interface';

// Real email delivery via Resend's HTTP API (resend.com) — no SDK dependency needed,
// this is a single POST. RESEND_FROM_EMAIL must be an address on a domain verified in
// the Resend dashboard, or Resend's shared onboarding@resend.dev sender, which only
// delivers to the account owner's own address until a domain is verified.
@Injectable()
export class ResendEmailProvider implements EmailProvider {
  private readonly logger = new Logger(ResendEmailProvider.name);
  readonly exposesCodeInResponse = false;

  async sendPasswordResetCode(email: string, code: string): Promise<void> {
    const from = process.env.RESEND_FROM_EMAIL || 'CYCLO <onboarding@resend.dev>';

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: 'Your CYCLO password reset code',
        html: `<p>Your CYCLO password reset code is:</p><p style="font-size:28px;font-weight:800;letter-spacing:4px;">${code}</p><p>It expires in 10 minutes. If you didn't request this, you can ignore this email.</p>`,
        text: `Your CYCLO password reset code is ${code}. It expires in 10 minutes. If you didn't request this, you can ignore this email.`,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`Resend delivery failed (${response.status}): ${errorText}`);
      throw new Error('Failed to send the password reset email.');
    }
  }
}
