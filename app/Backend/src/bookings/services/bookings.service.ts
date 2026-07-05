/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';

import { REDIS_CLIENT } from '../../redis/redis.module';
import { DuffelService } from '../../duffel/duffel.service';
import { ErrorCode } from '../../common/dto/error-response.dto';
import { UserRole } from '../../users/user.entity';
import type { JwtPayload } from '../../auth/guards/jwt-auth.guard';
import { Booking, BookingStatus, Supplier } from '../entities/booking.entity';
import { FlightOfferSnapshot } from '../entities/flight-offer-snapshot.entity';
import { Slice } from '../entities/slice.entity';
import { Segment } from '../entities/segment.entity';
import { Passenger, PassengerType } from '../entities/passenger.entity';
import { Document } from '../entities/document.entity';
import { Payment } from '../../payments/entities/payment.entity';
import { MarkupService } from './markup.service';
import { BookingStateMachineService } from './booking-state-machine.service';
import { RefundExecutionService } from './refund-execution.service';
import { TicketPdfService } from './ticket-pdf.service';
import { PassengerInputDto } from '../dto/save-passengers.dto';

interface CancellationConditionPenalty {
  amount?: number;
  currency?: string;
}

interface CancellationConditions {
  refund_before_departure?: {
    allowed?: boolean;
    penalty?: CancellationConditionPenalty;
  };
}

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  // Outbound token bucket sharing key with FlightsService
  private readonly outboundBucketKey = 'duffel_rate_limit:search';
  private readonly outboundBucketCapacity = 100;
  private readonly outboundRefillRatePerMs = 120 / (60 * 1000);

  constructor(
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(FlightOfferSnapshot)
    private readonly snapshotRepo: Repository<FlightOfferSnapshot>,
    @InjectRepository(Passenger)
    private readonly passengerRepo: Repository<Passenger>,
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    private readonly duffelService: DuffelService,
    private readonly markupService: MarkupService,
    private readonly stateMachine: BookingStateMachineService,
    private readonly refundExecutionService: RefundExecutionService,
    private readonly ticketPdfService: TicketPdfService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /**
   * T1: Revalidates offer against Duffel, locks/checks rate limits,
   * calculates markup, and stores Booking (pending) + FlightOfferSnapshot.
   */
  async createBooking(user: JwtPayload, offerId: string): Promise<any> {
    // 1. Check outbound rate limit
    await this.checkOutboundRateLimit();

    // 2. Revalidate offer against Duffel
    const offer = await this.duffelService.fetchOffer(offerId);

    const now = new Date();
    const expiresAt = new Date(offer.expires_at);
    if (expiresAt <= now) {
      throw new HttpException(
        {
          code: ErrorCode.OFFER_EXPIRED,
          message: 'The requested flight offer has expired.',
        },
        HttpStatus.GONE,
      );
    }

    // 3. Calculate markup rule
    const { ruleId, amount: markupAmount } =
      await this.markupService.calculateMarkup(offer.total.amount);
    const totalAmount = offer.total.amount + markupAmount;

    // 4. Save inside a single transaction
    const booking = await this.entityManager.transaction(async (manager) => {
      // A. Create Booking row
      const newBooking = new Booking();
      newBooking.userId = user.sub;
      newBooking.markupRuleId = ruleId;
      newBooking.status = BookingStatus.Pending;
      newBooking.supplier = Supplier.Duffel;
      newBooking.supplierIdempotencyKey = randomUUID();
      newBooking.baseAmount = offer.total.amount;
      newBooking.markupAmount = markupAmount;
      newBooking.totalAmount = totalAmount;
      newBooking.currency = offer.total.currency;

      const savedBooking = await manager.save(Booking, newBooking);

      // B. Create FlightOfferSnapshot row
      const snapshot = new FlightOfferSnapshot();
      snapshot.bookingId = savedBooking.id;
      snapshot.supplier = Supplier.Duffel;
      snapshot.supplierOfferId = offer.offer_id;
      snapshot.expiresAt = expiresAt;
      snapshot.ownerAirlineName = offer.airline.name;
      snapshot.ownerAirlineIata = offer.airline.iata;
      snapshot.totalAmount = offer.total.amount;
      snapshot.taxAmount = 0; // Default to 0 as Duffel doesn't give a top-level tax breakdown
      snapshot.currency = offer.total.currency;
      snapshot.cabinClass = offer.cabin_class;
      snapshot.conditions = offer.conditions as any;
      snapshot.passengerIdentityDocumentsRequired =
        offer.passenger_identity_documents_required;
      snapshot.rawOffer = offer as any;

      const savedSnapshot = await manager.save(FlightOfferSnapshot, snapshot);

      // C. Save Slices & Segments
      for (const sliceVal of offer.slices) {
        const slice = new Slice();
        slice.offerSnapshotId = savedSnapshot.id;
        slice.origin = sliceVal.origin;
        slice.destination = sliceVal.destination;
        slice.duration = sliceVal.duration;
        slice.fareBrandName = null;

        const savedSlice = await manager.save(Slice, slice);

        for (const segmentVal of sliceVal.segments) {
          const segment = new Segment();
          segment.sliceId = savedSlice.id;
          segment.marketingCarrier = segmentVal.marketing_carrier;
          segment.operatingCarrier = segmentVal.operating_carrier;
          segment.flightNumber = segmentVal.flight_number;
          segment.aircraft = null;
          segment.departingAtLocal = new Date(segmentVal.departing_at.local);
          segment.originTimezone = segmentVal.departing_at.timezone;
          segment.arrivingAtLocal = new Date(segmentVal.arriving_at.local);
          segment.destinationTimezone = segmentVal.arriving_at.timezone;
          segment.originTerminal = segmentVal.origin_terminal;
          segment.destinationTerminal = segmentVal.destination_terminal;

          await manager.save(Segment, segment);
        }
      }

      // D. Record initial status history log
      await this.stateMachine.recordInitialHistory(
        manager,
        savedBooking.id,
        user.sub,
      );

      return savedBooking;
    });

    // 5. Construct passenger requirements payload
    const passengerRequirements = {
      passenger_identity_documents_required:
        offer.passenger_identity_documents_required,
      passengers: offer.passengers.map((p) => ({
        supplier_passenger_id: p.id,
        type: p.type,
      })),
    };

    return {
      ...booking,
      passenger_requirements: passengerRequirements,
    };
  }

  /**
   * T2: Submits passenger details, performs constraints check, and marks booking awaiting_payment.
   * Returns a dummy Stripe client secret to fulfill the checkout contract.
   */
  async savePassengers(
    user: JwtPayload,
    bookingId: string,
    passengerInputs: PassengerInputDto[],
  ): Promise<any> {
    return this.entityManager.transaction(async (manager) => {
      // 1. Lock and retrieve Booking
      const booking = await manager
        .getRepository(Booking)
        .createQueryBuilder('booking')
        .setLock('pessimistic_write')
        .where('booking.id = :id', { id: bookingId })
        .getOne();

      if (!booking) {
        throw new NotFoundException({
          code: ErrorCode.NOT_FOUND,
          message: 'Booking not found.',
        });
      }

      if (booking.userId !== user.sub) {
        throw new ForbiddenException({
          code: ErrorCode.FORBIDDEN,
          message: 'Access denied to this booking.',
        });
      }

      if (booking.status !== BookingStatus.Pending) {
        throw new ConflictException({
          code: ErrorCode.ILLEGAL_TRANSITION,
          message: 'Booking is not in pending status.',
        });
      }

      // 2. Fetch snapshot to verify offer expiry and document requirements
      const snapshot = await manager
        .getRepository(FlightOfferSnapshot)
        .findOneBy({ bookingId: booking.id });

      if (!snapshot) {
        throw new NotFoundException({
          code: ErrorCode.NOT_FOUND,
          message: 'Flight offer snapshot not found.',
        });
      }

      const now = new Date();
      if (new Date(snapshot.expiresAt) <= now) {
        // T3: Transition to failed automatically
        await this.stateMachine.transitionTo(
          manager,
          booking.id,
          BookingStatus.Failed,
          user.sub,
          'offer_expired',
        );
        throw new ConflictException({
          code: ErrorCode.OFFER_EXPIRED,
          message: 'The flight offer has expired.',
        });
      }

      // 3. Match inputs size to requirements
      const snapshotPassengers = (snapshot.rawOffer as any)?.passengers || [];

      if (passengerInputs.length !== snapshotPassengers.length) {
        throw new BadRequestException({
          code: ErrorCode.VALIDATION_ERROR,
          message: `Expected ${snapshotPassengers.length} passengers, received ${passengerInputs.length}.`,
        });
      }

      // 4. Validate document requirements
      if (snapshot.passengerIdentityDocumentsRequired) {
        for (let i = 0; i < passengerInputs.length; i++) {
          const doc = passengerInputs[i].document;
          if (
            !doc ||
            !doc.type ||
            !doc.number ||
            !doc.expiry ||
            !doc.nationality
          ) {
            throw new BadRequestException({
              code: ErrorCode.VALIDATION_ERROR,
              message: `Passport/ID document is required for passenger at index ${i}.`,
            });
          }
        }
      }

      // 5. Save adults/children first to retrieve primary keys for infant references
      const indexToEntityMap = new Map<number, Passenger>();

      for (let i = 0; i < passengerInputs.length; i++) {
        const input = passengerInputs[i];
        if (input.type === PassengerType.Infant) {
          continue;
        }

        const passenger = new Passenger();
        passenger.bookingId = booking.id;
        passenger.type = input.type;
        passenger.title = input.title;
        passenger.gender = input.gender;
        passenger.givenName = input.given_name;
        passenger.familyName = input.family_name;
        passenger.dateOfBirth = input.date_of_birth;
        passenger.phoneNumber = input.phone_number;
        passenger.email = input.email;

        if (input.document) {
          passenger.documentType = input.document.type;
          passenger.documentNumber = input.document.number;
          passenger.documentExpiry = input.document.expiry;
          passenger.nationality = input.document.nationality;
        }

        // Match supplier ID by index order
        const supplierPaxId = snapshotPassengers[i]?.id || null;
        passenger.supplierPassengerId = supplierPaxId;

        const savedPax = await manager.save(Passenger, passenger);
        indexToEntityMap.set(i, savedPax);
      }

      // 6. Save infants linked to responsible adults
      for (let i = 0; i < passengerInputs.length; i++) {
        const input = passengerInputs[i];
        if (input.type !== PassengerType.Infant) {
          continue;
        }

        if (
          input.responsible_adult_index === undefined ||
          input.responsible_adult_index === null
        ) {
          throw new BadRequestException({
            code: ErrorCode.VALIDATION_ERROR,
            message: `Infant passenger at index ${i} requires responsible_adult_index.`,
          });
        }

        const adultEntity = indexToEntityMap.get(input.responsible_adult_index);
        if (!adultEntity || adultEntity.type !== PassengerType.Adult) {
          throw new BadRequestException({
            code: ErrorCode.VALIDATION_ERROR,
            message: `Infant passenger at index ${i} references invalid responsible adult at index ${input.responsible_adult_index}.`,
          });
        }

        const passenger = new Passenger();
        passenger.bookingId = booking.id;
        passenger.type = input.type;
        passenger.title = input.title;
        passenger.gender = input.gender;
        passenger.givenName = input.given_name;
        passenger.familyName = input.family_name;
        passenger.dateOfBirth = input.date_of_birth;
        passenger.phoneNumber = input.phone_number;
        passenger.email = input.email;
        passenger.responsibleAdultPassengerId = adultEntity.id;

        if (input.document) {
          passenger.documentType = input.document.type;
          passenger.documentNumber = input.document.number;
          passenger.documentExpiry = input.document.expiry;
          passenger.nationality = input.document.nationality;
        }

        const supplierPaxId = snapshotPassengers[i]?.id || null;
        passenger.supplierPassengerId = supplierPaxId;

        await manager.save(Passenger, passenger);
      }

      // 7. Transition status from pending to awaiting_payment
      const updatedBooking = await this.stateMachine.transitionTo(
        manager,
        booking.id,
        BookingStatus.AwaitingPayment,
        user.sub,
        'Passengers details saved',
      );

      // Return booking details with mock client secret
      return {
        booking_id: updatedBooking.id,
        status: updatedBooking.status,
        client_secret: `pi_mock_${updatedBooking.id.substring(0, 8)}_secret_mocksecret`,
        total_amount: updatedBooking.totalAmount,
        currency: updatedBooking.currency,
      };
    });
  }

  /**
   * Retrieves cursor-paginated list of user's bookings, newest first.
   */
  async getBookings(
    user: JwtPayload,
    limit = 10,
    cursor?: string,
  ): Promise<{ data: Record<string, unknown>[]; next_cursor: string | null }> {
    const queryBuilder = this.bookingRepo
      .createQueryBuilder('booking')
      .leftJoinAndSelect('booking.markupRule', 'markupRule')
      .where('booking.userId = :userId', { userId: user.sub })
      .orderBy('booking.createdAt', 'DESC')
      .addOrderBy('booking.id', 'DESC')
      .take(limit + 1);

    if (cursor) {
      try {
        const decoded = Buffer.from(cursor, 'base64').toString('ascii');
        const [cursorTime, cursorId] = decoded.split('_');
        if (cursorTime && cursorId) {
          queryBuilder.andWhere(
            '(booking.createdAt < :cursorTime OR (booking.createdAt = :cursorTime AND booking.id < :cursorId))',
            { cursorTime: new Date(cursorTime), cursorId },
          );
        }
      } catch {
        this.logger.warn(`Invalid pagination cursor supplied: ${cursor}`);
      }
    }

    const bookings = await queryBuilder.getMany();
    let nextCursor: string | null = null;

    if (bookings.length > limit) {
      bookings.pop();
      const last = bookings[bookings.length - 1];
      nextCursor = Buffer.from(
        `${last.createdAt.toISOString()}_${last.id}`,
      ).toString('base64');
    }

    // Batch-fetch snapshots for all bookings on this page — the API contract
    // (matching getBookingDetail) expects each entry shaped snake_case with
    // its snapshot summary, not the raw camelCase entity.
    const snapshots = bookings.length
      ? await this.snapshotRepo.find({
          where: { bookingId: In(bookings.map((b) => b.id)) },
          relations: { slices: { segments: true } },
        })
      : [];
    const snapshotByBookingId = new Map(
      snapshots.map((s) => [s.bookingId, s]),
    );

    return {
      data: bookings.map((b) => this.mapBookingSummary(b, snapshotByBookingId.get(b.id))),
      next_cursor: nextCursor,
    };
  }

  /**
   * Shared snake_case shape for booking list rows (matches the Booking
   * contract getBookingDetail returns, minus passengers which the list view
   * doesn't need).
   */
  private mapBookingSummary(
    booking: Booking,
    snapshot?: FlightOfferSnapshot,
  ): Record<string, unknown> {
    return {
      id: booking.id,
      status: booking.status,
      supplier: booking.supplier,
      booking_reference: booking.bookingReference,
      total_amount: booking.totalAmount,
      base_amount: booking.baseAmount,
      markup_amount: booking.markupAmount,
      currency: booking.currency,
      schedule_change_detected_at: booking.scheduleChangeDetectedAt,
      created_at: booking.createdAt,
      updated_at: booking.updatedAt,
      snapshot: snapshot
        ? {
            id: snapshot.id,
            supplier_offer_id: snapshot.supplierOfferId,
            expires_at: snapshot.expiresAt,
            owner_airline_name: snapshot.ownerAirlineName,
            owner_airline_iata: snapshot.ownerAirlineIata,
            cabin_class: snapshot.cabinClass,
            conditions: snapshot.conditions,
            slices: snapshot.slices.map((slice) => ({
              id: slice.id,
              origin: slice.origin,
              destination: slice.destination,
              duration: slice.duration,
              segments: slice.segments.map((seg) => ({
                id: seg.id,
                marketing_carrier: seg.marketingCarrier,
                operating_carrier: seg.operatingCarrier,
                flight_number: seg.flightNumber,
                departing_at: {
                  local: seg.departingAtLocal.toISOString().replace('Z', ''),
                  timezone: seg.originTimezone,
                },
                arriving_at: {
                  local: seg.arrivingAtLocal.toISOString().replace('Z', ''),
                  timezone: seg.destinationTimezone,
                },
                origin_terminal: seg.originTerminal,
                destination_terminal: seg.destinationTerminal,
              })),
            })),
          }
        : null,
      passengers: [],
    };
  }

  /**
   * Resolves complete detail of a single booking, verifying ownership/admin rights.
   */
  async getBookingDetail(user: JwtPayload, bookingId: string): Promise<any> {
    const booking = await this.bookingRepo.findOne({
      where: { id: bookingId },
      relations: { markupRule: true },
    });

    if (!booking) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'Booking not found.',
      });
    }

    if (booking.userId !== user.sub && user.role !== UserRole.TechnicalAdmin) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'Access denied to this booking.',
      });
    }

    const snapshot = await this.snapshotRepo.findOne({
      where: { bookingId },
      relations: { slices: { segments: true } },
    });

    const passengers = await this.passengerRepo.find({
      where: { bookingId },
    });

    return {
      ...this.mapBookingSummary(booking, snapshot ?? undefined),
      passengers: passengers.map((p) => ({
        id: p.id,
        supplier_passenger_id: p.supplierPassengerId,
        type: p.type,
        title: p.title,
        gender: p.gender,
        given_name: p.givenName,
        family_name: p.familyName,
        date_of_birth: p.dateOfBirth,
        phone_number: p.phoneNumber,
        email: p.email,
        responsible_adult_passenger_id: p.responsibleAdultPassengerId,
        document: p.documentType
          ? {
              type: p.documentType,
              number: p.documentNumber,
              expiry: p.documentExpiry,
              nationality: p.nationality,
            }
          : null,
      })),
    };
  }

  // ── Cancellation (T7, customer self-service) ───────────────────────

  /**
   * Read-only cancellation quote. Auto-approval rule and refund amount
   * formula per prd.md §5.4 / sequence_diagrams.md §5: auto-approved when
   * the supplier's conditions permit refund; customer always receives the
   * supplier refund plus the full markup (never charged margin on a
   * cancelled service). This is an estimate — the real cancel call
   * recomputes from Duffel's actual response, never trusting this figure.
   */
  async getCancellationQuote(
    user: JwtPayload,
    bookingId: string,
  ): Promise<any> {
    const booking = await this.bookingRepo.findOneBy({ id: bookingId });
    if (!booking) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'Booking not found.',
      });
    }
    if (booking.userId !== user.sub) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'Access denied to this booking.',
      });
    }
    if (booking.status !== BookingStatus.Confirmed) {
      throw new ConflictException({
        code: ErrorCode.ILLEGAL_TRANSITION,
        message: `Only confirmed bookings can be cancelled. Current status: ${booking.status}.`,
      });
    }

    const snapshot = await this.snapshotRepo.findOneBy({
      bookingId: booking.id,
    });
    return this.computeCancellationQuote(booking, snapshot);
  }

  /**
   * T7: Cancels a confirmed booking at the customer's request.
   * Auto-approvable: cancels at Duffel first (external call, never inside a
   * DB transaction), then in one transaction transitions confirmed→cancelled
   * and executes the gateway refund via the shared RefundExecutionService
   * (same logic AdminService uses for manual refunds).
   * Not auto-approvable: records the request for technical_admin review and
   * returns 202-equivalent without touching Duffel or booking state.
   */
  async cancelBooking(
    user: JwtPayload,
    bookingId: string,
    reason?: string,
  ): Promise<any> {
    const booking = await this.bookingRepo.findOneBy({ id: bookingId });
    if (!booking) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'Booking not found.',
      });
    }
    if (booking.userId !== user.sub) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'Access denied to this booking.',
      });
    }
    if (booking.status !== BookingStatus.Confirmed) {
      throw new ConflictException({
        code: ErrorCode.ILLEGAL_TRANSITION,
        message: `Only confirmed bookings can be cancelled. Current status: ${booking.status}.`,
      });
    }

    const snapshot = await this.snapshotRepo.findOneBy({
      bookingId: booking.id,
    });
    const quote = this.computeCancellationQuote(booking, snapshot);

    if (quote.requires_admin) {
      booking.cancellationRequestedAt = new Date();
      booking.cancellationRequestReason = reason ?? null;
      await this.bookingRepo.save(booking);

      this.logger.log(
        `User ${user.sub} requested cancellation of booking ${booking.id} — routed to technical_admin (not auto-approvable).`,
      );

      return {
        id: booking.id,
        status: booking.status,
        requires_admin: true,
        message:
          'Your cancellation request has been sent to our support team for manual review.',
      };
    }

    // Auto-approvable — cancel at the supplier first. If Duffel rejects or
    // is unavailable, the booking must stay confirmed (no state written yet).
    let supplierRefundAmount = 0;
    if (booking.supplierOrderId) {
      const result = await this.duffelService.cancelOrder(
        booking.supplierOrderId,
      );
      supplierRefundAmount = result.refundAmount;
    }

    const payment = await this.paymentRepo.findOneBy({ bookingId: booking.id });
    if (!payment) {
      throw new ConflictException({
        code: ErrorCode.ILLEGAL_TRANSITION,
        message: 'No payment found for this booking; cannot process refund.',
      });
    }

    // Refund policy (prd.md §5.4): customer receives the supplier refund
    // plus the full markup — the platform never keeps margin on a
    // cancelled service.
    const customerReceivesAmount = supplierRefundAmount + booking.markupAmount;
    const cancelReason = reason ?? 'customer_cancel';

    const { refundId } = await this.refundExecutionService.executeGatewayRefund(
      payment.id,
      customerReceivesAmount,
    );

    const { fullyRefunded } = await this.entityManager.transaction(
      async (manager) => {
        await this.stateMachine.transitionTo(
          manager,
          booking.id,
          BookingStatus.Cancelled,
          user.sub,
          cancelReason,
        );

        return this.refundExecutionService.recordRefund(manager, {
          paymentId: payment.id,
          refundId,
          amount: customerReceivesAmount,
          reason: cancelReason,
          initiatedByUserId: user.sub,
        });
      },
    );

    this.logger.log(
      `User ${user.sub} cancelled booking ${booking.id} (customer receives ${customerReceivesAmount} ${booking.currency})`,
    );

    return {
      id: booking.id,
      status: fullyRefunded ? BookingStatus.Refunded : BookingStatus.Cancelled,
      requires_admin: false,
      supplier_refund_amount: supplierRefundAmount,
      customer_receives: {
        amount: customerReceivesAmount,
        currency: booking.currency,
      },
      currency: booking.currency,
    };
  }

  /**
   * GET /bookings/:id/documents — e-ticket/document list. `file_url` stays
   * null here (metadata listing only); the actual PDF is generated on demand
   * by getTicketPdf / GET /bookings/:id/ticket.pdf below.
   */
  async getDocuments(user: JwtPayload, bookingId: string): Promise<any> {
    const booking = await this.bookingRepo.findOneBy({ id: bookingId });
    if (!booking) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'Booking not found.',
      });
    }
    if (booking.userId !== user.sub && user.role !== UserRole.TechnicalAdmin) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'Access denied to this booking.',
      });
    }

    const documents = await this.documentRepo.find({ where: { bookingId } });

    return {
      data: documents.map((d) => ({
        id: d.id,
        // The Document entity has no `source` column yet — every row today
        // comes from Duffel order fulfillment, so this is hardcoded until a
        // `generated` (self-issued) document type exists.
        source: 'supplier',
        type: d.type,
        supplier_document_id: d.uniqueIdentifier,
        file_url: null,
      })),
    };
  }

  /**
   * GET /bookings/:id/ticket.pdf — renders a real itinerary/e-ticket PDF.
   * Only available once the booking is actually confirmed with Duffel.
   */
  async getTicketPdf(user: JwtPayload, bookingId: string): Promise<Buffer> {
    const booking = await this.bookingRepo.findOneBy({ id: bookingId });
    if (!booking) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'Booking not found.',
      });
    }
    if (booking.userId !== user.sub && user.role !== UserRole.TechnicalAdmin) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'Access denied to this booking.',
      });
    }
    if (booking.status !== BookingStatus.Confirmed) {
      throw new ConflictException({
        code: ErrorCode.ILLEGAL_TRANSITION,
        message: `Ticket is only available once the booking is confirmed. Current status: ${booking.status}.`,
      });
    }

    const [snapshot, passengers, documents] = await Promise.all([
      this.snapshotRepo.findOne({
        where: { bookingId },
        relations: { slices: { segments: true } },
      }),
      this.passengerRepo.find({ where: { bookingId } }),
      this.documentRepo.find({ where: { bookingId } }),
    ]);

    return this.ticketPdfService.generate(booking, snapshot, passengers, documents);
  }

  private computeCancellationQuote(
    booking: Booking,
    snapshot: FlightOfferSnapshot | null,
  ): {
    refundable: boolean;
    requires_admin: boolean;
    penalty: { amount: number; currency: string } | null;
    customer_receives: { amount: number; currency: string } | null;
  } {
    const conditions = snapshot?.conditions as
      CancellationConditions | undefined;
    const refundCondition = conditions?.refund_before_departure;
    const allowed = refundCondition?.allowed === true;
    const rawPenalty = refundCondition?.penalty;
    const penalty =
      rawPenalty?.amount !== undefined && rawPenalty?.currency
        ? { amount: rawPenalty.amount, currency: rawPenalty.currency }
        : null;

    // Defensive: a penalty in a different currency than the booking would
    // make the subtraction below meaningless — route to admin instead of
    // guessing at a conversion.
    const currencyMismatch =
      penalty !== null && penalty.currency !== booking.currency;

    if (!allowed || currencyMismatch) {
      return {
        refundable: allowed,
        requires_admin: true,
        penalty,
        customer_receives: null,
      };
    }

    // Estimate only: total_amount already includes the markup, so
    // (total_amount - penalty) is equivalent to (supplier refund + full
    // markup) per prd.md §5.4. The real POST /cancel recomputes from
    // Duffel's actual cancellation response rather than trusting this.
    const estimatedCustomerReceives = Math.max(
      0,
      booking.totalAmount - (penalty?.amount ?? 0),
    );

    return {
      refundable: true,
      requires_admin: false,
      penalty,
      customer_receives: {
        amount: estimatedCustomerReceives,
        currency: booking.currency,
      },
    };
  }

  // ── Outbound Rate Limiting ────────────────────────────────────────

  private async checkOutboundRateLimit(): Promise<void> {
    const data = await this.redis.hmget(
      this.outboundBucketKey,
      'tokens',
      'last_refill',
    );
    const now = Date.now();

    let tokens = data[0] ? parseFloat(data[0]) : this.outboundBucketCapacity;
    const lastRefill = data[1] ? parseInt(data[1], 10) : now;

    const deltaMs = now - lastRefill;
    tokens = Math.min(
      this.outboundBucketCapacity,
      tokens + deltaMs * this.outboundRefillRatePerMs,
    );

    if (tokens < 1) {
      throw new HttpException(
        {
          code: ErrorCode.RATE_LIMITED,
          message:
            'Outbound service threshold reached. Please try booking again shortly.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    tokens -= 1;
    await this.redis.hset(
      this.outboundBucketKey,
      'tokens',
      tokens.toString(),
      'last_refill',
      now.toString(),
    );
  }
}
