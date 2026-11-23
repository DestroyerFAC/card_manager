import { describe, expect, it } from 'vitest';
import type { CardSummary, SetSummary } from '../../providers/cards/types';
import { nameScore, rankCandidates } from './score';

const card = (id: string, name: string, localId: string, setId: string): CardSummary => ({
  id,
  tcg: 'pokemon',
  name,
  localId,
  setId,
  image: null,
});

const set = (id: string, officialCount: number): SetSummary => ({
  id,
  name: id,
  logoUrl: null,
  symbolUrl: null,
  officialCount,
  totalCount: officialCount,
});

const setsById = new Map([
  ['sv03.5', set('sv03.5', 165)],
  ['base1', set('base1', 102)],
  ['sv01', set('sv01', 198)],
]);

const candidates = [
  card('base1-58', 'Pikachu', '58', 'base1'),
  card('sv03.5-025', 'Pikachu', '025', 'sv03.5'),
  card('sv01-025', 'Terracool', '025', 'sv01'),
  card('sv03.5-125', 'Élektek', '125', 'sv03.5'),
];

describe('nameScore', () => {
  it('is accent and case insensitive', () => {
    expect(nameScore('ELEKTEK', 'Élektek')).toBe(1);
  });

  it('rewards a full name inside a noisy reading', () => {
    expect(nameScore('ee Pikachu ww', 'Pikachu')).toBeGreaterThan(0.9);
  });

  it('degrades gracefully with OCR typos', () => {
    expect(nameScore('Pikachv', 'Pikachu')).toBeGreaterThan(0.8);
    expect(nameScore('Pikachu', 'Terracool')).toBeLessThan(0.3);
  });
});

describe('rankCandidates', () => {
  it('ranks name + number + set size first', () => {
    const ranked = rankCandidates(
      { name: 'Pikachu', number: { key: '25', total: 165 } },
      candidates,
      setsById,
    );
    expect(ranked[0]?.card.id).toBe('sv03.5-025');
    expect(ranked[0]?.numberMatches).toBe(true);
  });

  it('uses the number alone when the name is unreadable', () => {
    const ranked = rankCandidates(
      { name: null, number: { key: '25', total: 198 } },
      candidates,
      setsById,
    );
    expect(ranked[0]?.card.id).toBe('sv01-025');
  });

  it('filters weak candidates and respects the limit', () => {
    const ranked = rankCandidates({ name: 'Pikachu', number: null }, candidates, setsById, 1);
    expect(ranked).toHaveLength(1);
    expect(ranked[0]?.card.name).toBe('Pikachu');
    const none = rankCandidates({ name: 'Zzzzzz', number: null }, candidates, setsById);
    expect(none).toEqual([]);
  });

  it('skips duplicated cards coming from merged queries', () => {
    const ranked = rankCandidates(
      { name: 'Pikachu', number: null },
      [...candidates, ...candidates],
      setsById,
      10,
    );
    expect(new Set(ranked.map((c) => c.card.id)).size).toBe(ranked.length);
  });

  it('returns nothing for an empty reading', () => {
    expect(rankCandidates({ name: null, number: null }, candidates, setsById)).toEqual([]);
  });

  it('is sorted by descending score', () => {
    const ranked = rankCandidates(
      { name: 'Pikachu', number: { key: '25', total: 165 } },
      candidates,
      setsById,
    );
    const scores = ranked.map((c) => c.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });
});
