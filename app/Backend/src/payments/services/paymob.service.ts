import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { ErrorCode } from '../../common/dto/error-response.dto';

export interface PaymobBillingData {
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
}

export interface PaymobPaymentKeyResult {
  /** Paymob order id — the webhook-matching key (obj.order.id) */
  orderId: string;
  /** Payment key token the client uses to open the Paymob iframe */
  paymentKey: string;
  /** Ready-to-embed iframe URL (null when PAYMOB_IFRAME_ID is unset) */
  iframeUrl: string | null;
}

/**
 * Keys of the transaction-processed callback that participate in HMAC
 * verification, in Paymob's mandated lexicographic order. `order` and
 * `source_data.*` are nested lookups on the transaction object.
 */
const HMAC_FIELDS = [
  'amount_cents',
  'created_at',
  'currency',
  'error_occured',
  'has_parent_transaction',
  'id',
  'integration_id',
  'is_3d_secure',
  'is_auth',
  'is_capture',
  'is_refunded',
  'is_standalone_payment',
  'is_voided',
  'order.id',
  'owner',
  'pending',
  'source_data.pan',
  'source_data.sub_type',
  'source_data.type',
  'success',
] as const;

@Injectable()
export class PaymobService {
  private readonly logger = new Logger(PaymobService.name);
  private readonly apiBase: string;
  private readonly apiKey: string | undefined;
  private readonly integrationId: string | undefined;
  private readonly iframeId: string | undefined;
  private readonly hmacSecret: string | undefined;

  // Paymob auth tokens live ~1 hour; refresh well before expiry
  private authToken: string | null = null;
  private authTokenFetchedAt = 0;
  private static readonly AUTH_TOKEN_TTL_MS = 45 * 60 * 1000;

  constructor(private readonly config: ConfigService) {
    this.apiBase =
      this.config.get<string>('PAYMOB_API_BASE') ||
      'https://accept.paymob.com/api';
    this.apiKey = this.config.get<string>('PAYMOB_API_KEY') || undefined;
    this.integrationId =
      this.config.get<string>('PAYMOB_INTEGRATION_ID') || undefined;
    this.iframeId = this.config.get<string>('PAYMOB_IFRAME_ID') || undefined;
    this.hmacSecret =
      this.config.get<string>('PAYMOB_HMAC_SECRET') || undefined;
  }

  /**
   * Assures Paymob credentials are configured. If not, throws a 503 error.
   */
  assertConfigured(): void {
    if (!this.apiKey || !this.integrationId) {
      throw new ServiceUnavailableException({
        code: ErrorCode.SUPPLIER_UNAVAILABLE,
        message: 'Payment provider (Paymob) is currently unconfigured.',
      });
    }
  }

  isConfigured(): boolean {
    return !!this.apiKey && !!this.integrationId;
  }

  /**
   * Runs the Paymob three-step intention flow:
   * auth token -> order registration -> payment key.
   * Amounts are integer minor units (amount_cents), matching total_amount.
   */
  async createPaymentKey(
    amountCents: number,
    currency: string,
    merchantOrderId: string,
    billing: PaymobBillingData,
  ): Promise<PaymobPaymentKeyResult> {
    this.assertConfigured();

    const token = await this.authenticate();

    // 1. Register the order (unique merchant_order_id per attempt)
    const order = await this.postJson<{ id: number }>('/ecommerce/orders', {
      auth_token: token,
      delivery_needed: false,
      amount_cents: amountCents,
      currency,
      merchant_order_id: merchantOrderId,
      items: [],
    });

    // 2. Request the payment key for the registered order
    const paymentKey = await this.postJson<{ token: string }>(
      '/acceptance/payment_keys',
      {
        auth_token: token,
        amount_cents: amountCents,
        expiration: 3600,
        order_id: order.id,
        billing_data: {
          first_name: billing.first_name,
          last_name: billing.last_name,
          email: billing.email,
          phone_number: billing.phone_number,
          apartment: 'NA',
          floor: 'NA',
          street: 'NA',
          building: 'NA',
          shipping_method: 'NA',
          postal_code: 'NA',
          city: 'NA',
          country: 'NA',
          state: 'NA',
        },
        currency,
        integration_id: Number(this.integrationId),
      },
    );

    return {
      orderId: String(order.id),
      paymentKey: paymentKey.token,
      iframeUrl: this.iframeId
        ? `${this.apiBase}/acceptance/iframes/${this.iframeId}?payment_token=${paymentKey.token}`
        : null,
    };
  }

