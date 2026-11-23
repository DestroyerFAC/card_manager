import type { z } from 'zod';
import { appError, type AppError } from './errors';
import { err, ok, type Result } from './result';

export interface FetchJsonOptions {
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Network boundary: every remote payload is validated with zod before reaching the app, and
 * every failure mode becomes a typed AppError instead of a thrown exception.
 */
export async function fetchJson<S extends z.ZodType>(
  url: string,
  schema: S,
  options: FetchJsonOptions = {},
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
