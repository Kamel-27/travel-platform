import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** A file attached to an outgoing email. */
interface MailAttachment {
  filename: string;
  content: Buffer;
}

/** Normalised payload handed to the underlying transport. */
interface SendArgs {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: MailAttachment[];
}

/**
 * Minimal shape of a confirmed booking needed to render the confirmation
 * email. Kept as a local interface (rather than importing the Booking entity)
 * so the auth module doesn't take a runtime dependency on the bookings module.
 */
export interface BookingConfirmationInfo {
  id: string;
  bookingReference: string | null;
  totalAmount: number;
  currency: string;
}

/**
 * Transactional mail service.
 *
 * When RESEND_API_KEY is set, sends real email via the Resend REST API
 * (https://resend.com/docs/api-reference/emails/send-email) using the global
 * fetch — no SDK dependency, so the transport stays trivially swappable.
 *
 * When RESEND_API_KEY is empty (dev / unconfigured), it logs a preview to the
 * console instead — preserving the original click-the-link-in-the-terminal dev
 * flow and letting the app boot without any email credentials.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly webAppUrl: string;
  private readonly apiKey: string | undefined;
  private readonly from: string;

  private static readonly RESEND_ENDPOINT = 'https://api.resend.com/emails';

  constructor(private readonly config: ConfigService) {
    this.webAppUrl = this.config.getOrThrow<string>('WEB_APP_URL');
    this.apiKey = this.config.get<string>('RESEND_API_KEY') || undefined;
    this.from =
      this.config.get<string>('MAIL_FROM') ||
      'Safariyat <no-reply@auth.safariyat.live>';
  }

  /** True when a real transport is configured. */
  private get configured(): boolean {
    return Boolean(this.apiKey);
  }

  /**
   * Send a magic-link sign-in email.
   *
   * Dev mode (no API key): logs the full verification URL to the console so
   * the developer can click it — identical to the original behaviour.
   */
  async sendMagicLink(email: string, rawToken: string): Promise<void> {
    const link = `${this.webAppUrl}/auth/verify?token=${encodeURIComponent(
      rawToken,
    )}`;

    if (!this.configured) {
      this.logger.log('────────────────────────────────────────');
      this.logger.log(`Magic link for ${email}:`);
      this.logger.log(link);
      this.logger.log('────────────────────────────────────────');
      return;
    }

    await this.send({
      to: email,
      subject: 'رابط تسجيل الدخول إلى سفريات · Your Safariyat sign-in link',
      html: this.magicLinkHtml(link),
      text: `سجّل دخولك إلى سفريات عبر الرابط التالي (صالح لمدة 15 دقيقة):\n${link}\n\nSign in to Safariyat using this link (valid for 15 minutes):\n${link}\n\nإذا لم تطلب هذا الرابط، يمكنك تجاهل هذه الرسالة.`,
    });
  }

  /**
   * Send an airline schedule-change notification (prd.md §5.5/§5.7).
   *
   * Dev mode: logs old vs new segment times rather than emailing.
   */
  async sendScheduleChangeEmail(
    email: string,
    bookingId: string,
    bookingReference: string | null,
    changes: { flightNumber: string; oldLocal: string; newLocal: string }[],
  ): Promise<void> {
    if (!this.configured) {
      this.logger.log('────────────────────────────────────────');
      this.logger.log(
        `Schedule change for ${email} (booking ${bookingId}${
          bookingReference ? `, PNR ${bookingReference}` : ''
        }):`,
      );
      for (const change of changes) {
        this.logger.log(
          `  ${change.flightNumber}: ${change.oldLocal} → ${change.newLocal}`,
        );
      }
      this.logger.log('────────────────────────────────────────');
      return;
    }

    await this.send({
      to: email,
      subject: `تغيير في موعد رحلتك${
        bookingReference ? ` · PNR ${bookingReference}` : ''
      }`,
      html: this.scheduleChangeHtml(bookingReference, changes),
    });
  }

  /**
   * Send a booking-confirmation email with the itinerary/e-ticket PDF attached.
   * Best-effort: any transport error is swallowed and logged by send().
   */
  async sendBookingConfirmation(
    email: string,
    booking: BookingConfirmationInfo,
    pdf: Buffer,
  ): Promise<void> {
    const ref = booking.bookingReference ?? booking.id;

    if (!this.configured) {
      this.logger.log('────────────────────────────────────────');
      this.logger.log(
        `Booking confirmation for ${email} (PNR ${ref}) — PDF ${pdf.length} bytes`,
      );
      this.logger.log('────────────────────────────────────────');
      return;
    }

    await this.send({
      to: email,
      subject: `تم تأكيد حجزك مع سفريات · ${ref}`,
      html: this.bookingConfirmationHtml(booking),
      attachments: [
        {
          filename: `safariyat-ticket-${ref}.pdf`,
          content: pdf,
        },
      ],
    });
  }

  // ─── Transport ────────────────────────────────────────────────────────

  /**
   * POSTs an email to the Resend REST API. Never throws — a transport failure
   * returns false and is logged, so email delivery can never break the caller
   * (a login request or a booking fulfillment).
   */
  private async send(args: SendArgs): Promise<boolean> {
    if (!this.configured) {
      return false;
    }

    try {
      const body: Record<string, unknown> = {
        from: this.from,
        to: [args.to],
        subject: args.subject,
        html: args.html,
      };
      if (args.text) {
        body.text = args.text;
      }
      if (args.attachments?.length) {
        body.attachments = args.attachments.map((a) => ({
          filename: a.filename,
          content: a.content.toString('base64'),
        }));
      }

      const res = await fetch(MailService.RESEND_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        this.logger.error(
          `Resend rejected email to ${args.to} (HTTP ${res.status}): ${detail}`,
        );
        return false;
      }

      this.logger.log(`Email sent to ${args.to}: "${args.subject}"`);
      return true;
    } catch (err: unknown) {
      this.logger.error(
        `Email transport error sending to ${args.to}`,
        err instanceof Error ? err.stack : String(err),
      );
      return false;
    }
  }

  // ─── HTML templates ───────────────────────────────────────────────────

  /** Shared branded shell — RTL, Arabic-first, inline styles for email clients. */
  private layout(bodyHtml: string): string {
    return `<!doctype html>
<html lang="ar" dir="rtl">
  <body style="margin:0;padding:0;background:#f2f5f9;font-family:'Segoe UI',Tahoma,Arial,sans-serif;color:#1c1b1f;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f5f9;padding:24px 0;">
      <tr><td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08);">
          <tr><td style="background:#0f4c81;padding:24px 28px;">
            <span style="color:#ffffff;font-size:22px;font-weight:700;">سفريات</span>
            <span style="color:#cfe0f0;font-size:13px;">&nbsp;· Safariyat</span>
          </td></tr>
          <tr><td style="padding:28px;">${bodyHtml}</td></tr>
          <tr><td style="padding:18px 28px;background:#f7f9fc;color:#5f6368;font-size:12px;line-height:1.7;">
            هذه رسالة آلية من منصة سفريات، الرجاء عدم الرد عليها.<br />
            safariyat.live
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
  }

  private button(href: string, label: string): string {
    return `<a href="${href}" style="display:inline-block;background:#0f4c81;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:10px;font-size:15px;font-weight:700;">${label}</a>`;
  }

  private magicLinkHtml(link: string): string {
    return this.layout(`
      <h1 style="margin:0 0 12px;font-size:20px;">تسجيل الدخول إلى حسابك</h1>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.8;color:#3c4043;">
        اضغط على الزر أدناه لإتمام تسجيل الدخول إلى سفريات. هذا الرابط صالح لمدة
        <strong>15 دقيقة</strong> ويُستخدم مرة واحدة فقط.
      </p>
      <p style="margin:0 0 24px;">${this.button(link, 'تسجيل الدخول')}</p>
      <p style="margin:0 0 8px;font-size:13px;color:#5f6368;">
        أو انسخ الرابط التالي في متصفحك:
      </p>
      <p style="margin:0 0 24px;font-size:12px;word-break:break-all;color:#0f4c81;">${link}</p>
      <p style="margin:0;font-size:13px;color:#5f6368;line-height:1.7;">
        إذا لم تطلب تسجيل الدخول، يمكنك تجاهل هذه الرسالة بأمان.
      </p>`);
  }

  private scheduleChangeHtml(
    bookingReference: string | null,
    changes: { flightNumber: string; oldLocal: string; newLocal: string }[],
  ): string {
    const rows = changes
      .map(
        (c) => `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e6eaf0;font-weight:700;">${c.flightNumber}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e6eaf0;color:#b3261e;text-decoration:line-through;">${c.oldLocal}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e6eaf0;color:#0f4c81;font-weight:700;">${c.newLocal}</td>
        </tr>`,
      )
      .join('');

    return this.layout(`
      <h1 style="margin:0 0 12px;font-size:20px;">تغيير في موعد رحلتك</h1>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.8;color:#3c4043;">
        قامت شركة الطيران بتحديث موعد رحلتك${
          bookingReference
            ? ` (رقم الحجز <strong>${bookingReference}</strong>)`
            : ''
        }. فيما يلي التغييرات:
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;margin-bottom:24px;">
        <thead>
          <tr style="background:#eef4fa;color:#5f6368;font-size:12px;">
            <td style="padding:10px 12px;">الرحلة</td>
            <td style="padding:10px 12px;">الموعد السابق</td>
            <td style="padding:10px 12px;">الموعد الجديد</td>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin:0;font-size:13px;color:#5f6368;line-height:1.7;">
        جميع الأوقات معروضة بالتوقيت المحلي للمطار. لأي استفسار تواصل مع فريق الدعم.
      </p>`);
  }

  private bookingConfirmationHtml(booking: BookingConfirmationInfo): string {
    const ref = booking.bookingReference ?? '—';
    const total = (booking.totalAmount / 100).toFixed(2);
    const bookingUrl = `${this.webAppUrl}/bookings/${booking.id}`;

    return this.layout(`
      <h1 style="margin:0 0 12px;font-size:20px;">تم تأكيد حجزك بنجاح 🎉</h1>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.8;color:#3c4043;">
        شكراً لاختيارك سفريات. تجد تذكرتك الإلكترونية مرفقة بهذه الرسالة بصيغة PDF.
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef4fa;border-radius:12px;margin-bottom:24px;">
        <tr>
          <td style="padding:16px 18px;">
            <div style="font-size:12px;color:#5f6368;">رقم مرجع الحجز (PNR)</div>
            <div style="font-size:22px;font-weight:700;color:#0f4c81;letter-spacing:1px;">${ref}</div>
          </td>
          <td style="padding:16px 18px;text-align:left;">
            <div style="font-size:12px;color:#5f6368;">الإجمالي المدفوع</div>
            <div style="font-size:18px;font-weight:700;">${total} ${booking.currency}</div>
          </td>
        </tr>
      </table>
      <p style="margin:0 0 24px;">${this.button(bookingUrl, 'عرض تفاصيل الحجز')}</p>
      <p style="margin:0;font-size:13px;color:#5f6368;line-height:1.7;">
        احتفظ بالتذكرة المرفقة، وقد تحتاج إلى إبرازها عند تسجيل الوصول. جميع الأوقات
        بالتوقيت المحلي للمطار.
      </p>`);
  }
}
