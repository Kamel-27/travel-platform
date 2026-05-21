import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { BookingService } from './booking.service';
import { JwtAuthGuard, RolesGuard } from '../common/guards';
import { CurrentUser, Roles } from '../common/decorators';
import { UserRole } from '../../generated/prisma';

@Controller('bookings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @Post('search/flights')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.AGENT)
  async searchFlights(@Body() body: any) {
    return this.bookingService.searchFlights(body);
  }

  @Post('search/hotels')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.AGENT)
  async searchHotels(@Body() body: any) {
    return this.bookingService.searchHotels(body);
  }

  @Post('flight')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.AGENT)
  async createFlightBooking(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') userId: string,
    @Body() body: any, // TODO: replace with proper DTO
  ) {
    return this.bookingService.createFlightBooking(companyId, userId, body);
  }

  @Get()
  async listBookings(
    @CurrentUser('companyId') companyId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.bookingService.listBookings(companyId, page, limit, {
      type: type as any,
      status: status as any,
      search,
    });
  }

  @Get(':id')
  async getBooking(
    @Param('id') id: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.bookingService.getBooking(id, companyId);
  }

  @Post(':id/cancel')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.AGENT)
  async cancelBooking(
    @Param('id') id: string,
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.bookingService.cancelBooking(id, companyId, userId);
  }
}
