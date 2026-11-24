import { appError, type AppError } from '../../lib/errors';
import { rankCandidates, type ScoredCandidate } from '../../lib/matching/score';
import type { OcrReading } from '../../lib/ocr/normalize';
import { err, ok, type Result } from '../../lib/result';
import { foldText } from '../../lib/text';
import type { CardProvider, CardSummary } from '../../providers/cards/types';

/**
 * TCGdex name search is a substring match: OCR noise ("Pikachu PVv") would match nothing, so we
 * query with the longest clean word and let local scoring use the full reading.
 */
export function nameQueryFromReading(name: string): string | null {
  const words = foldText(name)
    .split(' ')
    .filter((word) => word.length >= 3);
  const longest = words.reduce<string | null>(
    (best, word) => (best === null || word.length > best.length ? word : best),
    null,
  );
  if (longest === null) return null;
  // Use the original (accented) spelling of that word: the API matches on French names.
  const original = name.split(/[\s-]+/).find((word) => foldText(word) === longest);
  return original ?? longest;
}

export async function findCandidates(
  reading: OcrReading,
  provider: CardProvider,
  signal: AbortSignal,
): Promise<Result<ScoredCandidate[], AppError>> {
  const nameQuery = reading.name ? nameQueryFromReading(reading.name) : null;
  if (!reading.number && !nameQuery) {
    return err(appError('validation', 'Texte illisible : cadrez la carte et réessayez.'));
  }

  const [byNumber, byName, sets] = await Promise.all([
    reading.number ? provider.searchByNumber(reading.number.key, { signal }) : null,
    nameQuery ? provider.searchByName(nameQuery, 1, { signal }) : null,
    provider.listSets({ signal }),
  ]);

  const pool: CardSummary[] = [];
  let firstError: AppError | null = null;
  if (byNumber) {
    if (byNumber.ok) pool.push(...byNumber.value);
    else firstError = byNumber.error;
  }
  if (byName) {
    if (byName.ok) pool.push(...byName.value.cards);
    else firstError ??= byName.error;
  }
  if (pool.length === 0 && firstError) return err(firstError);

  const setsById = new Map(sets.ok ? sets.value.map((set) => [set.id, set]) : []);
  return ok(rankCandidates(reading, pool, setsById));
}
