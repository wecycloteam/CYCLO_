import { Module } from '@nestjs/common';
import { SMS_PROVIDER } from './sms-provider.interface';
import { ConsoleSmsProvider } from './console-sms.provider';

/**
 * Binds SMS_PROVIDER to the dev console stub for now. Swap the useClass here for a
 * real provider once one is selected — nothing outside this module needs to change.
 */
@Module({
  providers: [{ provide: SMS_PROVIDER, useClass: ConsoleSmsProvider }],
  exports: [SMS_PROVIDER],
})
export class SmsModule {}
