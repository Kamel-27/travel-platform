import { Module } from '@nestjs/common';
import { BookingController } from './booking.controller';
import { BookingService } from './booking.service';
import { WalletModule } from '../wallet/wallet.module';
import { PkfareModule } from '../pkfare/pkfare.module';

@Module({
  imports: [WalletModule, PkfareModule],
  controllers: [BookingController],
  providers: [BookingService],
  exports: [BookingService],
})
export class BookingModule {}
