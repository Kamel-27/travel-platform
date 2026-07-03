import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Dev-mode mail service.
 *
 * In development, logs the magic link URL to the console rather than
 * sending an actual email. Ready to swap for a real transport (SendGrid,
 * Postmark, etc.) behind this same interface.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly webAppUrl: string;

  constructor(private readonly config: ConfigService) {
    this.webAppUrl = this.config.getOrThrow<string>('WEB_APP_URL');
  }

  /**
   * "Send" a magic link email.
   *
   * In dev mode this simply logs the full verification URL to the console
   * so the developer can click it.
   */
  sendMagicLink(email: string, rawToken: string): void {
    const link = `${this.webAppUrl}/auth/verify?token=${rawToken}`;

    this.logger.log('────────────────────────────────────────');
    this.logger.log(`Magic link for ${email}:`);
    this.logger.log(link);
    this.logger.log('────────────────────────────────────────');
  }
}
