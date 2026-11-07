export type ErrorCode =
  | 'UNAUTHORIZED' | 'NOT_FOUND' | 'INVALID' | 'LOCKED' | 'UNKNOWN_SLOT' | 'UNKNOWN_CLAIM' | 'READONLY' | 'NO_EVENT'
  | 'NETWORK';

export const HTTP_STATUS: Record<ErrorCode, number> = {
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  INVALID: 400,
  LOCKED: 409,
  UNKNOWN_SLOT: 400,
  UNKNOWN_CLAIM: 400,
  READONLY: 403,
  NO_EVENT: 404,
  NETWORK: 502,
};

export class GobbleError extends Error {
  constructor(public code: ErrorCode, message: string) {
    super(message);
    this.name = 'GobbleError';
  }
}
