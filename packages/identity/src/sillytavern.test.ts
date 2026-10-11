import { describe, expect, it } from 'vitest';
import { canonicalJson, computeCardContentIdentity, createCardRevision, prepareSillyTavernTransport, readCardLineage, restoreSillyTavernTransport, verifyCardLineage } from './index.js';
import type { CardEnvelope, JsonObject } from './index.js';
const document = (): CardEnvelope => ({ spec: 'chara_card_v3', spec_version: '3.0', opaque: { values: [1, null] }, data: {
  name: 'Aster', description: 'A map keeper', personality: '', scenario: '', first_mes: 'Hello', mes_example: '', tags: ['forest'],
  extensions: { vendor: { preserve: true }, foundry: { local: { secret: 'not for export' } } },
} });
async function edited() {
  return createCardRevision(document(), { originalHash: 'a'.repeat(64), operation: 'edit', author: 'urn:unity:user:alice',
    parents: [], createdAt: '2026-10-11T00:00:00.000Z', nonce: '0000000000000001' });
}
/** Named source-observed changes; the real application is exercised separately. */
function returned(card: CardEnvelope) {
  const value = structuredClone(card);
  for (const key of ['name', 'description', 'personality', 'scenario', 'first_mes', 'mes_example', 'tags']) value[key] = value.data[key]!;
  value.fav = false; (value.data.extensions as JsonObject).fav = false; value.create_date = '2026-10-11T01:02:03.000Z';
  return value;
}
describe('explicit SillyTavern JSON transport', () => {
  it('retains old identity vectors and exact lineage after verified removal of declared additions', async () => {
    const revision = await edited(); const before = canonicalJson(revision.card);
    const transport = await prepareSillyTavernTransport(revision.card);
    expect(canonicalJson(transport.card)).not.toContain('not for export');
    expect(await computeCardContentIdentity(transport.card)).toEqual(revision.lineage.content);
    const output = returned(transport.card);
    expect(await verifyCardLineage(output)).toBe(false); // no global hash exclusions were added
    const restored = await restoreSillyTavernTransport(output);
    expect(restored?.content).toEqual(revision.lineage.content);
    expect(readCardLineage(restored?.card)).toEqual(revision.lineage);
    expect(await verifyCardLineage(restored?.card)).toBe(true);
    expect(restored?.card.opaque).toEqual({ values: [1, null] });
    expect(canonicalJson(output)).toContain('create_date');
    expect(canonicalJson(revision.card)).toBe(before);
    expect(await restoreSillyTavernTransport(restored?.card)).toBeNull();
    expect((await restoreSillyTavernTransport(transport.card))?.content).toEqual(transport.content);
  });
  it('does not invent lineage for untouched cards and does not infer missing markers', async () => {
    const transport = await prepareSillyTavernTransport(document());
    expect(readCardLineage(transport.card)).toBeNull();
    expect(readCardLineage((await restoreSillyTavernTransport(returned(transport.card)))?.card)).toBeNull();
    expect(await restoreSillyTavernTransport(returned((await edited()).card))).toBeNull();
  });
  it('retains preexisting equal mirrors and favorite fields', async () => {
    const input = document(); input.name = input.data.name!; input.fav = false; (input.data.extensions as JsonObject).fav = false;
    const prepared = await prepareSillyTavernTransport(input);
    const restored = await restoreSillyTavernTransport(returned(prepared.card));
    expect(restored?.card.name).toBe('Aster'); expect(restored?.card.fav).toBe(false);
    expect((restored?.card.data.extensions as JsonObject).fav).toBe(false);
  });
  it('rejects preexisting envelope fields that SillyTavern would overwrite', async () => {
    for (const field of ['chat', 'json_data', 'create_date', 'name', 'fav']) {
      const input = document(); input[field] = 'authored value';
      await expect(prepareSillyTavernTransport(input)).rejects.toMatchObject({ code: 'LOSSY_FORMAT' });
    }
    const input = document(); (input.data.extensions as JsonObject).fav = true;
    await expect(prepareSillyTavernTransport(input)).rejects.toMatchObject({ code: 'LOSSY_FORMAT' });
  });
  it('rejects edits to prompts, opaque fields, mirrors, lineage and marker scope', async () => {
    const prepared = await prepareSillyTavernTransport((await edited()).card);
    const changes = [
      (card: CardEnvelope) => { card.data.description = 'External edit'; card.description = 'External edit'; },
      (card: CardEnvelope) => { card.opaque = { changed: true }; },
      (card: CardEnvelope) => { card.name = 'Different mirror'; },
      (card: CardEnvelope) => { (card.data.extensions as JsonObject).fav = true; },
      (card: CardEnvelope) => { card.create_date = 'invalid'; },
      (card: CardEnvelope) => { const foundry = (card.data.extensions as JsonObject).foundry as JsonObject; delete foundry.lineage; },
      (card: CardEnvelope) => { const marker = (((card.data.extensions as JsonObject).foundry as JsonObject).local as JsonObject).sillyTavernTransport as JsonObject; marker.absent = ['/opaque']; },
    ];
    for (const change of changes) { const output = returned(prepared.card); change(output); await expect(restoreSillyTavernTransport(output)).rejects.toMatchObject({ code: 'LOSSY_FORMAT' }); }
  });
  it('requires the same externally verified asset bindings and portrait digest', async () => {
    const input = document(); input.data.assets = [{ type: 'icon', uri: 'ccdefault:', name: 'main', ext: 'png', vendor: true }];
    const options = { portraitHash: 'b'.repeat(64), assets: [{ pointer: '/assets/0/uri', hash: 'b'.repeat(64) }] };
    const prepared = await prepareSillyTavernTransport(input, options);
    expect((await restoreSillyTavernTransport(returned(prepared.card), options))?.content).toEqual(prepared.content);
    await expect(restoreSillyTavernTransport(returned(prepared.card), { ...options, portraitHash: 'c'.repeat(64) })).rejects.toMatchObject({ code: 'LOSSY_FORMAT' });
  });
});
