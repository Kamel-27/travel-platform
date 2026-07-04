/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call */
import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ErrorCode } from '../common/dto/error-response.dto';

/**
 * Thrown when Duffel returns a definitive non-retryable failure (4xx).
 * The order was NOT created supplier-side.
 */
export class DuffelDefinitiveError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'DuffelDefinitiveError';
  }
}

/**
 * Thrown when Duffel returns an ambiguous outcome (500/timeout/network error).
 * The order MAY or MAY NOT have been created supplier-side — do NOT retry.
 */
export class DuffelAmbiguousError extends Error {
  constructor(
    message: string,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = 'DuffelAmbiguousError';
  }
}

export interface MinorUnitMoney {
  amount: number;
  currency: string;
}

export interface DuffelDocument {
  type: string;
  uniqueIdentifier: string;
  passengerIds: string[];
}

export interface DuffelOrderResult {
  orderId: string;
  bookingReference: string;
  documents: DuffelDocument[];
}

export interface CreateOrderPassenger {
  id: string;
  given_name: string;
  family_name: string;
  title: string;
  gender: string;
  born_on: string;
  email: string;
  phone_number: string;
  infant_passenger_id?: string;
  identity_documents?: {
    type: string;
    unique_identifier: string;
    expires_on: string;
    issuing_country_code: string;
  }[];
}

export interface CreateOrderParams {
  offerId: string;
  passengers: CreateOrderPassenger[];
  metadata: Record<string, string>;
}

export interface NormalizedSegment {
  marketing_carrier: string;
  operating_carrier: string;
  flight_number: string;
  departing_at: { local: string; timezone: string };
  arriving_at: { local: string; timezone: string };
  origin_terminal: string | null;
  destination_terminal: string | null;
}

export interface NormalizedSlice {
  origin: string;
  destination: string;
  duration: string;
  segments: NormalizedSegment[];
}

export interface NormalizedCondition {
  allowed: boolean;
  penalty: MinorUnitMoney | null;
}

export interface NormalizedConditions {
  refund_before_departure?: NormalizedCondition;
  change_before_departure?: NormalizedCondition;
}

export interface NormalizedOffer {
  offer_id: string;
  expires_at: string;
  total: MinorUnitMoney;
  airline: { name: string; iata: string; logo_url: string };
  cabin_class: string;
  passenger_identity_documents_required: boolean;
  slices: NormalizedSlice[];
  conditions: NormalizedConditions;
  passengers: { id: string; type: string }[];
}

