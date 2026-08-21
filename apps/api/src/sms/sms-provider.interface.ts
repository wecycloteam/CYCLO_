export const SMS_PROVIDER = Symbol('SMS_PROVIDER');

export interface SmsProvider {
  sendOtp(phone: string, code: string): Promise<void>;

  // A real provider MUST set this to false — AuthService.requestOtp includes the code
  // in its HTTP response when true, which is only ever safe for a stub that doesn't
  // actually deliver the code anywhere. Required (not optional) so adding a new
  // provider forces a conscious choice here rather than defaulting to leaking codes.
  readonly exposesCodeInResponse: boolean;
}
