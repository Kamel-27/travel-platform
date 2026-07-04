import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { FlightsService } from './flights.service';
import { FlightSearchQueryDto } from './dto/flight-search-query.dto';
import type { NormalizedOffer } from '../duffel/duffel.service';

@Controller('flights')
export class FlightsController {
  constructor(private readonly flightsService: FlightsService) {}

  /**
   * GET /flights/search
   * Search for flight offers based on origin, destination, dates, and passengers.
   * Public endpoint. Standard envelope.
   */
  @Get('search')
  @HttpCode(HttpStatus.OK)
  async search(
    @Query() query: FlightSearchQueryDto,
    @Req() req: Request,
  ): Promise<{ data: NormalizedOffer[]; next_cursor: null }> {
    const clientIp = req.ip ?? null;
    const offers = await this.flightsService.search(query, clientIp);
    return {
      data: offers,
      next_cursor: null,
    };
  }

  /**
   * GET /flights/offers/:offer_id
   * Retrieve a single offer (revalidates with Duffel + retrieves available services).
   * Public endpoint. Standard envelope.
   */
  @Get('offers/:offer_id')
  @HttpCode(HttpStatus.OK)
  async getOffer(
    @Param('offer_id') offerId: string,
  ): Promise<{ data: NormalizedOffer }> {
    const offer = await this.flightsService.fetchOffer(offerId);
    return {
      data: offer,
    };
  }
}
