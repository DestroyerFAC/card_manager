import { describe, expect, it } from 'vitest';
import { localIdQuerySuffix, normalizeLocalId, parseCollectorNumber } from './cardNumber';

describe('normalizeLocalId', () => {
  it.each([
    ['025', '25'],
    ['25', '25'],
    ['tg05', 'TG5'],
    ['SWSH020', 'SWSH20'],
    ['0', '0'],
    ['XY95', 'XY95'],
    ['!', '!'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeLocalId(input)).toBe(expected);
  });
});

describe('parseCollectorNumber', () => {
  it('parses number and total', () => {
    expect(parseCollectorNumber(' 025/165 ')).toEqual({ key: '25', total: 165 });
  });

  it('ignores prefixed totals (TG05/TG30)', () => {
    expect(parseCollectorNumber('TG05/TG30')).toEqual({ key: 'TG5', total: null });
  });

  it('rejects names', () => {
    expect(parseCollectorNumber('pikachu')).toBeNull();
    expect(parseCollectorNumber('')).toBeNull();
  });
});

describe('localIdQuerySuffix', () => {
  it('uses the trailing numeric part', () => {
    expect(localIdQuerySuffix('TG5')).toBe('5');
    expect(localIdQuerySuffix('25')).toBe('25');
    expect(localIdQuerySuffix('SWSH20')).toBe('20');
  });
});
