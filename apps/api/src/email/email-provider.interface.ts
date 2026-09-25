export const EMAIL_PROVIDER = Symbol('EMAIL_PROVIDER');

export interface EmailProvider {
  sendPasswordResetCode(email: string, code: string): Promise<void>;

  // Mirrors SmsProvider.exposesCodeInResponse — a real provider MUST set this to false.
  // AuthService.requestPasswordReset includes the code in its HTTP response when true,
  // which is only ever safe for a stub that doesn't actually deliver the code anywhere.
  readonly exposesCodeInResponse: boolean;
}
