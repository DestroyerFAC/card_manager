import { appError, type AppError } from './errors';
import { err, type Result } from './result';

/**
 * Lets a caller stop waiting on a shared promise (e.g. a memoised catalog request) without
 * cancelling the underlying work that other callers still need.
 */
export function abortable<T>(
  promise: Promise<Result<T, AppError>>,
  signal: AbortSignal | undefined,
): Promise<Result<T, AppError>> {
  if (!signal) return promise;
  const aborted = () => err(appError('aborted', 'Requête annulée'));
  if (signal.aborted) return Promise.resolve(aborted());
  return new Promise((resolve) => {
    const onAbort = () => {
      resolve(aborted());
    };
    signal.addEventListener('abort', onAbort, { once: true });
    void promise.then((result) => {
      signal.removeEventListener('abort', onAbort);
      resolve(result);
    });
  });
}
