/** Lowercase, accent-free, punctuation-free form used for fuzzy comparisons. */
export function foldText(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Levenshtein distance with a single rolling row: O(a·b) time, O(min(a,b)) memory.
 * Inputs are card names (< 40 chars), so the quadratic factor is a small constant.
 */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (short.length === 0) return long.length;

  let previous = Array.from({ length: short.length + 1 }, (_, i) => i);
  for (let i = 1; i <= long.length; i++) {
    const current = [i];
    for (let j = 1; j <= short.length; j++) {
      const cost = long[i - 1] === short[j - 1] ? 0 : 1;
      current[j] = Math.min(
        (previous[j] ?? 0) + 1,
        (current[j - 1] ?? 0) + 1,
        (previous[j - 1] ?? 0) + cost,
      );
    }
    previous = current;
  }
  return previous[short.length] ?? long.length;
}

/** 1 = identical, 0 = nothing in common. */
export function similarity(a: string, b: string): number {
  const maxLength = Math.max(a.length, b.length);
  if (maxLength === 0) return 1;
  return 1 - levenshtein(a, b) / maxLength;
}
