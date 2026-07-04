import { Module } from '@nestjs/common';
import { DuffelService } from './duffel.service';

@Module({
  providers: [DuffelService],
  exports: [DuffelService],
})
export class DuffelModule {}
