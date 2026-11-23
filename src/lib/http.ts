import type { z } from 'zod';
import { appError, type AppError } from './errors';
import { err, ok, type Result } from './result';

export interface FetchJsonOptions {
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
  /** Extra attempts for transient failures (network, 429, 5xx). GET is idempotent. */
  readonly retries?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRIES = 2;
const BASE_BACKOFF_MS = 400;

function isTransient(error: AppError): boolean {
  if (error.kind === 'network') return true;
  return error.kind === 'http' && (error.status === 429 || (error.status ?? 0) >= 500);
}

/** Resolves after `ms`, or early (false) if the caller aborts in the meantime. */
function wait(ms: number, signal: AbortSignal | undefined): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve(false);
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      resolve(false);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve(true);
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

async function attempt<S extends z.ZodType>(
  url: string,
  schema: S,
  options: FetchJsonOptions,
): Promise<Result<z.infer<S>, AppError>> {
  const timeout = AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;

  let response: Response;
  try {
    response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  } catch {
    if (options.signal?.aborted) return err(appError('aborted', 'Requête annulée'));
    if (timeout.aborted) return err(appError('network', 'Le serveur met trop de temps à répondre'));
    return err(appError('network', 'Connexion impossible. Vérifiez votre réseau.'));
  }

  if (response.status === 404) return err(appError('not_found', 'Ressource introuvable', 404));
  if (!response.ok) {
    return err(appError('http', `Erreur du serveur (${response.status})`, response.status));
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    if (options.signal?.aborted) return err(appError('aborted', 'Requête annulée'));
    return err(appError('parse', 'Réponse illisible du serveur'));
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return err(appError('parse', 'Format de réponse inattendu'));
  return ok(parsed.data);
}

/**
 * Network boundary: every remote payload is validated with zod before reaching the app, and
 * every failure mode becomes a typed AppError instead of a thrown exception. Transient failures
 * are retried with exponential backoff (mobile networks drop requests routinely).
 */
export async function fetchJson<S extends z.ZodType>(
  url: string,
  schema: S,
  options: FetchJsonOptions = {},
): Promise<Result<z.infer<S>, AppError>> {
  const retries = options.retries ?? DEFAULT_RETRIES;
  let result = await attempt(url, schema, options);
  for (let i = 0; i < retries && !result.ok && isTransient(result.error); i++) {
    if (!(await wait(BASE_BACKOFF_MS * 2 ** i, options.signal))) {
      return err(appError('aborted', 'Requête annulée'));
    }
    result = await attempt(url, schema, options);
  }
  return result;
}
