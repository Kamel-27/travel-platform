import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { FlightSearchService } from '../pkfare/flight/flight-search.service';
import { HotelSearchService } from '../pkfare/hotel/hotel-search.service';
import { BookingStatus, BookingType } from '../../generated/prisma';
import * as crypto from 'crypto';

@Injectable()
export class BookingService {
  private readonly logger = new Logger(BookingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly flightService: FlightSearchService,
    private readonly hotelService: HotelSearchService,
  ) {}

  /**
   * Search flights
   */
  async searchFlights(params: any) {
    return this.flightService.search(params);
  }

  /**
   * Search hotels
   */
  async searchHotels(params: any) {
    return this.hotelService.search(params);
  }

  /**
   * Create a flight booking: verify → debit wallet → call PKFARE → issue ticket
   */
  async createFlightBooking(
    companyId: string,
    userId: string,
    params: {
      shoppingResultId: string;
      sessionId: string;
      supplierPrice: number;
      markupAmount: number;
      currency: string;
      passengers: any[];
      contactEmail: string;
      contactPhone: string;
      searchParams: any;
    },
  ) {
    const totalAmount = params.supplierPrice + params.markupAmount;
    const idempotencyKey = crypto.randomUUID();

    // 1. Create booking record as PENDING
    const booking = await this.prisma.booking.create({
      data: {
        companyId,
        userId,
        type: BookingType.FLIGHT,
        status: BookingStatus.PENDING,
        supplierPrice: params.supplierPrice,
        markupAmount: params.markupAmount,
        totalAmount,
        currency: params.currency,
        contactEmail: params.contactEmail,
        contactPhone: params.contactPhone,
        searchParams: params.searchParams,
        passengers: {
          create: params.passengers.map((p) => ({
            type: p.type,
            title: p.title,
            firstName: p.firstName,
            lastName: p.lastName,
            dateOfBirth: new Date(p.dateOfBirth),
            nationality: p.nationality,
            passportNumber: p.passportNumber,
            passportExpiry: p.passportExpiry
              ? new Date(p.passportExpiry)
              : null,
            passportCountry: p.passportCountry,
          })),
        },
      },
      include: { passengers: true },
    });

    await this.logStatusChange(booking.id, null, BookingStatus.PENDING, userId);

    try {
      // 2. Debit wallet
      await this.walletService.debitForBooking(
        companyId,
        booking.id,
        totalAmount,
        params.currency,
        idempotencyKey,
      );

      // 3. Call PKFARE createOrder
      const pkfareResult = await this.flightService.createOrder({
        shoppingResultId: params.shoppingResultId,
        sessionId: params.sessionId,
        passengers: params.passengers,
        contactEmail: params.contactEmail,
        contactPhone: params.contactPhone,
      });

      if (!pkfareResult.success) {
        // Refund wallet on PKFARE failure
        await this.walletService.refundToWallet(
          companyId,
          booking.id,
          totalAmount,
          `${idempotencyKey}_refund`,
        );

        await this.updateBookingStatus(
          booking.id,
          BookingStatus.FAILED,
          userId,
          `PKFARE error: ${pkfareResult.errorMsg}`,
        );

        throw new BadRequestException(
          `Booking failed: ${pkfareResult.errorMsg}`,
        );
      }

      // 4. Update booking with PKFARE data
      const updated = await this.prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: BookingStatus.CONFIRMED,
          pkfareOrderId: pkfareResult.data?.orderId,
          pnr: pkfareResult.data?.pnr,
          pkfareResponse: pkfareResult.raw,
        },
        include: { passengers: true },
      });

      await this.logStatusChange(
        booking.id,
        BookingStatus.PENDING,
        BookingStatus.CONFIRMED,
        userId,
      );

      // 5. Auto-issue ticket (async — could be moved to queue)
      this.issueTicketAsync(booking.id, pkfareResult.data?.orderId, userId);

      return updated;
    } catch (error) {
      if (
        error instanceof BadRequestException &&
        error.message.startsWith('Booking failed')
      ) {
        throw error;
      }

      // Unexpected error — attempt refund
      this.logger.error(
        `Unexpected booking error: ${error.message}`,
        error.stack,
      );
      await this.walletService.refundToWallet(
        companyId,
        booking.id,
        totalAmount,
        `${idempotencyKey}_refund`,
      );

      await this.updateBookingStatus(
        booking.id,
        BookingStatus.FAILED,
        userId,
        `System error: ${error.message}`,
      );

      throw error;
    }
  }

  /**
   * Get booking details
   */
  async getBooking(bookingId: string, companyId: string) {
    return this.prisma.booking.findFirst({
      where: { id: bookingId, companyId },
      include: {
        passengers: true,
        invoice: true,
        statusLogs: { orderBy: { createdAt: 'desc' } },
        walletTransactions: true,
      },
    });
  }

  /**
   * List bookings for a company
   */
  async listBookings(
    companyId: string,
    page = 1,
    limit = 20,
    filters?: {
      type?: BookingType;
      status?: BookingStatus;
      search?: string;
    },
  ) {
    const where: any = { companyId };

    if (filters?.type) where.type = filters.type;
    if (filters?.status) where.status = filters.status;
    if (filters?.search) {
      where.OR = [
        { pnr: { contains: filters.search, mode: 'insensitive' } },
        { pkfareOrderId: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        include: {
          passengers: { select: { firstName: true, lastName: true, type: true } },
          user: { select: { fullName: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.booking.count({ where }),
    ]);

    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Cancel a booking
   */
  async cancelBooking(bookingId: string, companyId: string, userId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, companyId },
    });

    if (!booking) {
      throw new BadRequestException('Booking not found');
    }

    const cancellableStatuses: string[] = [BookingStatus.CONFIRMED, BookingStatus.TICKETED];
    if (!cancellableStatuses.includes(booking.status)) {
      throw new BadRequestException(
        `Cannot cancel booking with status: ${booking.status}`,
      );
    }

    // Call PKFARE cancel
    if (booking.pkfareOrderId) {
      if (booking.type === BookingType.FLIGHT) {
        await this.flightService.cancelOrder(booking.pkfareOrderId);
      } else {
        await this.hotelService.cancelOrder(booking.pkfareOrderId);
      }
    }

    await this.updateBookingStatus(
      bookingId,
      BookingStatus.CANCELLED,
      userId,
      'Cancelled by user',
    );

    // Refund to wallet (may need to apply cancellation penalties)
    const refundAmount = Number(booking.totalAmount); // TODO: subtract penalty
    await this.walletService.refundToWallet(
      companyId,
      bookingId,
      refundAmount,
      `cancel_${bookingId}_${Date.now()}`,
    );

    return { message: 'Booking cancelled and refund processed', refundAmount };
  }

  // ── Private helpers ──

  private async issueTicketAsync(
    bookingId: string,
    pkfareOrderId: string,
    userId: string,
  ) {
    try {
      const result = await this.flightService.issueTicket(pkfareOrderId);

      if (result.success) {
        await this.prisma.booking.update({
          where: { id: bookingId },
          data: { status: BookingStatus.TICKETED },
        });
        await this.logStatusChange(
          bookingId,
          BookingStatus.CONFIRMED,
          BookingStatus.TICKETED,
          userId,
          'E-ticket issued',
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to auto-issue ticket for ${bookingId}: ${error.message}`,
      );
    }
  }

  private async updateBookingStatus(
    bookingId: string,
    status: BookingStatus,
    userId: string,
    note?: string,
  ) {
    await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status },
    });
  }

  private async logStatusChange(
    bookingId: string,
    from: BookingStatus | null,
    to: BookingStatus,
    userId: string,
    note?: string,
  ) {
    await this.prisma.bookingStatusLog.create({
      data: {
        bookingId,
        fromStatus: from,
        toStatus: to,
        note,
        changedBy: userId,
      },
    });
  }
}
