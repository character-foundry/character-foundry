import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  canonicalJson, canonicalCardContent, computeCardContentIdentity, hashBytes,
  createCardRevision, readCardLineage, stripCardLineage, verifyCardLineage,
  sanitizeCardForPublish, assertLineageExportSupported,
} from './index.js';
import type { JsonObject } from './index.js';

function card(data: JsonObject = {}) { return { spec: 'chara_card_v3', spec_version: '3.0', data: { name: 'Aster', ...data } }; }
const originalHash = 'a'.repeat(64);
const save = { originalHash, operation: 'edit' as const, author: 'urn:unity:user:aster', createdAt: '2026-10-11T12:00:00.000Z', nonce: '0000000000000001' };

describe('canonical card content v1', () => {
  it('uses explicit lexical key ordering including integer-like keys and JCS primitive encoding', () => {
    expect(canonicalJson({ '2': 2, '10': 10, nested: { z: -0, a: 1e30 }, text: '€\n' }))
      .toBe('{"10":10,"2":2,"nested":{"a":1e+30,"z":0},"text":"€\\n"}');
    expect(canonicalJson({ '\u20ac': 1, '\r': 2, '\ufb33': 3, '1': 4, '😀': 5, '\u0080': 6, 'ö': 7 }))
      .toBe('{"\\r":2,"1":4,"\u0080":6,"ö":7,"€":1,"😀":5,"דּ":3}');
    expect(canonicalJson('é')).not.toBe(canonicalJson('e\u0301'));
  });

  it('has an independently hashed, fixed canonical minimal-card vector', async () => {
    const expected = '{"algorithm":"foundry-card-v1-sha256","assets":{},"data":{"alternate_greetings":[],"assets":[],"character_version":"","creator":"","creator_notes":"","description":"","extensions":{},"first_mes":"","group_only_greetings":[],"mes_example":"","name":"Aster","personality":"","post_history_instructions":"","scenario":"","system_prompt":"","tags":[]},"envelope":{},"portrait":null}';
    expect(canonicalCardContent(card())).toBe(expected);
    expect((await computeCardContentIdentity(card())).hash).toBe(createHash('sha256').update(expected).digest('hex'));
    // Independently generated with Python hashlib and sorted-key JSON.
    expect((await computeCardContentIdentity(card())).hash).toBe('c77f25b32b63189951ca162e4781166974d6f9aa14b87cc3cb89f09520a81f98');
  });

  it('preserves meaningful field sensitivity, unknowns, arrays and null while ignoring object order', async () => {
    const base = card({ tags: ['one', 'two'], character_book: { entries: [{ content: 'Lore', unknown: 42 }] }, extensions: { x: { b: 2, a: 1 } } });
    const identity = await computeCardContentIdentity(base);
    const reversed = JSON.parse(JSON.stringify(base, null, 2)) as typeof base;
    reversed.data.extensions = { x: { a: 1, b: 2 } };
    expect(await computeCardContentIdentity(reversed)).toEqual(identity);
    for (const data of [{ creator: 'Another' }, { tags: ['two', 'one'] }, { nickname: 'Nick' }, { creation_date: 123 },
      { personality: null }, { unknown: 'retained' }, { character_book: { entries: [{ content: 'Changed', unknown: 42 }] } },
      { extensions: { x: { b: 3, a: 1 } } }]) {
      expect(await computeCardContentIdentity({ ...base, data: { ...base.data, ...data } })).not.toEqual(identity);
    }
    expect(await computeCardContentIdentity({ ...base, unknown_envelope: true })).not.toEqual(identity);
    expect(canonicalCardContent(card({ character_book: null }))).not.toBe(canonicalCardContent(card()));
  });

  it('bridges wrapped v2/v3 and only the documented empty defaults', async () => {
    const v2 = { spec: 'chara_card_v2', spec_version: '2.0', data: { name: 'Aster', extensions: { opaque: [1, null] } } };
    const v3 = { ...v2, spec: 'chara_card_v3', spec_version: '3.0', data: { ...v2.data, group_only_greetings: [], creator: '', tags: [], assets: [] } };
    expect(await computeCardContentIdentity(v2)).toEqual(await computeCardContentIdentity(v3));
    expect(() => canonicalCardContent(v2.data)).toThrow();
    expect(() => canonicalCardContent({ ...v2, spec_version: '2.1' })).toThrow();
  });

  it('binds RisuAI-sized asset lists (a thousand or more declared assets)', async () => {
    const count = 1500;
    const assets = Array.from({ length: count }, (_, index) => ({ type: 'x-risu-asset', name: `a${index}`, ext: 'png', uri: `embeded://assets/other/a${index}.png` }));
    const bindings = assets.map((_, index) => ({ pointer: `/assets/${index}/uri`, hash: createHash('sha256').update(String(index)).digest('hex') }));
    const identity = await computeCardContentIdentity(card({ assets }), { assets: bindings });
    expect(identity.hash).toMatch(/^[a-f0-9]{64}$/);
    await expect(computeCardContentIdentity(card({ assets: [...assets, ...assets, ...assets, ...assets, ...assets, ...assets] }),
      { assets: [...Array(9000).keys()].map((index) => ({ pointer: `/assets/${index}/uri`, hash: 'a'.repeat(64) })) })).rejects.toMatchObject({ code: 'LIMIT' });
  });

  it('includes digests for declared assets and portrait bytes without depending on a container URI', async () => {
    const data = { assets: [{ type: 'icon', name: 'main', ext: 'png', uri: 'pngchunk:0' }] };
    const input = card(data);
    const options = { assets: [{ pointer: '/assets/0/uri', hash: 'b'.repeat(64) }], portraitHash: 'c'.repeat(64) };
    const first = await computeCardContentIdentity(input, options);
    const second = card({ assets: [{ ...data.assets[0], uri: 'embeded://assets/icon/images/main.png' }] });
    expect(await computeCardContentIdentity(second, options)).toEqual(first);
    expect(await computeCardContentIdentity(input, { ...options, portraitHash: 'd'.repeat(64) })).not.toEqual(first);
    expect(await computeCardContentIdentity(input, { ...options, assets: [{ pointer: '/assets/0/uri', hash: 'e'.repeat(64) }] })).not.toEqual(first);
    expect(() => canonicalCardContent(input)).toThrow();
    expect(() => canonicalCardContent(input, { assets: [...options.assets, ...options.assets] })).toThrow();
    expect(() => canonicalCardContent(input, { assets: [{ pointer: '/name', hash: 'b'.repeat(64) }] })).toThrow();
    expect(input.data).toEqual({ name: 'Aster', ...data });
  });

  it('excludes only lineage and documented local fields; publishing reports removals without mutating', async () => {
    const base = card({ extensions: { foundry: { portable: true }, other: { local: 'portable unknown' } } });
    const input = card({ extensions: { foundry: { portable: true, lineage: { claim: true }, local: { token: 'private' } }, other: { local: 'portable unknown' }, charx_media: { path: '/local' } } });
    expect(await computeCardContentIdentity(input)).toEqual(await computeCardContentIdentity(base));
    const sanitized = sanitizeCardForPublish(input);
    expect(sanitized.removed).toEqual(['/data/extensions/charx_media', '/data/extensions/foundry/local']);
    expect((sanitized.card.data.extensions as JsonObject).other).toEqual({ local: 'portable unknown' });
    expect((input.data.extensions as JsonObject).charx_media).toEqual({ path: '/local' });
    expect(await computeCardContentIdentity(sanitized.card)).toEqual(await computeCardContentIdentity(input));
  });

  it('rejects lossy JavaScript values, malformed Unicode, accessors, cycles and excessive depth', () => {
    const cycle: Record<string, unknown> = {}; cycle.self = cycle;
    let getterCalls = 0;
    const accessor = Object.defineProperty({}, 'x', { enumerable: true, get() { getterCalls++; return 'bad'; } });
    for (const value of [undefined, NaN, Infinity, 1n, new Date(), new Map(), '\ud800', { '\udfff': 1 }, [undefined], Array(2), { x: undefined }, accessor, cycle]) {
      expect(() => canonicalJson(value)).toThrow();
    }
    let deep: unknown = null;
    for (let i = 0; i < 66; i++) deep = [deep];
    expect(() => canonicalJson(deep)).toThrow();
    expect(getterCalls).toBe(0);
    expect(canonicalJson(JSON.parse('{"__proto__":{"x":1}}'))).toBe('{"__proto__":{"x":1}}');
  });

  it('keeps accepted-file identity separate and snapshots mutable bytes before hashing', async () => {
    const compact = new TextEncoder().encode(JSON.stringify(card()));
    const pretty = new TextEncoder().encode(JSON.stringify(card(), null, 2));
    expect(await hashBytes(compact)).not.toBe(await hashBytes(pretty));
    const expected = createHash('sha256').update(compact).digest('hex');
    const pending = hashBytes(compact);
    compact.fill(0);
    expect(await pending).toBe(expected);
  });
});

