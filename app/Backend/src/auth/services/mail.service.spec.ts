/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { MailService } from './mail.service';
import { ConfigService } from '@nestjs/config';

/** Builds a MailService with a stub ConfigService for the given env values. */
function makeService(env: Record<string, string | undefined>): MailService {
  const config = {
    getOrThrow: (key: string): string => {
      const val = env[key];
      if (val === undefined) throw new Error(`Missing config: ${key}`);
      return val;
    },
    get: (key: string): string | undefined => env[key],
  } as unknown as ConfigService;
  return new MailService(config);
}

/** A fetch mock that resolves to a Response-like object. */
function okFetch(): jest.Mock {
  return jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: () => Promise.resolve(''),
  });
}

describe('MailService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  describe('unconfigured (no RESEND_API_KEY)', () => {
    it('does not hit the network for a magic link', async () => {
      const fetchMock = jest.fn();
      global.fetch = fetchMock;

      const service = makeService({
        WEB_APP_URL: 'http://localhost:3000',
        RESEND_API_KEY: '',
      });

      await service.sendMagicLink('user@example.com', 'raw-token');

      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('configured (RESEND_API_KEY set)', () => {
    it('POSTs the magic link to the Resend API with a bearer token', async () => {
      const fetchMock = okFetch();
      global.fetch = fetchMock;

      const service = makeService({
        WEB_APP_URL: 'https://www.safariyat.live',
        RESEND_API_KEY: 're_test_key',
        MAIL_FROM: 'Safariyat <no-reply@safariyat.live>',
      });

      await service.sendMagicLink('user@example.com', 'raw/token+value');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://api.resend.com/emails');
      expect(init.method).toBe('POST');
      expect(init.headers.Authorization).toBe('Bearer re_test_key');

      const body = JSON.parse(init.body);
      expect(body.from).toBe('Safariyat <no-reply@safariyat.live>');
      expect(body.to).toEqual(['user@example.com']);
      // Token must be URL-encoded inside the verification link
      expect(body.html).toContain('raw%2Ftoken%2Bvalue');
    });

    it('attaches the PDF as base64 on a booking confirmation', async () => {
      const fetchMock = okFetch();
      global.fetch = fetchMock;

      const service = makeService({
        WEB_APP_URL: 'https://www.safariyat.live',
        RESEND_API_KEY: 're_test_key',
      });

      const pdf = Buffer.from('%PDF-1.7 hello');
      await service.sendBookingConfirmation(
        'user@example.com',
        {
          id: 'b1',
          bookingReference: 'ABC123',
          totalAmount: 105000,
          currency: 'USD',
        },
        pdf,
      );

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.attachments).toHaveLength(1);
      expect(body.attachments[0].filename).toBe('safariyat-ticket-ABC123.pdf');
      expect(body.attachments[0].content).toBe(pdf.toString('base64'));
    });

    it('never throws when the transport fails', async () => {
      const fetchMock = jest.fn().mockRejectedValue(new Error('network down'));
      global.fetch = fetchMock;

      const service = makeService({
        WEB_APP_URL: 'https://www.safariyat.live',
        RESEND_API_KEY: 're_test_key',
      });

      await expect(
        service.sendMagicLink('user@example.com', 'raw-token'),
      ).resolves.toBeUndefined();
    });

    it('never throws when the API returns a non-2xx status', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: () => Promise.resolve('domain not verified'),
      });
      global.fetch = fetchMock;

      const service = makeService({
        WEB_APP_URL: 'https://www.safariyat.live',
        RESEND_API_KEY: 're_test_key',
      });

      await expect(
        service.sendMagicLink('user@example.com', 'raw-token'),
      ).resolves.toBeUndefined();
    });
  });
});
