import { Injectable, InternalServerErrorException } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';
import { existsSync } from 'fs';
import { join } from 'path';

import { Booking } from '../entities/booking.entity';
import { FlightOfferSnapshot } from '../entities/flight-offer-snapshot.entity';
import { Passenger } from '../entities/passenger.entity';
import { Document } from '../entities/document.entity';
import { Segment } from '../entities/segment.entity';

// Brand palette (mirrors the web app's primary/on-surface tokens).
const BRAND = '#0f4c81';
const BRAND_LIGHT = '#eef4fa';
const INK = '#1c1b1f';
const MUTED = '#5f6368';
const RULE = '#d5dbe3';

// Registered font names. Noto Naskh Arabic ships in assets/fonts (OFL 1.1);
// Helvetica is a pdfkit built-in. Arabic MUST go through the Noto face —
// Helvetica has no Arabic glyphs and renders tofu.
const F_LATIN = 'Helvetica';
const F_LATIN_BOLD = 'Helvetica-Bold';
const F_ARABIC = 'NotoNaskh';
const F_ARABIC_BOLD = 'NotoNaskh-Bold';

const PAGE_MARGIN = 40;

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/**
 * Segment times are stored as `timestamp` WITHOUT time zone (airport local
 * wall clock, api_contract.md §0 "never UTC-normalize"). node-postgres parses
 * them into a Date in *server* local time, so the local getters recover the
 * original wall-clock digits; toISOString() would shift them by the server's
 * UTC offset.
 */
