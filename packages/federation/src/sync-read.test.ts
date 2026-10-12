import { beforeAll, describe, expect, it, vi } from 'vitest';
import { computeCardContentIdentity, createCardRevision, hashBytes } from '@character-foundry/identity';
import { createSyncReadClient, parseSyncReadCapabilities, parseSyncReadPage, parseSyncReadPublication, parseSyncReadSelection,
  syncReadCapabilities, verifySyncReadPublication, SYNC_READ_VERSION, SYNC_READ_MAX_JSON_BYTES } from './sync-read.js';
import type { SyncReadPublication } from './sync-read.js';
import { verifySyncHttp } from './sync-http.js';

let key: CryptoKeyPair;
beforeAll(async () => { key = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']); });
const bytes = new Uint8Array([1, 3, 5, 7]);
const baseUrl = 'https://receiver.example/api/sync/v1';
const actor = 'https://sender.example/actors/alice';
async function publication(id = 'a'): Promise<SyncReadPublication> {
  const hash = await hashBytes(bytes);
  const source = { spec: 'chara_card_v3', spec_version: '3.0', opaque: { keep: [1, null] }, data: { name: 'Aster', description: 'Map keeper',
    assets: [{ type: 'background', name: 'scene', ext: 'png', uri: 'https://opaque.example/never-fetch.png' }] } };
  const value = await createCardRevision(source, { originalHash: 'a'.repeat(64), operation: 'edit', author: actor,
    createdAt: '2026-10-11T00:00:00.000Z', nonce: 'sync_read_test_nonce', assets: [{ pointer: '/assets/0/uri', hash }] });
  return { id, document: value.card, identity: value.lineage.content, originalHash: 'a'.repeat(64), parentId: null,
    publishedAt: '2026-10-11T00:00:00.000Z', policy: { visibility: 'public', allowFork: true, version: 1 },
    assets: [{ path: 'declared/0', hash, byteLength: bytes.length, mediaType: 'image/png', binding: { kind: 'uri', pointer: '/assets/0/uri' } }] };
}
function client(fetcher: typeof fetch, extra: { timeoutMs?: number } = {}) {
  return createSyncReadClient({ baseUrl, actor, keyId: `${actor}#one`, privateKey: key.privateKey, fetch: fetcher, ...extra });
}
const json = (value: unknown) => Response.json(value);

describe('publication read protocol v1', () => {
  it('verifies identity, lineage and portable asset bindings without changing opaque document data', async () => {
    const value = await publication();
    expect(await verifySyncReadPublication(value)).toEqual(value);
    const parsed = parseSyncReadPublication(value); parsed.document.opaque = 'changed';
    expect(value.document.opaque).toEqual({ keep: [1, null] });
    const modified = structuredClone(value); (modified.document.data as Record<string, unknown>).description = 'tampered';
    await expect(verifySyncReadPublication(modified)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    await expect(verifySyncReadPublication({ ...value, originalHash: 'b'.repeat(64) })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    await expect(verifySyncReadPublication({ ...value, assets: [] })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    const portrait = { spec: 'chara_card_v3', spec_version: '3.0', data: { name: 'Portrait' } };
    const hash = await hashBytes(bytes);
    expect(await verifySyncReadPublication({ ...value, document: portrait, identity: await computeCardContentIdentity(portrait, { portraitHash: hash }),
      assets: [{ ...value.assets[0], path: 'portrait', binding: { kind: 'portrait' } }] })).toMatchObject({ document: portrait });
  });

  it('rejects unknown wire fields, duplicate bindings, invalid policies, counts, dates and non-JSON documents', async () => {
    const value = await publication();
    for (const changed of [
      { extra: true }, { policy: { ...value.policy, visibility: 'anyone' } }, { policy: { ...value.policy, version: 0 } },
      { assets: [...value.assets, ...value.assets] }, { assets: [value.assets[0], { ...value.assets[0], path: 'different' }] },
      { assets: [{ ...value.assets[0], path: '../secret' }] }, { publishedAt: '2026-02-31T00:00:00.000Z' },
      { document: { bad: undefined } }, { document: { sparse: Array(2) } }, { document: { value: Infinity } },
    ]) expect(() => parseSyncReadPublication({ ...value, ...changed })).toThrow();
    expect(() => parseSyncReadPublication({ ...value, document: { oversized: 'a'.repeat(262144) } })).toThrow();
    expect(() => parseSyncReadPublication({ ...value, assets: [{ ...value.assets[0], binding: { kind: 'uri', pointer: '/unknown/uri' } }] })).toThrow();
  });

  it('validates capability versions and bounded, strictly ordered selection pages', async () => {
    expect(parseSyncReadCapabilities(syncReadCapabilities())).toEqual(syncReadCapabilities());
    for (const input of [{ ...syncReadCapabilities(), version: 'v2' }, { ...syncReadCapabilities(), operations: ['publish'] },
      { ...syncReadCapabilities(), limits: { ...syncReadCapabilities().limits, pageSize: 21 } }]) expect(() => parseSyncReadCapabilities(input)).toThrow();
    const value = await publication();
    expect(parseSyncReadPage({ version: SYNC_READ_VERSION, publications: [value], nextAfter: 'a' }).nextAfter).toBe('a');
    for (const publications of [[value, value], [await publication('b'), value]]) expect(() => parseSyncReadPage({ version: SYNC_READ_VERSION, publications, nextAfter: null })).toThrow();
    expect(() => parseSyncReadPage({ version: SYNC_READ_VERSION, publications: [], nextAfter: 'a' })).toThrow();
    expect(parseSyncReadSelection(new URLSearchParams('limit=20&after=a&parent=root'))).toEqual({ limit: 20, after: 'a', parent: 'root' });
    for (const query of ['limit=21', 'limit=0', 'limit=01', 'limit=1&limit=2', 'after=../x', 'unknown=x']) expect(() => parseSyncReadSelection(new URLSearchParams(query))).toThrow();
  });

  it('signs every exact URI with fresh tokens, verifies response identities and downloads only manifest assets', async () => {
    const value = await publication(); const nonces = new Set<string>(); const urls: string[] = [];
    const fetcher: typeof fetch = async (input, init) => {
      const url = String(input); urls.push(url);
      expect(init?.credentials).toBe('omit'); expect(init?.redirect).toBe('manual'); expect(init?.cache).toBe('no-store');
      const verified = await verifySyncHttp({ method: init!.method!, url, headers: new Headers(init!.headers), body: new Uint8Array() }, {
        resolveKey: async () => ({ actor, keyId: `${actor}#one`, publicKey: key.publicKey }),
        consumeNonce: async ({ nonce }) => { if (nonces.has(nonce)) return false; nonces.add(nonce); return true; },
      });
      expect(verified.body.length).toBe(0);
      if (url.endsWith('/capabilities')) return json(syncReadCapabilities());
      if (url.includes('/asset?')) return new Response(bytes, { headers: { 'content-type': 'image/png' } });
      if (url.includes('publications?')) return json({ version: SYNC_READ_VERSION, publications: [value], nextAfter: 'a' });
      return json({ version: SYNC_READ_VERSION, publication: value });
    };
    const reader = client(fetcher);
    expect(await reader.capabilities()).toEqual(syncReadCapabilities());
    expect(await reader.get('a')).toEqual(value);
    expect((await reader.list({ limit: 1 })).publications).toEqual([value]);
    expect(await reader.asset(value, 'declared/0')).toEqual(bytes);
    expect(nonces.size).toBe(4);
    expect(urls[3]).toBe(`${baseUrl}/publications/a/asset?path=declared%2F0&policyVersion=1`);
    await expect(reader.asset(value, 'https://other.example/steal')).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    expect(urls).toHaveLength(4);
  });

  it('refuses redirect, stale-policy, oversized, mismatched and substituted responses', async () => {
    const value = await publication();
    await expect(client(async () => new Response(null, { status: 302, headers: { location: 'https://other.example/' } })).get('a')).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    await expect(client(async () => new Response(null, { status: 409 })).asset(value, 'declared/0')).rejects.toMatchObject({ code: 'CHANGED', status: 409 });
    await expect(client(async () => json({ version: SYNC_READ_VERSION, publication: await publication('other') })).get('a')).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    await expect(client(async () => new Response(new Uint8Array([7, 5, 3, 1]), { headers: { 'content-type': 'image/png' } })).asset(value, 'declared/0')).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    await expect(client(async () => new Response(bytes.slice(1), { headers: { 'content-type': 'image/png' } })).asset(value, 'declared/0')).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    await expect(client(async () => new Response(bytes, { headers: { 'content-type': 'text/html' } })).asset(value, 'declared/0')).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    const cancel = vi.fn();
    await expect(client(async () => new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(SYNC_READ_MAX_JSON_BYTES + 1)); }, cancel }),
      { headers: { 'content-type': 'application/json' } })).capabilities()).rejects.toMatchObject({ code: 'TOO_LARGE' });
    expect(cancel).toHaveBeenCalled();
    await expect(client(async () => json({ version: SYNC_READ_VERSION, publications: [value], nextAfter: 'a' })).list({ after: 'a' })).rejects.toThrow();
  });

  it('cancels stalled streams on timeout and refuses already-aborted requests before fetch', async () => {
    const cancel = vi.fn();
    const reader = client(async () => new Response(new ReadableStream({ cancel }), { headers: { 'content-type': 'application/json' } }), { timeoutMs: 20 });
    await expect(reader.capabilities()).rejects.toMatchObject({ code: 'UNAVAILABLE' }); expect(cancel).toHaveBeenCalled();
    const fetcher = vi.fn<typeof fetch>(); const controller = new AbortController(); controller.abort();
    await expect(client(fetcher).capabilities(controller.signal)).rejects.toMatchObject({ code: 'UNAVAILABLE' }); expect(fetcher).not.toHaveBeenCalled();
    expect(() => createSyncReadClient({ baseUrl: 'http://receiver.example/api/sync/v1', actor, keyId: `${actor}#one`, privateKey: key.privateKey })).toThrow();
  });
});
