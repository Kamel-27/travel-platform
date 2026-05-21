import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PkfareHttpService } from '../pkfare-http.service';

export interface FlightSearchParams {
  tripType: 'OW' | 'RT' | 'MC'; // OneWay, RoundTrip, MultiCity
  trips: Array<{
    from: string; // IATA airport code
    to: string;
    departDate: string; // YYYY-MM-DD
  }>;
  adults: number;
  children: number;
  infants: number;
  cabinClass: 'ECONOMY' | 'PREMIUM_ECONOMY' | 'BUSINESS' | 'FIRST';
  currency?: string;
}

export interface FlightVerifyParams {
  shoppingResultId: string;
  sessionId: string;
}

export interface FlightBookParams {
  shoppingResultId: string;
  sessionId: string;
  passengers: Array<{
    type: 'ADT' | 'CHD' | 'INF';
    title: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    nationality: string;
    passportNumber: string;
    passportExpiry: string;
    passportCountry: string;
  }>;
  contactEmail: string;
  contactPhone: string;
}

/**
 * Flight search service — interfaces with PKFARE Flight API
 */
@Injectable()
export class FlightSearchService {
  private readonly logger = new Logger(FlightSearchService.name);

  constructor(
    private readonly http: PkfareHttpService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Search for available flights
   */
  async search(params: FlightSearchParams) {
    this.logger.log(
      `Flight search: ${params.trips.map((t) => `${t.from}->${t.to}`).join(', ')}`,
    );

    const partnerId = this.config.get<string>('PKFARE_PARTNER_ID') || '';
    const apiKey = this.config.get<string>('PKFARE_API_KEY') || '';

    if (!partnerId || !apiKey) {
      this.logger.warn('PKFARE API credentials not configured. Returning premium simulated flight search results.');
      
      const trip = params.trips[0] || { from: 'RUH', to: 'CAI', departDate: '2026-06-01' };
      const from = trip.from;
      const to = trip.to;

      // Realistic mock results
      return {
        success: true,
        data: [
          {
            id: "sim-1",
            airline: "Saudia",
            code: "SV",
            flightNo: "SV-302",
            departure: { time: "08:30", airport: from },
            arrival: { time: "11:45", airport: to },
            duration: "3h 15m",
            stops: 0,
            price: { base: 1200, tax: 180, total: 1380 },
            shoppingResultId: "shopping-res-sv-302",
            sessionId: "session-simulated-12345"
          },
          {
            id: "sim-2",
            airline: "EgyptAir",
            code: "MS",
            flightNo: "MS-660",
            departure: { time: "14:00", airport: from },
            arrival: { time: "17:30", airport: to },
            duration: "3h 30m",
            stops: 0,
            price: { base: 1050, tax: 160, total: 1210 },
            shoppingResultId: "shopping-res-ms-660",
            sessionId: "session-simulated-12345"
          },
          {
            id: "sim-3",
            airline: "flynas",
            code: "XY",
            flightNo: "XY-501",
            departure: { time: "06:15", airport: from },
            arrival: { time: "11:00", airport: to },
            duration: "4h 45m",
            stops: 1,
            price: { base: 850, tax: 130, total: 980 },
            shoppingResultId: "shopping-res-xy-501",
            sessionId: "session-simulated-12345"
          },
          {
            id: "sim-4",
            airline: "Emirates",
            code: "EK",
            flightNo: "EK-812",
            departure: { time: "22:00", airport: from },
            arrival: { time: "02:30+1", airport: to },
            duration: "4h 30m",
            stops: 1,
            price: { base: 1500, tax: 220, total: 1720 },
            shoppingResultId: "shopping-res-ek-812",
            sessionId: "session-simulated-12345"
          }
        ],
        raw: { simulated: true }
      } as any;
    }

    const response = await this.http.request({
      endpoint: '/flightShopping',
      body: {
        tripType: params.tripType,
        legs: params.trips.map((trip) => ({
          departureCode: trip.from,
          arrivalCode: trip.to,
          departureDate: trip.departDate,
        })),
        adultNum: params.adults,
        childNum: params.children,
        infantNum: params.infants,
        cabinClass: this.mapCabinClass(params.cabinClass),
        currency: params.currency || 'SAR',
      },
      timeout: 45000, // Flight search can be slow
    });

    return response;
  }

  /**
   * Verify/re-price a specific flight result before booking
   */
  async verify(params: FlightVerifyParams) {
    this.logger.log(`Flight verify: ${params.shoppingResultId}`);

    return this.http.request({
      endpoint: '/preciseSearch',
      body: {
        shoppingResultId: params.shoppingResultId,
        sessionId: params.sessionId,
      },
      timeout: 30000,
    });
  }

  /**
   * Create a flight booking order
   */
  async createOrder(params: FlightBookParams) {
    this.logger.log(`Flight createOrder: ${params.shoppingResultId}`);

    return this.http.request({
      endpoint: '/createOrder',
      body: {
        shoppingResultId: params.shoppingResultId,
        sessionId: params.sessionId,
        passengers: params.passengers.map((p) => ({
          passengerType: p.type,
          title: p.title,
          firstName: p.firstName,
          lastName: p.lastName,
          birthday: p.dateOfBirth,
          nationality: p.nationality,
          cardNo: p.passportNumber,
          cardExpired: p.passportExpiry,
          cardIssueCountry: p.passportCountry,
        })),
        contactEmail: params.contactEmail,
        contactPhone: params.contactPhone,
      },
    });
  }

  /**
   * Issue ticket for a confirmed order
   */
  async issueTicket(orderId: string) {
    this.logger.log(`Flight issueTicket: ${orderId}`);

    return this.http.request({
      endpoint: '/issueTicket',
      body: { orderId },
    });
  }

  /**
   * Get order details
   */
  async getOrderDetail(orderId: string) {
    return this.http.request({
      endpoint: '/orderDetail',
      body: { orderId },
    });
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId: string, reason?: string) {
    this.logger.log(`Flight cancelOrder: ${orderId}`);

    return this.http.request({
      endpoint: '/cancelOrder',
      body: { orderId, reason },
    });
  }

  private mapCabinClass(cabin: string): string {
    const map: Record<string, string> = {
      ECONOMY: 'Y',
      PREMIUM_ECONOMY: 'S',
      BUSINESS: 'C',
      FIRST: 'F',
    };
    return map[cabin] || 'Y';
  }
}
