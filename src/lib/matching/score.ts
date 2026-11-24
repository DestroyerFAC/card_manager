import { normalizeLocalId } from '../cardNumber';
import type { OcrReading } from '../ocr/normalize';
import { foldText, similarity } from '../text';
import type { CardSummary, SetSummary } from '../../providers/cards/types';

export interface ScoredCandidate {
  readonly card: CardSummary;
  readonly set: SetSummary | undefined;
  readonly score: number;
  readonly numberMatches: boolean;
}

export const MIN_SCORE = 0.35;

/**
 * Name similarity tolerant to OCR garbage around the name: if the card name appears whole inside
 * the reading, it is a near-certain match regardless of the extra characters.
 */
export function nameScore(reading: string, cardName: string): number {
  const a = foldText(reading);
  const b = foldText(cardName);
  if (a.length === 0 || b.length === 0) return 0;
  if (a === b) return 1;
  if (b.length >= 4 && ` ${a} `.includes(` ${b} `)) return 0.95;
  return similarity(a, b);
}

export function scoreCandidate(
  reading: OcrReading,
  card: CardSummary,
  set: SetSummary | undefined,
): { score: number; numberMatches: boolean } {
  const numberMatches =
    reading.number !== null && normalizeLocalId(card.localId) === reading.number.key;
  const totalMatches =
    reading.number?.total != null &&
    set?.officialCount != null &&
    set.officialCount === reading.number.total;
  const name = reading.name ? nameScore(reading.name, card.name) : 0;

  let score: number;
  if (reading.name && reading.number) {
    score = 0.55 * name + 0.3 * (numberMatches ? 1 : 0) + 0.15 * (totalMatches ? 1 : 0);
  } else if (reading.name) {
    score = name;
  } else if (reading.number) {
    score = 0.7 * (numberMatches ? 1 : 0) + 0.3 * (totalMatches ? 1 : 0);
  } else {
    score = 0;
  }
  return { score, numberMatches };
}

/**
 * Ranks candidates in O(n·k) (k = limit, small constant) with a bounded insertion list instead of
 * sorting the whole array. Duplicated card ids (union of several queries) are skipped in O(1).
 */
export function rankCandidates(
  reading: OcrReading,
  cards: readonly CardSummary[],
  setsById: ReadonlyMap<string, SetSummary>,
  limit = 5,
): ScoredCandidate[] {
  const top: ScoredCandidate[] = [];
  const seen = new Set<string>();

  for (const card of cards) {
    if (seen.has(card.id)) continue;
    seen.add(card.id);

    const set = setsById.get(card.setId);
    const { score, numberMatches } = scoreCandidate(reading, card, set);
    if (score < MIN_SCORE) continue;
    if (top.length === limit && score <= (top[top.length - 1]?.score ?? 0)) continue;

    const candidate: ScoredCandidate = { card, set, score, numberMatches };
    let index = top.findIndex((existing) => score > existing.score);
    if (index === -1) index = top.length;
    top.splice(index, 0, candidate);
    if (top.length > limit) top.pop();
  }
  return top;
}
