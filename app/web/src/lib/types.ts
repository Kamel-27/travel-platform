// Shapes mirror docs/api_contract.md exactly (snake_case, minor-unit money,
// local-wall-clock times) — this is the wire format, not a UI-friendly one.
// Map to display shapes in the component that renders them.

export interface Money {
  amount: number;
  currency: string;
}

export interface LocalTime {
  local: string;
  timezone: string;
}

export interface NormalizedSegment {
  marketing_carrier: string;
  operating_carrier: string;
  flight_number: string;
  departing_at: LocalTime;
  arriving_at: LocalTime;
  origin_terminal: string | null;
  destination_terminal: string | null;
}

export interface NormalizedSlice {
  origin: string;
  destination: string;
  duration: string;
  segments: NormalizedSegment[];
}

export interface CancellationPenaltyCondition {
  allowed: boolean;
  penalty: Money | null;
}

export interface NormalizedConditions {
  refund_before_departure?: CancellationPenaltyCondition;
  change_before_departure?: CancellationPenaltyCondition;
}

export interface NormalizedOfferPassenger {
  id: string;
  type: string;
}

export interface NormalizedOffer {
  offer_id: string;
  expires_at: string;
  total: Money;
  airline: { name: string; iata: string; logo_url: string };
  cabin_class: string;
  passenger_identity_documents_required: boolean;
  slices: NormalizedSlice[];
  conditions: NormalizedConditions;
  passengers: NormalizedOfferPassenger[];
}

export type PassengerType = "adult" | "child" | "infant";
export type PassengerTitle = "mr" | "mrs" | "ms" | "miss";
export type PassengerGender = "m" | "f";

export interface PassengerDocument {
  type: string;
  number: string;
  expiry: string;
  nationality: string;
}

export interface PassengerInput {
  type: PassengerType;
  title: PassengerTitle;
  gender: PassengerGender;
  given_name: string;
  family_name: string;
  date_of_birth: string;
  email: string;
  phone_number: string;
  responsible_adult_index?: number;
  document?: PassengerDocument;
}

export interface PassengerRecord extends PassengerInput {
  id: string;
  supplier_passenger_id: string | null;
  responsible_adult_passenger_id: string | null;
}

export interface PassengerRequirements {
  passenger_identity_documents_required: boolean;
  passengers: { supplier_passenger_id: string; type: string }[];
}

export type BookingStatus =
  | "pending"
  | "awaiting_payment"
  | "paid"
  | "confirmed"
  | "order_failed"
  | "cancelled"
  | "failed"
  | "refunded";

export interface BookingSnapshotSegment {
  id: string;
  marketing_carrier: string;
  operating_carrier: string;
  flight_number: string;
  departing_at: LocalTime;
  arriving_at: LocalTime;
  origin_terminal: string | null;
  destination_terminal: string | null;
}

export interface BookingSnapshotSlice {
  id: string;
  origin: string;
  destination: string;
  duration: string;
  segments: BookingSnapshotSegment[];
}

export interface BookingSnapshot {
  id: string;
  supplier_offer_id: string;
  expires_at: string;
  owner_airline_name: string;
  owner_airline_iata: string;
  cabin_class: string;
  conditions: NormalizedConditions;
  slices: BookingSnapshotSlice[];
}

export interface Booking {
  id: string;
  status: BookingStatus;
  supplier: string;
  booking_reference: string | null;
  total_amount: number;
  base_amount: number;
  markup_amount: number;
  currency: string;
  created_at: string;
  updated_at: string;
  snapshot: BookingSnapshot | null;
  passengers: PassengerRecord[];
  passenger_requirements?: PassengerRequirements;
}

export interface CancellationQuote {
  refundable: boolean;
  requires_admin: boolean;
  penalty: Money | null;
  customer_receives: Money | null;
}

export interface CancelBookingResult {
  id: string;
  status: BookingStatus;
  requires_admin: boolean;
  message?: string;
  supplier_refund_amount?: number;
  customer_receives?: Money;
  currency?: string;
}

export interface BookingDocument {
  id: string;
  source: string;
  type: string;
  supplier_document_id: string;
  file_url: string | null;
}

export interface PaymentIntent {
  provider: "paymob";
  payment_token: string;
  iframe_url: string;
  amount: number;
  currency: string;
}

export interface SessionUser {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: string;
}

export interface SessionResponse {
  access_token: string;
  expires_in: number;
  user: SessionUser;
}

export interface Paginated<T> {
  data: T[];
  next_cursor: string | null;
}

// ── Support tickets ─────────────────────────────────────────────────────

export type SupportTicketType =
  | "cancellation"
  | "flight_delay"
  | "name_change"
  | "refund"
  | "other";

export type SupportTicketStatus = "open" | "in_progress" | "resolved";

export interface SupportTicket {
  id: string;
  type: SupportTicketType;
  booking_reference: string | null;
  description: string;
  status: SupportTicketStatus;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminSupportTicket extends SupportTicket {
  user_id: string;
  user_email: string | null;
}

// ── Admin surface (api_contract.md §7, technical_admin only) ────────────

export interface AdminListMeta {
  total: number;
  limit: number;
  offset: number;
}

export interface AdminBooking {
  id: string;
  user_id: string;
  user_email: string | null;
  status: BookingStatus;
  booking_reference: string | null;
  supplier_order_id: string | null;
  base_amount: number;
  markup_amount: number;
  total_amount: number;
  currency: string;
  payment_id: string | null;
  payment_status: string | null;
  cancellation_requested_at: string | null;
  cancellation_request_reason: string | null;
  created_at: string;
  updated_at: string;
}

export type RefundStatus = "pending" | "succeeded" | "failed";

export interface AdminRefund {
  id: string;
  payment_id: string;
  booking_id: string | null;
  booking_reference: string | null;
  provider_refund_id: string | null;
  amount: number;
  currency: string;
  supplier_refund_amount: number | null;
  status: RefundStatus;
  reason: string | null;
  initiated_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminUser {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: string;
  is_active: boolean;
  email_verified_at: string | null;
  created_at: string;
}

export interface MarkupRule {
  id: string;
  type: "percentage" | "fixed";
  value: number;
  is_active: boolean;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLogEntry {
  id: string;
  actor_user_id: string;
  actor_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface AdminMetrics {
  bookings: {
    total: number;
    by_status: Partial<Record<BookingStatus, number>>;
    pending_cancellation_requests: number;
  };
  payments: {
    currency: string;
    charged_amount: number;
    refunded_amount: number;
    net_amount: number;
  }[];
  refunds: { pending_count: number; failed_count: number };
  users: { total: number; active: number };
  ledger?: {
    summary: {
      currency: string;
      net_position: number;
      duffel_wallet_estimate: number;
    }[];
  };
}

export type LedgerEntryType =
  | "customer_payment"
  | "gateway_refund"
  | "supplier_charge"
  | "supplier_refund"
  | "adjustment";

export interface AdminLedgerEntry {
  id: string;
  entry_type: LedgerEntryType;
  amount: number;
  currency: string;
  supplier: string | null;
  payment_id: string | null;
  booking_id: string | null;
  booking_reference: string | null;
  refund_id: string | null;
  note: string | null;
  created_at: string;
}

export interface DuffelHealth {
  duffel: {
    configured: boolean;
    requests_last_hour: number;
    errors_last_hour: number;
    recent_error_rate: number;
  };
  webhooks: {
    unprocessed_count: number;
    oldest_unprocessed_age_seconds: number;
  };
  queues: Record<string, { failed: number }>;
  bookings_stuck_in_paid: number;
}
