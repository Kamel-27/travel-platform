import { Module } from '@nestjs/common';
import { PkfareAuthService } from './pkfare-auth.service';
import { PkfareHttpService } from './pkfare-http.service';
import { FlightSearchService } from './flight/flight-search.service';
import { HotelSearchService } from './hotel/hotel-search.service';

@Module({
  providers: [
    PkfareAuthService,
    PkfareHttpService,
    FlightSearchService,
    HotelSearchService,
  ],
  exports: [
    PkfareAuthService,
    PkfareHttpService,
    FlightSearchService,
    HotelSearchService,
  ],
})
export class PkfareModule {}