describe('card lineage v1', () => {
  it('creates lineage only on an explicit save and does not change content identity', async () => {
    const input = card({ extensions: { unknown: { retained: true } } });
    const before = structuredClone(input);
    expect(readCardLineage(input)).toBeNull();
    const result = await createCardRevision(input, save);
    expect(input).toEqual(before);
    expect(await verifyCardLineage(result.card)).toBe(true);
    expect(result.lineage.content).toEqual(await computeCardContentIdentity(input));
    expect(stripCardLineage(result.card)).toEqual(input);
    expect(result.lineage.originalHash).toBe(originalHash);
    expect(result.lineage.parents).toEqual([]);
  });

  it('has deterministic retries but distinct revision identity for equal-content saves and forks', async () => {
    const first = await createCardRevision(card(), save);
    expect(first.lineage.revisionHash).toBe('0f41042272aa6491f7b777d1aef5c2e9b568d27d77f8647b19630eaf5ef5fe12');
    expect(await createCardRevision(card(), save)).toEqual(first);
    const draft = structuredClone(first.card);
    draft.data.description = 'Edited';
    const second = await createCardRevision(draft, { ...save, parents: [first.lineage], nonce: '0000000000000002' });
    const fork = await createCardRevision(second.card, { ...save, operation: 'fork', parents: [second.lineage], author: 'urn:unity:user:birch', nonce: '0000000000000003' });
    expect(second.lineage.content).toEqual(fork.lineage.content);
    expect(second.lineage.revisionHash).not.toBe(fork.lineage.revisionHash);
    expect(fork.lineage.parents).toEqual([{ revisionHash: second.lineage.revisionHash, content: second.lineage.content }]);
    expect(fork.lineage.originalHash).toBe(first.lineage.originalHash);
    expect(await verifyCardLineage(fork.card)).toBe(true);
  });

  it('rejects malformed, rerooted, tampered or disconnected parent lineage', async () => {
    const first = await createCardRevision(card(), save);
    await expect(createCardRevision(first.card, save)).rejects.toThrow();
    await expect(createCardRevision(first.card, { ...save, originalHash: 'b'.repeat(64), parents: [first.lineage] })).rejects.toThrow();
    await expect(createCardRevision(first.card, { ...save, parents: [{ ...first.lineage, author: 'urn:fake' }] })).rejects.toThrow();
    await expect(createCardRevision(card(), { ...save, parents: [first.lineage, first.lineage] })).rejects.toThrow();
    await expect(createCardRevision(card(), { ...save, author: 'internal-row-id' })).rejects.toThrow();
    const modified = structuredClone(first.card); modified.data.name = 'Changed';
    expect(await verifyCardLineage(modified)).toBe(false);
    expect(() => readCardLineage(card({ extensions: { foundry: { lineage: { version: 9 } } } }))).toThrow();
  });

  it('requires explicit loss handling for Voxta and unsupported containers', async () => {
    const result = await createCardRevision(card(), save);
    for (const format of ['json_v2', 'json_v3', 'png_v2', 'png_v3', 'charx']) expect(() => assertLineageExportSupported(result.card, format)).not.toThrow();
    for (const format of ['voxta', 'unknown']) expect(() => assertLineageExportSupported(result.card, format)).toThrow();
    expect(() => assertLineageExportSupported(card(), 'voxta')).not.toThrow();
  });
});
