import { Module } from '@nestjs/common';
import { SMS_PROVIDER } from './sms-provider.interface';
import { NextSmsProvider } from './next-sms.provider';

@Module({
  providers: [{ provide: SMS_PROVIDER, useClass: NextSmsProvider }],
  exports: [SMS_PROVIDER],
})
export class SmsModule {}