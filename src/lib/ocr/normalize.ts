import { parseCollectorNumber, type CollectorNumber } from '../cardNumber';
import { foldText } from '../text';

export interface OcrReading {
  readonly name: string | null;
  readonly number: CollectorNumber | null;
}

/** Printed labels around the name ("De base", "PV 60", "Niveau 1"…) that are never part of it. */
const NAME_NOISE_TOKENS = new Set([
  'de',
  'base',
  'niveau',
  'stade',
  'pv',
  'hp',
  'basic',
  'stage',
  'evolution',
  'evolue',
  'restaure',
  'pokemon',
  'dresseur',
  'trainer',
  'objet',
  'supporter',
  'energie',
]);

/** Mechanic suffixes printed next to the name that matter for matching. */
const NAME_SUFFIXES = new Set(['ex', 'gx', 'v', 'vmax', 'vstar', 'vunion', 'lv', 'break']);

export function normalizeOcrText(raw: string): string {
  return (
    raw
      .normalize('NFC')
      .replace(/[‘’ʼ]/g, "'")
      .replace(/[‐-―]/g, '-')
      .split('\n')
      // Control characters (tabs, bells…) are OCR garbage.
      .map((line) => line.replace(/\p{Cc}/gu, ' ').replace(/\s+/g, ' ').trim())
      .filter((line) => line.length > 0)
      .join('\n')
  );
}

function cleanNameLine(line: string): string {
  const tokens = line
    // Keep letters (with accents), apostrophes and hyphens; digits and symbols are noise here.
    .replace(/[^\p{L}'\- ]+/gu, ' ')
    .split(' ')
    .map((token) => token.replace(/^[-']+|[-']+$/g, ''))
    .filter((token) => token.length > 0);

  return tokens
    .filter((token) => {
      const folded = foldText(token);
      if (NAME_SUFFIXES.has(folded)) return true;
      if (NAME_NOISE_TOKENS.has(folded)) return false;
      // Isolated 1-2 letter fragments are almost always misread icons or borders.
      return folded.length > 2;
    })
    .join(' ')
    .trim();
}

/** Picks the line that looks most like a card name (most letters after cleaning). */
export function extractCardName(raw: string): string | null {
  let best: string | null = null;
  let bestLetters = 0;
  for (const line of normalizeOcrText(raw).split('\n')) {
    const cleaned = cleanNameLine(line);
    const letters = cleaned.replace(/[^\p{L}]/gu, '').length;
    if (letters > bestLetters) {
      best = cleaned;
      bestLetters = letters;
    }
  }
  return best !== null && bestLetters >= 3 ? best : null;
}

// Characters Tesseract commonly confuses with digits on small print.
const DIGIT_CONFUSIONS: Record<string, string> = {
  O: '0',
  Q: '0',
  D: '0',
  I: '1',
  L: '1',
  '|': '1',
  '!': '1',
  Z: '2',
  S: '5',
  B: '8',
  G: '6',
};

function fixDigits(token: string): string {
  return token.replace(/./g, (char) => DIGIT_CONFUSIONS[char] ?? char);
}

/** Letter prefixes used on special collector numbers (TG05, SWSH020, GG12, SV085…). */
const NUMBER_PREFIX = /^(TG|GG|SWSH|SV|SVP|SM|XY|BW|RC|SH|H)(?=[0-9OQDILZSBG|!])/;

function fixNumberPart(part: string): string {
  const prefix = NUMBER_PREFIX.exec(part)?.[0] ?? '';
  return prefix + fixDigits(part.slice(prefix.length));
}

/**
 * Finds the collector number ("025/165", "TG05/TG30", "SWSH020") in the bottom strip of a card.
 * Digit confusions are repaired only inside the number token, never in the surrounding text.
 */
export function extractCardNumber(raw: string): CollectorNumber | null {
  const text = normalizeOcrText(raw).toUpperCase();

  const slashed =
    /([A-Z]{0,4}[0-9OQDILZSBG|!]{1,3})\s*[/\\]\s*([A-Z]{0,4}[0-9OQDILZSBG|!]{2,3})/.exec(text);
  if (slashed?.[1] && slashed[2]) {
    const parsed = parseCollectorNumber(
      `${fixNumberPart(slashed[1])}/${fixNumberPart(slashed[2])}`,
    );
    if (parsed) return parsed;
  }

  const promo = /\b(SWSH|SVP|SV|SM|XY|BW)\s?(\d{2,3})\b/.exec(text);
  if (promo?.[1] && promo[2]) return parseCollectorNumber(`${promo[1]}${promo[2]}`);
  return null;
}

export function readCard(nameText: string, numberText: string): OcrReading {
  return { name: extractCardName(nameText), number: extractCardNumber(numberText) };
}
