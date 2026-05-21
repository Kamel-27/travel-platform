import { Injectable, Logger, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as zlib from 'zlib';
import { PkfareAuthService } from './pkfare-auth.service';

interface PkfareRequestOptions {
  endpoint: string;
  body: Record<string, any>;
  timeout?: number;
}

export interface PkfareResponse<T = any> {
  success: boolean;
  errorCode?: string;
  errorMsg?: string;
  data?: T;
  raw: any;
}

/**
 * HTTP client for PKFARE API with retry logic,
 * timeout handling, and error normalization.
 */
@Injectable()
export class PkfareHttpService {
  private readonly logger = new Logger(PkfareHttpService.name);
  private readonly baseUrl: string;
  private readonly maxRetries = 3;
  private readonly defaultTimeout = 30000; // 30s

  constructor(
    private readonly config: ConfigService,
    private readonly authService: PkfareAuthService,
  ) {
    const sandboxMode =
      this.config.get<string>('PKFARE_SANDBOX_MODE') === 'true';
    this.baseUrl = this.config.get<string>('PKFARE_BASE_URL') || '';

    if (sandboxMode) {
      this.logger.warn('PKFARE running in SANDBOX mode');
    }
  }

  /**
   * Send an authenticated request to PKFARE API
   */
  async request<T = any>(
    options: PkfareRequestOptions,
  ): Promise<PkfareResponse<T>> {
    const { endpoint, body, timeout = this.defaultTimeout } = options;
    const url = `${this.baseUrl}${endpoint}`;
    const authParams = this.authService.generateAuthParams();

    const requestBody = {
      ...authParams,
      ...body,
    };

    const base64Body = Buffer.from(JSON.stringify(requestBody)).toString('base64');
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        this.logger.debug(
          `PKFARE request [${attempt}/${this.maxRetries}]: ${endpoint}`,
        );

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: base64Body,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new HttpException(
            `PKFARE API returned HTTP ${response.status}`,
            response.status,
          );
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        let decompressed: string;

        try {
          decompressed = zlib.gunzipSync(buffer).toString('utf-8');
        } catch (gzipError) {
          // If not gzipped (e.g. error message, plain JSON), fallback to string decode
          decompressed = buffer.toString('utf-8');
        }

        const data = JSON.parse(decompressed);

        // PKFARE typically returns a status/code field
        if (data.errorCode && data.errorCode !== '0') {
          this.logger.warn(
            `PKFARE error on ${endpoint}: ${data.errorCode} - ${data.errorMsg}`,
          );
          return {
            success: false,
            errorCode: data.errorCode,
            errorMsg: data.errorMsg,
            raw: data,
          };
        }

        return {
          success: true,
          data: data.data || data,
          raw: data,
        };
      } catch (error) {
        lastError = error as Error;
        this.logger.error(
          `PKFARE request failed [${attempt}/${this.maxRetries}] ${endpoint}: ${lastError.message}`,
        );

        if (attempt < this.maxRetries) {
          // Exponential backoff: 1s, 2s, 4s
          const delay = Math.pow(2, attempt - 1) * 1000;
          await this.sleep(delay);
        }
      }
    }

    throw new HttpException(
      `PKFARE API unavailable after ${this.maxRetries} retries: ${lastError?.message}`,
      503,
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
