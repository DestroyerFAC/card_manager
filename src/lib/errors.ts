export type AppErrorKind =
  | 'network'
  | 'http'
  | 'parse'
  | 'aborted'
  | 'not_found'
  | 'auth'
  | 'validation'
  | 'unavailable'
  | 'unknown';

export interface AppError {
  readonly kind: AppErrorKind;
  /** User-facing French message: never contains raw server payloads. */
  readonly message: string;
  readonly status?: number;
}

export const appError = (kind: AppErrorKind, message: string, status?: number): AppError =>
  status === undefined ? { kind, message } : { kind, message, status };

export const isAbort = (error: AppError): boolean => error.kind === 'aborted';

export function describeUnknown(cause: unknown): string {
  if (cause instanceof Error) return cause.message;
  if (typeof cause === 'string') return cause;
  return 'Erreur inconnue';
}
