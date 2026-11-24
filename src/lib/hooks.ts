import { useCallback, useEffect, useEffectEvent, useState } from 'react';
import type { AppError } from './errors';
import type { Result } from './result';

export type AsyncState<T> =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'success'; readonly data: T }
  | { readonly status: 'error'; readonly error: AppError };

type Settled<T> = { readonly token: string; readonly result: Result<T, AppError> };

/**
 * Runs `load` whenever `key` changes, aborting the previous request (no stale response can
 * overwrite a newer one). `key === null` means "nothing to load". Loading is derived from the
 * key rather than set synchronously, so a render never shows the previous key's data.
 */
export function useAsyncResult<T>(
  key: string | null,
  load: (signal: AbortSignal) => Promise<Result<T, AppError>>,
): { state: AsyncState<T>; reload: () => void } {
  const [nonce, setNonce] = useState(0);
  const [settled, setSettled] = useState<Settled<T> | null>(null);
  const runLoad = useEffectEvent(load);
  const token = key === null ? null : `${nonce}:${key}`;

  useEffect(() => {
    if (token === null) return;
    const controller = new AbortController();
    void runLoad(controller.signal).then((result) => {
      if (!controller.signal.aborted) setSettled({ token, result });
    });
    return () => {
      controller.abort();
    };
  }, [token]);

  const reload = useCallback(() => {
    setNonce((n) => n + 1);
  }, []);

  let state: AsyncState<T>;
  if (token === null) state = { status: 'idle' };
  else if (settled?.token !== token) state = { status: 'loading' };
  else if (settled.result.ok) state = { status: 'success', data: settled.result.value };
  else state = { status: 'error', error: settled.result.error };

  return { state, reload };
}

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebounced(value);
    }, delayMs);
    return () => {
      window.clearTimeout(timer);
    };
  }, [value, delayMs]);
  return debounced;
}