  /**
   * Verifies the HMAC-SHA512 signature Paymob appends (as a query param) to
   * transaction-processed callbacks. Must pass before any DB write.
   */
  verifyTransactionHmac(
    transaction: Record<string, any>,
    receivedHmac: string | undefined,
  ): boolean {
    if (!this.hmacSecret) {
      throw new ServiceUnavailableException({
        code: ErrorCode.SUPPLIER_UNAVAILABLE,
        message: 'Paymob webhook verification is currently unconfigured.',
      });
    }
    if (!receivedHmac) {
      return false;
    }

    const concatenated = HMAC_FIELDS.map((path) => {
      const value = path
        .split('.')
        .reduce<unknown>(
          (acc, key) =>
            acc && typeof acc === 'object'
              ? (acc as Record<string, unknown>)[key]
              : undefined,
          transaction,
        );
      if (
        value === undefined ||
        value === null ||
        typeof value === 'object' ||
        typeof value === 'function' ||
        typeof value === 'symbol'
      ) {
        return '';
      }
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      return String(value);
    }).join('');

    const expected = createHmac('sha512', this.hmacSecret)
      .update(concatenated)
      .digest('hex');

    const expectedBuf = Buffer.from(expected, 'utf8');
    const receivedBuf = Buffer.from(receivedHmac, 'utf8');
    if (expectedBuf.length !== receivedBuf.length) {
      return false;
    }
    return timingSafeEqual(expectedBuf, receivedBuf);
  }

  /**
   * Refund a processed transaction.
   * POST /acceptance/void_refund/refund
   */
  async refundTransaction(
    transactionId: number,
    amountCents: number,
  ): Promise<{ refundId: string }> {
    this.assertConfigured();
    const token = await this.authenticate();

    const result = await this.postJson<{ id: number }>(
      '/acceptance/void_refund/refund',
      {
        auth_token: token,
        transaction_id: transactionId,
        amount_cents: amountCents,
      },
    );

    return {
      refundId: String(result.id),
    };
  }

  // ── Internals ─────────────────────────────────────────────────────

  private async authenticate(): Promise<string> {
    const now = Date.now();
    if (
      this.authToken &&
      now - this.authTokenFetchedAt < PaymobService.AUTH_TOKEN_TTL_MS
    ) {
      return this.authToken;
    }

    const result = await this.postJson<{ token: string }>('/auth/tokens', {
      api_key: this.apiKey,
    });
    this.authToken = result.token;
    this.authTokenFetchedAt = now;
    return result.token;
  }

  private async postJson<T>(path: string, body: unknown): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.apiBase}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        // Fail fast per nfr.md §5 — never a hung spinner
        signal: AbortSignal.timeout(15_000),
      });
    } catch (err: unknown) {
      // Never log the request body — it carries api_key / auth_token
      this.logger.error(
        `Paymob request to ${path} failed: ${(err as Error).message}`,
      );
      throw new ServiceUnavailableException({
        code: ErrorCode.SUPPLIER_UNAVAILABLE,
        message: 'Unable to reach payment gateway.',
      });
    }

    if (!response.ok) {
      this.logger.error(
        `Paymob request to ${path} returned HTTP ${response.status}`,
      );
      throw new ServiceUnavailableException({
        code: ErrorCode.SUPPLIER_UNAVAILABLE,
        message: 'Unable to initialize payment gateway.',
      });
    }

    return (await response.json()) as T;
  }
}
