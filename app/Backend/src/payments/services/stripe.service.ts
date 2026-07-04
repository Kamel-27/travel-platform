/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { ErrorCode } from '../../common/dto/error-response.dto';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly stripe: Stripe | null = null;
  private readonly webhookSecret: string | undefined;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('STRIPE_SECRET_KEY');
    this.webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');

    if (apiKey) {
      this.stripe = new Stripe(apiKey, {
        apiVersion: '2023-10-16' as any, // standard api version or default
      });
    }
  }

  /**
   * Assures that Stripe keys are configured. If not, throws a 503 error.
   */
  assertConfigured(): Stripe {
    if (!this.stripe) {
      throw new ServiceUnavailableException({
        code: ErrorCode.SUPPLIER_UNAVAILABLE,
        message: 'Payment provider (Stripe) is currently unconfigured.',
      });
    }
    return this.stripe;
  }

  /**
   * Creates a new PaymentIntent with Stripe.
   * Stripe expects amount in minor units, which matches our database total_amount.
   */
  async createPaymentIntent(
    amount: number,
    currency: string,
    bookingId: string,
  ): Promise<Stripe.PaymentIntent> {
    const stripeClient = this.assertConfigured();

    try {
      return await stripeClient.paymentIntents.create({
        amount,
        currency: currency.toLowerCase(),
        metadata: {
          booking_id: bookingId,
        },
      });
    } catch (err: unknown) {
      this.logger.error(
        `Stripe PaymentIntent creation failed for booking ${bookingId}`,
        err,
      );
      throw new ServiceUnavailableException({
        code: ErrorCode.SUPPLIER_UNAVAILABLE,
        message: 'Unable to initialize payment gateway.',
      });
    }
  }

  /**
   * Constructs and verifies a Stripe event from the raw request body.
   */
  constructEvent(rawBody: Buffer, signature: string): Stripe.Event {
    const stripeClient = this.assertConfigured();

    if (!this.webhookSecret) {
      throw new ServiceUnavailableException({
        code: ErrorCode.SUPPLIER_UNAVAILABLE,
        message: 'Stripe webhook verification is currently unconfigured.',
      });
    }

    try {
      return stripeClient.webhooks.constructEvent(
        rawBody,
        signature,
        this.webhookSecret,
      );
    } catch (err: unknown) {
      this.logger.warn(
        `Stripe signature verification failed: ${(err as Error).message}`,
      );
      throw new ServiceUnavailableException({
        code: ErrorCode.SUPPLIER_UNAVAILABLE,
        message: 'Stripe webhook signature validation failed.',
      });
    }
  }
}
