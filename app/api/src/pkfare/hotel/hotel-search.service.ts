import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PkfareHttpService } from '../pkfare-http.service';

export interface HotelSearchParams {
  cityCode: string;
  checkIn: string;  // YYYY-MM-DD
  checkOut: string;  // YYYY-MM-DD
  rooms: Array<{
    adults: number;
    children: number;
    childAges?: number[];
  }>;
  currency?: string;
  nationality?: string;
}

export interface HotelBookParams {
  hotelId: string;
  roomId: string;
  rateId: string;
  checkIn: string;
  checkOut: string;
  guests: Array<{
    title: string;
    firstName: string;
    lastName: string;
  }>;
  contactEmail: string;
  contactPhone: string;
  specialRequests?: string;
}

/**
 * Hotel search service — interfaces with PKFARE Hotel API
 */
@Injectable()
export class HotelSearchService {
  private readonly logger = new Logger(HotelSearchService.name);

  constructor(
    private readonly http: PkfareHttpService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Search for available hotels
   */
  async search(params: HotelSearchParams) {
    this.logger.log(`Hotel search: ${params.cityCode}, ${params.checkIn} - ${params.checkOut}`);

    const partnerId = this.config.get<string>('PKFARE_PARTNER_ID') || '';
    const apiKey = this.config.get<string>('PKFARE_API_KEY') || '';

    if (!partnerId || !apiKey) {
      this.logger.warn('PKFARE API credentials not configured. Returning premium simulated hotel search results.');
      
      const city = params.cityCode || 'RUH';
      
      return {
        success: true,
        data: [
          {
            id: "hotel-sim-1",
            name: "The Ritz-Carlton, Riyadh",
            address: "Al Hada Area, Mekkah Road, Riyadh",
            rating: 5,
            image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=400&q=80",
            price: { total: 1850, currency: params.currency || "SAR" },
            rooms: [
              { id: "room-1", type: "Deluxe King Room", price: 1850, available: true }
            ]
          },
          {
            id: "hotel-sim-2",
            name: "Four Seasons Hotel Riyadh",
            address: "Kingdom Centre, Al Olaya, Riyadh",
            rating: 5,
            image: "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=400&q=80",
            price: { total: 2100, currency: params.currency || "SAR" },
            rooms: [
              { id: "room-2", type: "Superior Queen Room", price: 2100, available: true }
            ]
          },
          {
            id: "hotel-sim-3",
            name: "Novotel Riyadh Al Anoud",
            address: "9005 King Fahd Rd, Riyadh",
            rating: 4,
            image: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=400&q=80",
            price: { total: 650, currency: params.currency || "SAR" },
            rooms: [
              { id: "room-3", type: "Standard Double Room", price: 650, available: true }
            ]
          }
        ],
        raw: { simulated: true }
      } as any;
    }

    return this.http.request({
      endpoint: '/hotelSearch',
      body: {
        cityCode: params.cityCode,
        checkInDate: params.checkIn,
        checkOutDate: params.checkOut,
        rooms: params.rooms,
        currency: params.currency || 'SAR',
        nationality: params.nationality || 'SA',
      },
      timeout: 30000,
    });
  }

  /**
   * Get detailed hotel information with rooms
   */
  async getDetail(hotelId: string, checkIn: string, checkOut: string) {
    return this.http.request({
      endpoint: '/hotelDetail',
      body: { hotelId, checkInDate: checkIn, checkOutDate: checkOut },
    });
  }

  /**
   * Verify room rate before booking
   */
  async priceCheck(hotelId: string, roomId: string, rateId: string) {
    return this.http.request({
      endpoint: '/hotelPriceCheck',
      body: { hotelId, roomId, rateId },
    });
  }

  /**
   * Create a hotel booking
   */
  async createOrder(params: HotelBookParams) {
    this.logger.log(`Hotel createOrder: ${params.hotelId}, room ${params.roomId}`);

    return this.http.request({
      endpoint: '/hotelCreateOrder',
      body: {
        hotelId: params.hotelId,
        roomId: params.roomId,
        rateId: params.rateId,
        checkInDate: params.checkIn,
        checkOutDate: params.checkOut,
        guests: params.guests,
        contactEmail: params.contactEmail,
        contactPhone: params.contactPhone,
        specialRequests: params.specialRequests,
      },
    });
  }

  /**
   * Get hotel booking details
   */
  async getOrderDetail(orderId: string) {
    return this.http.request({
      endpoint: '/hotelOrderDetail',
      body: { orderId },
    });
  }

  /**
   * Cancel a hotel booking
   */
  async cancelOrder(orderId: string) {
    this.logger.log(`Hotel cancelOrder: ${orderId}`);

    return this.http.request({
      endpoint: '/hotelCancelOrder',
      body: { orderId },
    });
  }
}
