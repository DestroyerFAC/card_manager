// Edge Function: returns cached prices for a batch of cards and refreshes stale entries.
// Clients never call price APIs directly: this function is the single, rate-limited gateway.
import { withSupabase } from 'npm:@supabase/server@1';
import { z } from 'npm:zod@4';
import { CARD_ID_PATTERN, isStale, type PriceQuote } from '../_shared/pricing.ts';
import { TcgdexPriceSource, type PriceSource } from '../_shared/priceSource.ts';

const MAX_IDS_PER_REQUEST = 100;
// Bounds the upstream work one request can cause: a big collection warms the cache over a few
// calls instead of hammering TCGdex or exceeding the function's wall-clock limit.
const MAX_REFRESH_PER_REQUEST = 25;
const REFRESH_CONCURRENCY = 5;
const UPSTREAM_TIMEOUT_MS = 6000;
const CURRENCY = 'EUR';
const TCG = 'pokemon';

const requestSchema = z.object({
  cardIds: z.array(z.string().regex(CARD_ID_PATTERN)).min(1).max(MAX_IDS_PER_REQUEST),
});

interface PriceRow {
  card_id: string;
  currency: string;
  low: number | null;
  mid: number | null;
  market: number | null;
  holo_low: number | null;
  holo_mid: number | null;
  holo_market: number | null;
  source: string;
  updated_at: string;
}

const source: PriceSource = new TcgdexPriceSource();

const allowedOrigin = Deno.env.get('ALLOWED_ORIGIN') ?? '*';
const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-retry-count',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  Vary: 'Origin',
};

function toRow(cardId: string, quote: PriceQuote | null, now: string): PriceRow {
  return {
    card_id: cardId,
    currency: CURRENCY,
    low: quote?.low ?? null,
    mid: quote?.mid ?? null,
    market: quote?.market ?? null,
    holo_low: quote?.holoLow ?? null,
    holo_mid: quote?.holoMid ?? null,
    holo_market: quote?.holoMarket ?? null,
    source: quote?.source ?? source.name,
    updated_at: now,
  };
}

async function refresh(cardIds: readonly string[]): Promise<PriceRow[]> {
  const rows: PriceRow[] = [];
  const queue = [...cardIds];
  const worker = async () => {
    for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
      try {
        const quote = await source.fetchQuote(id, AbortSignal.timeout(UPSTREAM_TIMEOUT_MS));
        if (quote && quote.currency !== CURRENCY) continue;
        rows.push(toRow(id, quote, new Date().toISOString()));
      } catch (error) {
        // Keep serving the stale value; the next request retries.
        console.error('price refresh failed', id, error instanceof Error ? error.message : error);
      }
    }
  };
  await Promise.all(Array.from({ length: REFRESH_CONCURRENCY }, worker));
  return rows;
}

// CORS headers are stamped on every response (and preflight) by withSupabase.
function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

export default {
  fetch: withSupabase({ auth: 'user', cors: { headers: corsHeaders } }, async (req, ctx) => {
    if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

    let payload: unknown;
    try {
      payload = await req.json();
    } catch {
      return json({ error: 'invalid_json' }, 400);
    }
    const parsed = requestSchema.safeParse(payload);
    if (!parsed.success) return json({ error: 'invalid_request' }, 400);

    const cardIds = [...new Set(parsed.data.cardIds)];
    const { data: cached, error: readError } = await ctx.supabaseAdmin
      .from('card_prices')
      .select(
        'card_id, currency, low, mid, market, holo_low, holo_mid, holo_market, source, updated_at',
      )
      .eq('tcg', TCG)
      .eq('currency', CURRENCY)
      .in('card_id', cardIds);
    if (readError) {
      console.error('cache read failed', readError.message);
      return json({ error: 'cache_unavailable' }, 503);
    }

    const byId = new Map<string, PriceRow>((cached as PriceRow[]).map((row) => [row.card_id, row]));
    const now = Date.now();
    const staleIds = cardIds
      .filter((id) => {
        const row = byId.get(id);
        return !row || isStale(row.updated_at, now);
      })
      .slice(0, MAX_REFRESH_PER_REQUEST);

    if (staleIds.length > 0) {
      const fresh = await refresh(staleIds);
      if (fresh.length > 0) {
        const { error: writeError } = await ctx.supabaseAdmin.from('card_prices').upsert(
          fresh.map((row) => ({ ...row, tcg: TCG })),
          { onConflict: 'tcg,card_id,currency' },
        );
        if (writeError) console.error('cache write failed', writeError.message);
      }
      for (const row of fresh) byId.set(row.card_id, row);
    }

    const prices = cardIds.flatMap((id) => {
      const row = byId.get(id);
      if (!row) return [];
      return [
        {
          cardId: row.card_id,
          currency: row.currency,
          low: row.low === null ? null : Number(row.low),
          mid: row.mid === null ? null : Number(row.mid),
          market: row.market === null ? null : Number(row.market),
          holoLow: row.holo_low === null ? null : Number(row.holo_low),
          holoMid: row.holo_mid === null ? null : Number(row.holo_mid),
          holoMarket: row.holo_market === null ? null : Number(row.holo_market),
          updatedAt: row.updated_at,
          stale: isStale(row.updated_at, now),
        },
      ];
    });

    return json({ prices });
  }),
};
