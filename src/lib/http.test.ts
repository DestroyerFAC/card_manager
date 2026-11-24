import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { fetchJson } from './http';

const schema = z.object({ id: z.string() });

function mockFetch(...responses: (Response | Error)[]) {
  const fn = vi.fn<typeof fetch>();
  for (const response of responses) {
    if (response instanceof Error) fn.mockRejectedValueOnce(response);
    else fn.mockResolvedValueOnce(response);
  }
  vi.stubGlobal('fetch', fn);
  return fn;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchJson', () => {
  it('returns validated data', async () => {
    mockFetch(json({ id: 'a', extra: 1 }));
    expect(await fetchJson('https://x.test', schema)).toEqual({ ok: true, value: { id: 'a' } });
  });

  it('rejects payloads that do not match the schema', async () => {
    mockFetch(json({ id: 42 }));
    const result = await fetchJson('https://x.test', schema);
    expect(!result.ok && result.error.kind).toBe('parse');
  });

  it('maps 404 without retrying', async () => {
    const fn = mockFetch(json({}, 404));
    const result = await fetchJson('https://x.test', schema);
    expect(!result.ok && result.error.kind).toBe('not_found');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries transient failures then succeeds', async () => {
    const fn = mockFetch(new TypeError('offline'), json({}, 503), json({ id: 'b' }));
    const result = await fetchJson('https://x.test', schema, { retries: 2 });
    expect(result).toEqual({ ok: true, value: { id: 'b' } });
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('gives up after the retry budget', async () => {
    const fn = mockFetch(new TypeError('offline'), new TypeError('offline'));
    const result = await fetchJson('https://x.test', schema, { retries: 1 });
    expect(!result.ok && result.error.kind).toBe('network');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('reports aborts as aborted, not as network errors', async () => {
    const controller = new AbortController();
    controller.abort();
    mockFetch(new DOMException('aborted', 'AbortError'));
    const result = await fetchJson('https://x.test', schema, { signal: controller.signal });
    expect(!result.ok && result.error.kind).toBe('aborted');
  });
});
