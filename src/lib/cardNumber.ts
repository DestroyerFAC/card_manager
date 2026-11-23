export interface CollectorNumber {
  /** Canonical key: uppercase, no leading zeros ("025" → "25", "tg05" → "TG5"). */
  readonly key: string;
  /** Set size printed after the slash ("025/165" → 165), if any. */
  readonly total: number | null;
}

const LOCAL_ID_PATTERN = /^([A-Z]*)0*(\d+)([A-Z]*)$/;

/** Canonical form used to compare collector numbers coming from OCR, users and the API. */
export function normalizeLocalId(localId: string): string {
  const compact = localId.toUpperCase().replace(/\s+/g, '');
  const match = LOCAL_ID_PATTERN.exec(compact);
  if (!match) return compact;
  const [, prefix = '', digits = '', suffix = ''] = match;
  return `${prefix}${digits}${suffix}`;
}

/** Parses "25", "025/165", "TG05", "SWSH020" typed by a user. Returns null if not a number. */
export function parseCollectorNumber(input: string): CollectorNumber | null {
  const compact = input.trim().toUpperCase().replace(/\s+/g, '');
  const match = /^([A-Z]{0,5}\d{1,4}[A-Z]?)(?:\/([A-Z]{0,4})(\d{1,4}))?$/.exec(compact);
  if (!match?.[1]) return null;
  const total = match[3] && !match[2] ? Number.parseInt(match[3], 10) : null;
  return { key: normalizeLocalId(match[1]), total: total && total > 0 ? total : null };
}

/**
 * TCGdex filters `localId` by substring and its strict `eq:` filter does not work on that field,
 * so we query the shortest unambiguous suffix and filter exact matches client-side.
 */
export function localIdQuerySuffix(key: string): string {
  const match = /(\d+)[A-Z]*$/.exec(key);
  return match?.[0] ?? key;
}
