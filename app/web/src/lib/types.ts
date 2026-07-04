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