@Injectable()
export class DuffelService {
  private readonly logger = new Logger(DuffelService.name);
  private readonly apiKey: string | undefined;
  private readonly baseUrl = 'https://api.duffel.com';
  private readonly duffelVersion = 'v2';

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('DUFFEL_API_KEY');
  }

  assertConfigured(): void {
    if (!this.apiKey) {
      throw new ServiceUnavailableException({
        code: ErrorCode.SUPPLIER_UNAVAILABLE,
        message: 'Flight search provider (Duffel) is currently unconfigured.',
      });
    }
  }

  /**
   * Search flights by creating an offer request.
   * POST /air/offer_requests?return_offers=true
   */
  async search(params: {
    origin: string;
    destination: string;
    departureDate: string;
    returnDate?: string;
    passengers: { type: string }[];
    cabinClass?: string;
  }): Promise<NormalizedOffer[]> {
    this.assertConfigured();

    const slices = [
      {
        origin: params.origin.toUpperCase(),
        destination: params.destination.toUpperCase(),
        departure_date: params.departureDate,
      },
    ];

    if (params.returnDate) {
      slices.push({
        origin: params.destination.toUpperCase(),
        destination: params.origin.toUpperCase(),
        departure_date: params.returnDate,
      });
    }

    const body = {
      data: {
        slices,
        passengers: params.passengers,
        cabin_class: params.cabinClass,
      },
    };

    try {
      const response = await fetch(
        `${this.baseUrl}/air/offer_requests?return_offers=true`,
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify(body),
          // Fail fast per nfr.md §5 — never a hung spinner
          signal: AbortSignal.timeout(30_000),
        },
      );

      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      const json = (await response.json()) as Record<string, unknown>;
      const responseData = json['data'] as Record<string, unknown> | undefined;
      const rawOffers = responseData?.['offers'] as unknown[] | undefined;

      if (!rawOffers || !Array.isArray(rawOffers)) {
        return [];
      }

      return rawOffers.map((o) => this.mapOffer(o, params.cabinClass));
    } catch (err: unknown) {
      if (err instanceof HttpException) {
        throw err;
      }
      this.logger.error('Duffel flight search failed', err);
      throw new ServiceUnavailableException({
        code: ErrorCode.SUPPLIER_UNAVAILABLE,
        message: 'Flight search is temporarily unavailable.',
      });
    }
  }

  /**
   * Fetch single offer to revalidate and get available services.
   * GET /air/offers/:offer_id?return_available_services=true
   */
  async fetchOffer(offerId: string): Promise<NormalizedOffer> {
    this.assertConfigured();

    try {
      const response = await fetch(
        `${this.baseUrl}/air/offers/${encodeURIComponent(offerId)}?return_available_services=true`,
        {
          method: 'GET',
          headers: this.getHeaders(),
          // Fail fast per nfr.md §5 — never a hung spinner
          signal: AbortSignal.timeout(15_000),
        },
      );

      if (!response.ok) {
        // Map 410 or 422 to OFFER_EXPIRED
        if (response.status === 410 || response.status === 422) {
          throw new HttpException(
            {
              code: ErrorCode.OFFER_EXPIRED,
              message: 'The requested flight offer has expired.',
            },
            HttpStatus.GONE,
          );
        }
        await this.handleErrorResponse(response);
      }

      const json = (await response.json()) as Record<string, unknown>;
      const responseData = json['data'] as Record<string, unknown> | undefined;

      if (!responseData) {
        throw new HttpException(
          {
            code: ErrorCode.NOT_FOUND,
            message: 'Flight offer not found.',
          },
          HttpStatus.NOT_FOUND,
        );
      }

      return this.mapOffer(responseData);
    } catch (err: unknown) {
      if (err instanceof HttpException) {
        throw err;
      }
      this.logger.error(`Duffel fetch offer failed for ID ${offerId}`, err);
      throw new ServiceUnavailableException({
        code: ErrorCode.SUPPLIER_UNAVAILABLE,
        message: 'Flight validation is temporarily unavailable.',
      });
    }
  }

  /**
   * Create a Duffel order (ticket the flight).
   * POST /air/orders
   *
   * CRITICAL: 130s timeout per Duffel SLA. Error handling follows the
   * paid recovery matrix (booking_state_machine.md §4):
   * - 201/200 → success (DuffelOrderResult)
   * - 4xx     → DuffelDefinitiveError (order NOT created, safe to refund)
   * - 500     → DuffelAmbiguousError (outcome unknown, do NOT retry)
   * - timeout → DuffelAmbiguousError (outcome unknown, do NOT retry)
   */
  async createOrder(params: CreateOrderParams): Promise<DuffelOrderResult> {
    this.assertConfigured();

    const body = {
      data: {
        selected_offers: [params.offerId],
        passengers: params.passengers,
        payments: [
          {
            type: 'instant' as const,
          },
        ],
        metadata: params.metadata,
        type: 'instant' as const,
      },
    };

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/air/orders`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
        // Duffel SLA: order creation can take up to 130 seconds
        signal: AbortSignal.timeout(130_000),
      });
    } catch (err: unknown) {
      // Network error or timeout — outcome is ambiguous
      const message =
        err instanceof Error ? err.message : 'Unknown network error';
      this.logger.error(`Duffel createOrder network/timeout error: ${message}`);
      throw new DuffelAmbiguousError(
        `Order creation failed with ambiguous outcome: ${message}`,
      );
    }

    // Parse the request_id header for admin tracing
    const requestId = response.headers.get('x-request-id') ?? undefined;

    if (response.ok) {
      const json = (await response.json()) as Record<string, unknown>;
      const data = json['data'] as Record<string, unknown>;
      return this.mapOrderResult(data);
    }

    // Read error body for logging
    let errorBody: unknown = null;
    try {
      errorBody = await response.json();
    } catch {
      // ignore
    }

    if (response.status >= 400 && response.status < 500) {
      // Definitive failure — Duffel created nothing
      this.logger.error(
        `Duffel createOrder definitive failure [${response.status}]: ${JSON.stringify(errorBody)}`,
      );
      throw new DuffelDefinitiveError(
        response.status,
        `Order creation rejected by Duffel: HTTP ${response.status}`,
      );
    }

    if (response.status === 503) {
      // 503 — Duffel guarantees nothing was created, but we treat as ambiguous
      // to let the reconciliation sweep handle it safely
      this.logger.error(
        `Duffel createOrder 503 (request_id: ${requestId}): ${JSON.stringify(errorBody)}`,
      );
      throw new DuffelAmbiguousError(
        `Order creation returned 503 — outcome ambiguous`,
        requestId,
      );
    }

    // 500 or any other server error — fully ambiguous
    this.logger.error(
      `Duffel createOrder server error [${response.status}] (request_id: ${requestId}): ${JSON.stringify(errorBody)}`,
    );
    throw new DuffelAmbiguousError(
      `Order creation returned HTTP ${response.status} — outcome ambiguous`,
      requestId,
    );
  }

  /**
   * List orders from Duffel for reconciliation matching.
   * GET /air/orders
   */
  async listOrders(params: {
    createdAfter?: string;
    limit?: number;
  }): Promise<Record<string, unknown>[]> {
    this.assertConfigured();

    const queryParams = new URLSearchParams();
    if (params.createdAfter) {
      queryParams.set('created_after', params.createdAfter);
    }
    queryParams.set('limit', String(params.limit ?? 50));

    try {
      const response = await fetch(
        `${this.baseUrl}/air/orders?${queryParams.toString()}`,
        {
          method: 'GET',
          headers: this.getHeaders(),
          signal: AbortSignal.timeout(30_000),
        },
      );

      if (!response.ok) {
        this.logger.error(
          `Duffel listOrders failed with status ${response.status}`,
        );
        return [];
      }

      const json = (await response.json()) as Record<string, unknown>;
      const data = json['data'] as Record<string, unknown>[] | undefined;
      return data ?? [];
    } catch (err: unknown) {
      this.logger.error('Duffel listOrders failed', err);
      return [];
    }
  }

  // ── Order Result Mapper ─────────────────────────────────────────

  private mapOrderResult(raw: any): DuffelOrderResult {
    const documents: DuffelDocument[] = (raw.documents ?? []).map(
      (doc: any) => ({
        type: doc.type as string,
        uniqueIdentifier: doc.unique_identifier as string,
        passengerIds: (doc.passenger_ids ?? []) as string[],
      }),
    );

    // Duffel returns booking_reference as a single string or as booking_references[]
    const bookingReference =
      (raw.booking_reference as string) ??
      (raw.booking_references?.[0]?.booking_reference as string) ??
      '';

    return {
      orderId: raw.id as string,
      bookingReference,
      documents,
    };
  }

  // ── Helpers & Mappers ─────────────────────────────────────────────

  private getHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey as string}`,
      'Duffel-Version': this.duffelVersion,
      'Content-Type': 'application/json',
    };
  }

  private async handleErrorResponse(response: Response): Promise<never> {
    let errorDetails: unknown = null;
    try {
      errorDetails = await response.json();
    } catch {
      // ignore
    }

    this.logger.error(
      `Duffel API error [Status ${response.status}]: ${JSON.stringify(errorDetails)}`,
    );

    throw new ServiceUnavailableException({
      code: ErrorCode.SUPPLIER_UNAVAILABLE,
      message: 'Flight search provider encountered an error.',
    });
  }

  private mapOffer(raw: any, requestedCabinClass?: string): NormalizedOffer {
    const totalAmount = raw.total_amount as string;
    const totalCurrency = raw.total_currency as string;

    const slices = (raw.slices as any[]).map((s: any) => {
      const origin =
        typeof s.origin === 'string' ? s.origin : (s.origin?.iata_code ?? '');
      const destination =
        typeof s.destination === 'string'
          ? s.destination
          : (s.destination?.iata_code ?? '');

      const segments = (s.segments as any[]).map((seg: any) => {
        const departingAtLocal = seg.departing_at as string;
        const arrivingAtLocal = seg.arriving_at as string;

        const originTz = seg.origin?.time_zone ?? 'UTC';
        const destTz = seg.destination?.time_zone ?? 'UTC';

        return {
          marketing_carrier: seg.marketing_carrier?.iata_code ?? '',
          operating_carrier: seg.operating_carrier?.iata_code ?? '',
          flight_number: seg.marketing_carrier_flight_number ?? '',
          departing_at: { local: departingAtLocal, timezone: originTz },
          arriving_at: { local: arrivingAtLocal, timezone: destTz },
          origin_terminal: seg.origin_terminal ?? null,
          destination_terminal: seg.destination_terminal ?? null,
        };
      });

      return {
        origin,
        destination,
        duration: s.duration as string,
        segments,
      };
    });

    // Map conditions (refund, change)
    const rawConditions = raw.conditions ?? {};
    const conditions: NormalizedConditions = {};

    if (rawConditions.refund_before_departure) {
      const cond = rawConditions.refund_before_departure;
      conditions.refund_before_departure = {
        allowed: cond.allowed as boolean,
        penalty: cond.penalty_amount
          ? {
              amount: this.toMinorUnits(
                cond.penalty_amount,
                cond.penalty_currency,
              ),
              currency: cond.penalty_currency as string,
            }
          : null,
      };
    }

    if (rawConditions.change_before_departure) {
      const cond = rawConditions.change_before_departure;
      conditions.change_before_departure = {
        allowed: cond.allowed as boolean,
        penalty: cond.penalty_amount
          ? {
              amount: this.toMinorUnits(
                cond.penalty_amount,
                cond.penalty_currency,
              ),
              currency: cond.penalty_currency as string,
            }
          : null,
      };
    }

    return {
      offer_id: raw.id as string,
      expires_at: raw.expires_at as string,
      total: {
        amount: this.toMinorUnits(totalAmount, totalCurrency),
        currency: totalCurrency,
      },
      airline: {
        name: raw.owner?.name as string,
        iata: raw.owner?.iata_code as string,
        logo_url: raw.owner?.logo_symbol_url ?? '',
      },
      cabin_class: this.extractCabinClass(raw, requestedCabinClass),
      passenger_identity_documents_required:
        (raw.passenger_identity_documents_required as boolean) ?? false,
      slices,
      conditions,
      passengers:
        raw.passengers?.map((p: any) => ({
          id: p.id as string,
          type: p.type as string,
        })) ?? [],
    };
  }

  /**
   * Duffel has no top-level cabin_class on offers — it lives per
   * segment-passenger. Fall back to a top-level field if present (some
   * fixtures/APIs include it), then to what was requested.
   */
  private extractCabinClass(raw: any, requested?: string): string {
    const segmentCabin =
      raw.slices?.[0]?.segments?.[0]?.passengers?.[0]?.cabin_class;
    return (segmentCabin ??
      raw.cabin_class ??
      requested ??
      'economy') as string;
  }

  private toMinorUnits(amountStr: string, currency: string): number {
    const decimalsMap: Record<string, number> = {
      JPY: 0,
      KRW: 0,
      HUF: 0,
      KWD: 3,
      BHD: 3,
      OMR: 3,
      JOD: 3,
      LYD: 3,
    };
    const decimals = decimalsMap[currency.toUpperCase()] ?? 2;
    const amount = parseFloat(amountStr);
    return Math.round(amount * Math.pow(10, decimals));
  }
}
