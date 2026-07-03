/**
 * Standardized error envelope per docs/api_contract.md §0.
 * Every error response from the API uses this shape.
 */
export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    details: Record<string, unknown>;
  };
}

/**
 * Well-known error codes used across the API.
 * Matches api_contract.md §0 code list.
 */
export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNAUTHENTICATED = 'UNAUTHENTICATED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  TOKEN_INVALID = 'TOKEN_INVALID',
  OFFER_EXPIRED = 'OFFER_EXPIRED',
  ILLEGAL_TRANSITION = 'ILLEGAL_TRANSITION',
  PAYMENT_REQUIRED = 'PAYMENT_REQUIRED',
  SUPPLIER_UNAVAILABLE = 'SUPPLIER_UNAVAILABLE',
  RATE_LIMITED = 'RATE_LIMITED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}
