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

  /**
   * "Send" an airline schedule-change notification (prd.md §5.5/§5.7).
   * Dev mode: logs old vs new segment times rather than emailing.
   */
  sendScheduleChangeEmail(
    email: string,
    bookingId: string,
    bookingReference: string | null,
    changes: { flightNumber: string; oldLocal: string; newLocal: string }[],
  ): void {
    this.logger.log('────────────────────────────────────────');
    this.logger.log(
      `Schedule change for ${email} (booking ${bookingId}${bookingReference ? `, PNR ${bookingReference}` : ''}):`,
    );
    for (const change of changes) {
      this.logger.log(
        `  ${change.flightNumber}: ${change.oldLocal} → ${change.newLocal}`,
      );
    }
    this.logger.log('────────────────────────────────────────');
  }
}
