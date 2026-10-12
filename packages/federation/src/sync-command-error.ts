export type SyncCommandErrorCode = 'INVALID_REQUEST' | 'INVALID_RESPONSE' | 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'OPERATION_CONFLICT' | 'CHANGED' | 'TOO_LARGE' | 'RATE_LIMITED' | 'UNAVAILABLE';
export class SyncCommandError extends Error {
  constructor(public readonly code: SyncCommandErrorCode, message: string, public readonly status?: number) { super(message); this.name = 'SyncCommandError'; }
}
