/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import {
  Body,
  ConflictException,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import Redis from 'ioredis';

import { REDIS_CLIENT } from '../redis/redis.module';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/user.entity';
import { CreateBookingDto } from './dto/create-booking.dto';
import { SavePassengersDto } from './dto/save-passengers.dto';
import { CancelBookingSelfDto } from './dto/cancel-booking-self.dto';
import { BookingsService } from './services/bookings.service';
import { ErrorCode } from '../common/dto/error-response.dto';

@Controller('bookings')
export class BookingsController {
  constructor(
    private readonly bookingsService: BookingsService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /**
   * POST /bookings (T1 transition)
   * Supports double-click request protection via Idempotency-Key header backed by Redis lock.
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  async createBooking(
    @CurrentUser() user: User,
    @Body() dto: CreateBookingDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<any> {
    if (idempotencyKey) {
      const redisKey = `idempotency_booking:${idempotencyKey}`;
      const existingValue = await this.redis.get(redisKey);

      if (existingValue) {
        if (existingValue === 'locked') {
          throw new ConflictException({
            code: ErrorCode.ILLEGAL_TRANSITION,
            message:
              'A request with this Idempotency-Key is currently in progress.',
          });
        }
        // If it is already resolved (stores booking ID), re-fetch and return booking
        return this.bookingsService.getBookingDetail(user, existingValue);
      }

      // Lock for 120 seconds during processing
      await this.redis.setex(redisKey, 120, 'locked');

      try {
        const result = await this.bookingsService.createBooking(
          user,
          dto.offer_id,
        );
        // Persist completed response idempotency for 24 hours mapping key to booking ID
        await this.redis.setex(redisKey, 86400, result.id);
        return result;
      } catch (err: unknown) {
        // Unlock on failure to allow retry
        await this.redis.del(redisKey);
        throw err;
      }
    }

    return this.bookingsService.createBooking(user, dto.offer_id);
  }

  /**
   * PUT /bookings/:id/passengers (T2 transition)
   * Submits passenger details and locks selection details.
   */
  @Put(':id/passengers')
  @UseGuards(JwtAuthGuard)
  async savePassengers(
    @CurrentUser() user: User,
    @Param('id') bookingId: string,
    @Body() dto: SavePassengersDto,
  ): Promise<any> {
    return this.bookingsService.savePassengers(user, bookingId, dto.passengers);
  }

  /**
   * GET /bookings
   * Cursor-paginated listing of user's bookings.
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  async getBookings(
    @CurrentUser() user: User,
    @Query('limit') limitStr?: string,
    @Query('cursor') cursor?: string,
  ): Promise<any> {
    const limit = limitStr ? parseInt(limitStr, 10) : 10;
    return this.bookingsService.getBookings(user, limit, cursor);
  }

  /**
   * GET /bookings/:id
   * Resolves detailed summary of a single booking.
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getBookingDetail(
    @CurrentUser() user: User,
    @Param('id') bookingId: string,
  ): Promise<any> {
    return this.bookingsService.getBookingDetail(user, bookingId);
  }

  /**
   * GET /bookings/:id/cancellation-quote
   * Read-only cancellation quote (penalty, refundable amount, whether it's
   * auto-approvable or needs technical_admin review).
   */
  @Get(':id/cancellation-quote')
  @UseGuards(JwtAuthGuard)
  async getCancellationQuote(
    @CurrentUser() user: User,
    @Param('id') bookingId: string,
  ): Promise<any> {
    return this.bookingsService.getCancellationQuote(user, bookingId);
  }

  /**
   * POST /bookings/:id/cancel (T7)
   * Customer self-service cancellation. Auto-approvable fares cancel at
   * Duffel and refund immediately; others are routed to technical_admin.
   */
  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard)
  async cancelBooking(
    @CurrentUser() user: User,
    @Param('id') bookingId: string,
    @Body() dto: CancelBookingSelfDto,
  ): Promise<any> {
    return this.bookingsService.cancelBooking(user, bookingId, dto.reason);
  }

  /**
   * GET /bookings/:id/documents
   * E-ticket/document list. `file_url` is always null in Phase 1 (PDF
   * generation + blob storage are still an M4 TODO stub).
   */
  @Get(':id/documents')
  @UseGuards(JwtAuthGuard)
  async getDocuments(
    @CurrentUser() user: User,
    @Param('id') bookingId: string,
  ): Promise<any> {
    return this.bookingsService.getDocuments(user, bookingId);
  }
}
