import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * PKFARE authentication service.
 * Handles signature generation for API requests.
 *
 * PKFARE uses a signature-based auth:
 *   - Each request includes partnerId + sign + timestamp
 *   - sign = hash(sorted_params + API_KEY)
 *
 * NOTE: The exact hashing algorithm (MD5 vs SHA256) and param
 * concatenation order must be confirmed with PKFARE during the
 * meeting with Mr. Richil. The implementation below supports both.
 */
@Injectable()
export class PkfareAuthService {
  private readonly logger = new Logger(PkfareAuthService.name);
  private readonly partnerId: string;
  private readonly apiKey: string;

  constructor(private readonly config: ConfigService) {
    this.partnerId = this.config.get<string>('PKFARE_PARTNER_ID') || '';
    this.apiKey = this.config.get<string>('PKFARE_API_KEY') || '';
  }

  /**
   * Generate authentication parameters for a PKFARE request
   */
  generateAuthParams(): {
    partnerId: string;
    sign: string;
    timestamp: number;
  } {
    const timestamp = Math.floor(Date.now() / 1000);
    const sign = this.generateSign(timestamp);

    return {
      partnerId: this.partnerId,
      sign,
      timestamp,
    };
  }

  /**
   * Generate the request signature
   * Default: MD5(partnerId + timestamp + apiKey)
   * This may need adjustment based on official PKFARE docs
   */
  private generateSign(timestamp: number): string {
    const signString = `${this.partnerId}${timestamp}${this.apiKey}`;
    return crypto.createHash('md5').update(signString).digest('hex');
  }

  /**
   * Alternative SHA256 signing (use if PKFARE requires it)
   */
  generateSignSHA256(params: Record<string, any>): string {
    // Sort params alphabetically, concatenate key=value pairs
    const sortedKeys = Object.keys(params).sort();
    const signString =
      sortedKeys.map((k) => `${k}=${params[k]}`).join('&') + this.apiKey;

    return crypto.createHash('sha256').update(signString).digest('hex');
  }

  getPartnerId(): string {
    return this.partnerId;
  }
}