function formatWallClock(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${hh}:${mm}`;
}

/** Minor units -> display string. All currently sold currencies use 2 decimals. */
function formatMoney(minor: number, currency: string): string {
  return `${(minor / 100).toFixed(2)} ${currency}`;
}

/**
 * Renders the itinerary/e-ticket PDF from data already confirmed with
 * Duffel. Duffel only ever returns a ticket *number* per passenger
 * (documents.unique_identifier), never a ticket PDF itself, so this is our
 * own rendering rather than a pass-through of a supplier-provided file.
 */
@Injectable()
export class TicketPdfService {
  private readonly fontDir = join(process.cwd(), 'assets', 'fonts');

  async generate(
    booking: Booking,
    snapshot: FlightOfferSnapshot | null,
    passengers: Passenger[],
    documents: Document[],
  ): Promise<Buffer> {
    const regular = join(this.fontDir, 'NotoNaskhArabic-Regular.ttf');
    const bold = join(this.fontDir, 'NotoNaskhArabic-Bold.ttf');
    if (!existsSync(regular) || !existsSync(bold)) {
      throw new InternalServerErrorException(
        `Arabic PDF fonts missing under ${this.fontDir} — expected NotoNaskhArabic-Regular.ttf / -Bold.ttf.`,
      );
    }

    const qrPng = await QRCode.toBuffer(
      `SAFARIYAT|PNR:${booking.bookingReference ?? 'N/A'}|ID:${booking.id}`,
      { type: 'png', width: 220, margin: 0 },
    );

    const doc = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN });
    doc.registerFont(F_ARABIC, regular);
    doc.registerFont(F_ARABIC_BOLD, bold);

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    const done = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    const pageWidth = doc.page.width;
    const contentWidth = pageWidth - PAGE_MARGIN * 2;

    // ── Header band ──────────────────────────────────────────────────────
    doc.rect(0, 0, pageWidth, 96).fill(BRAND);
    doc.fillColor('#ffffff').font(F_LATIN_BOLD).fontSize(24);
    doc.text('Safariyat', PAGE_MARGIN, 26, { lineBreak: false });
    doc.font(F_LATIN).fontSize(10).fillColor('#cfe0f0');
    doc.text('E-Ticket / Itinerary Receipt', PAGE_MARGIN, 58);
    // Arabic brand line — pure-Arabic run so fontkit shapes it correctly.
    doc.font(F_ARABIC_BOLD).fontSize(15).fillColor('#ffffff');
    // NB: stick to glyphs Noto Naskh Arabic actually has — em-dash renders as tofu.
    doc.text('سفريات . تذكرة السفر الإلكترونية', PAGE_MARGIN, 30, {
      width: contentWidth,
      align: 'right',
      features: ['rtla'],
    });
    doc.font(F_ARABIC).fontSize(9).fillColor('#cfe0f0');
    doc.text('إيصال الرحلة والتذكرة الإلكترونية', PAGE_MARGIN, 60, {
      width: contentWidth,
      align: 'right',
      features: ['rtla'],
    });

    // ── Reference block + QR ─────────────────────────────────────────────
    let y = 116;
    const qrSize = 88;
    doc
      .roundedRect(PAGE_MARGIN, y, contentWidth - qrSize - 16, qrSize, 6)
      .fill(BRAND_LIGHT);
    doc.image(qrPng, PAGE_MARGIN + contentWidth - qrSize, y, {
      width: qrSize,
      height: qrSize,
    });

    const refBoxX = PAGE_MARGIN + 14;
    doc.fillColor(MUTED).font(F_LATIN).fontSize(8);
    doc.text('BOOKING REFERENCE (PNR)', refBoxX, y + 12);
    doc.fillColor(INK).font(F_LATIN_BOLD).fontSize(20);
    doc.text(booking.bookingReference ?? 'N/A', refBoxX, y + 24);

    const metaY = y + 58;
    const metaCol = (contentWidth - qrSize - 16 - 28) / 3;
    const meta: [string, string][] = [
      ['AIRLINE', snapshot?.ownerAirlineName ?? '—'],
      ['CABIN', (snapshot?.cabinClass ?? '—').toUpperCase()],
      ['STATUS', booking.status.toUpperCase()],
    ];
    meta.forEach(([label, value], i) => {
      const x = refBoxX + i * metaCol;
      doc.fillColor(MUTED).font(F_LATIN).fontSize(7);
      doc.text(label, x, metaY);
      doc.fillColor(INK).font(F_LATIN_BOLD).fontSize(10);
      doc.text(value, x, metaY + 10, { width: metaCol - 8, ellipsis: true });
    });

    y += qrSize + 24;

    // ── Itinerary ────────────────────────────────────────────────────────
    if (snapshot?.slices?.length) {
      y = this.sectionTitle(
        doc,
        'Flight itinerary',
        'مسار الرحلة',
        y,
        contentWidth,
      );

      snapshot.slices.forEach((slice, idx) => {
        // Helvetica's WinAnsi encoding has no "→" — use a plain hyphen route.
        const heading = `${idx === 0 ? 'Outbound' : 'Return'}   ${slice.origin} - ${slice.destination}`;
        doc.fillColor(BRAND).font(F_LATIN_BOLD).fontSize(11);
        doc.text(heading, PAGE_MARGIN, y);
        y += 18;

        y = this.segmentTable(
          doc,
          slice.segments ?? [],
          slice.origin,
          slice.destination,
          y,
          contentWidth,
        );
        y += 10;
      });
    }

    // ── Passengers & tickets ─────────────────────────────────────────────
    y = this.sectionTitle(
      doc,
      'Passengers & tickets',
      'المسافرون والتذاكر',
      y,
      contentWidth,
    );
    y = this.passengerTable(doc, passengers, documents, y, contentWidth);
    y += 14;

    // ── Payment ──────────────────────────────────────────────────────────
    doc.roundedRect(PAGE_MARGIN, y, contentWidth, 34, 6).fill(BRAND_LIGHT);
    doc.fillColor(INK).font(F_LATIN_BOLD).fontSize(11);
    doc.text('Total paid', PAGE_MARGIN + 14, y + 11, { lineBreak: false });
    doc.text(
      formatMoney(booking.totalAmount, booking.currency),
      PAGE_MARGIN,
      y + 11,
      { width: contentWidth - 14, align: 'right' },
    );
    y += 52;

    // ── Footer notes ─────────────────────────────────────────────────────
    doc.fillColor(MUTED).font(F_LATIN).fontSize(8);
    doc.text(
      'This document is an itinerary receipt generated by Safariyat and does not replace any airline-issued travel document requirements. All times shown are airport local times.',
      PAGE_MARGIN,
      y,
      { width: contentWidth },
    );
    y = doc.y + 6;
    doc.font(F_ARABIC).fontSize(9);
    doc.text(
      'هذه الوثيقة إيصال رحلة صادر عن منصة سفريات ولا تغني عن متطلبات وثائق السفر التي تحددها شركة الطيران. جميع الأوقات المعروضة هي بالتوقيت المحلي للمطار.',
      PAGE_MARGIN,
      y,
      { width: contentWidth, align: 'right', features: ['rtla'] },
    );

    doc.fillColor(MUTED).font(F_LATIN).fontSize(8);
    doc.text(
      `safariyat.live  ·  Booking ID ${booking.id}`,
      PAGE_MARGIN,
      doc.page.height - PAGE_MARGIN - 12,
      { width: contentWidth, align: 'center' },
    );

    doc.end();
    return done;
  }

  /** Bilingual section title with a rule underneath; returns the next y. */
  private sectionTitle(
    doc: PDFKit.PDFDocument,
    en: string,
    ar: string,
    y: number,
    contentWidth: number,
  ): number {
    doc.fillColor(INK).font(F_LATIN_BOLD).fontSize(13);
    doc.text(en, PAGE_MARGIN, y, { lineBreak: false });
    doc.font(F_ARABIC_BOLD).fontSize(11);
    doc.text(ar, PAGE_MARGIN, y + 1, {
      width: contentWidth,
      align: 'right',
      features: ['rtla'],
    });
    y += 20;
    doc
      .moveTo(PAGE_MARGIN, y)
      .lineTo(PAGE_MARGIN + contentWidth, y)
      .lineWidth(0.8)
      .stroke(RULE);
    return y + 10;
  }

  /** Renders one slice's segments as a table; returns the next y. */
  private segmentTable(
    doc: PDFKit.PDFDocument,
    segments: Segment[],
    origin: string,
    destination: string,
    y: number,
    contentWidth: number,
  ): number {
    const cols = [
      { label: 'FLIGHT', w: 0.14 },
      { label: 'FROM', w: 0.18 },
      { label: 'DEPARTURE', w: 0.25 },
      { label: 'TO', w: 0.18 },
      { label: 'ARRIVAL', w: 0.25 },
    ];

    let x = PAGE_MARGIN;
    doc.font(F_LATIN).fontSize(7).fillColor(MUTED);
    for (const col of cols) {
      doc.text(col.label, x, y, { width: col.w * contentWidth });
      x += col.w * contentWidth;
    }
    y += 12;

    // Multi-segment slices only know the slice-level endpoints (connection
    // airports are not stored per segment), so intermediate stops show as
    // the slice endpoints with their own times.
    for (const seg of segments) {
      const cells = [
        `${seg.marketingCarrier} ${seg.flightNumber}`,
        seg.originTerminal ? `${origin} T${seg.originTerminal}` : origin,
        formatWallClock(seg.departingAtLocal),
        seg.destinationTerminal
          ? `${destination} T${seg.destinationTerminal}`
          : destination,
        formatWallClock(seg.arrivingAtLocal),
      ];

      x = PAGE_MARGIN;
      doc.font(F_LATIN_BOLD).fontSize(9).fillColor(INK);
      cells.forEach((cell, i) => {
        doc.font(i === 0 ? F_LATIN_BOLD : F_LATIN).fontSize(9);
        doc.text(cell, x, y, { width: cols[i].w * contentWidth - 6 });
        x += cols[i].w * contentWidth;
      });
      y += 16;
      doc
        .moveTo(PAGE_MARGIN, y - 3)
        .lineTo(PAGE_MARGIN + contentWidth, y - 3)
        .lineWidth(0.4)
        .stroke(RULE);
    }

    return y;
  }

  /** Passenger name + type + issued ticket number table; returns next y. */
  private passengerTable(
    doc: PDFKit.PDFDocument,
    passengers: Passenger[],
    documents: Document[],
    y: number,
    contentWidth: number,
  ): number {
    const cols = [
      { label: 'PASSENGER', w: 0.46 },
      { label: 'TYPE', w: 0.14 },
      { label: 'TICKET NUMBER', w: 0.4 },
    ];

    let x = PAGE_MARGIN;
    doc.font(F_LATIN).fontSize(7).fillColor(MUTED);
    for (const col of cols) {
      doc.text(col.label, x, y, { width: col.w * contentWidth });
      x += col.w * contentWidth;
    }
    y += 12;

    for (const p of passengers) {
      const ticket = documents.find((d) =>
        d.supplierPassengerIds?.includes(p.supplierPassengerId ?? ''),
      );
      const cells = [
        `${p.title.toUpperCase()} ${p.givenName} ${p.familyName}`,
        p.type.toUpperCase(),
        ticket?.uniqueIdentifier ?? '—',
      ];

      x = PAGE_MARGIN;
      cells.forEach((cell, i) => {
        doc
          .font(i === 0 ? F_LATIN_BOLD : F_LATIN)
          .fontSize(9)
          .fillColor(INK);
        doc.text(cell, x, y, { width: cols[i].w * contentWidth - 6 });
        x += cols[i].w * contentWidth;
      });
      y += 16;
      doc
        .moveTo(PAGE_MARGIN, y - 3)
        .lineTo(PAGE_MARGIN + contentWidth, y - 3)
        .lineWidth(0.4)
        .stroke(RULE);
    }

    return y;
  }
}
