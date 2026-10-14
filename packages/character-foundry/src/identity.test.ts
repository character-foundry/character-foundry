import { describe, expect, it } from 'vitest';
import { createCardRevision, readCardLineage, verifyCardLineage, computeCardContentIdentity, hashBytes } from './identity.js';
import { embedIntoPNG, extractFromPNG } from './png.js';
import { writeCharX, readCharX } from './charx.js';
import type { CCv3Data } from './schemas.js';

const png = new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==', 'base64'));
function card(): CCv3Data {
  return { spec: 'chara_card_v3', spec_version: '3.0', data: {
    name: 'Aster', description: 'A synthetic identity fixture.', personality: '', scenario: '', first_mes: 'Hello', mes_example: '',
    creator: 'Unity', character_version: '1', tags: ['fixture'], group_only_greetings: [],
    assets: [{ type: 'icon', uri: 'ccdefault:', name: 'main', ext: 'png' }],
    extensions: { unknown: { portable: ['preserved', null] } },
    character_book: { entries: [{ keys: ['forest'], content: 'A forest.', enabled: true, insertion_order: 0, extensions: { custom: 42 } }] },
  } };
}

describe('public identity format integration', () => {
  it('preserves content and exact lineage through JSON, PNG and CharX container primitives', async () => {
    const originalHash = await hashBytes(new TextEncoder().encode(JSON.stringify(card())));
    const options = { assets: [{ pointer: '/assets/0/uri', hash: await hashBytes(png) }], portraitHash: await hashBytes(png) };
    const saved = await createCardRevision(card(), { ...options, originalHash, operation: 'edit', author: 'urn:unity:fixture',
      createdAt: '2026-10-11T00:00:00.000Z', nonce: 'integration-nonce-0001' });
    // The fixture is a known CCv3 card; identity APIs deliberately retain opaque JSON types.
    const document = saved.card as unknown as CCv3Data;
    const json = JSON.parse(JSON.stringify(document));
    const pngResult = extractFromPNG(embedIntoPNG(png, document, { key: 'ccv3' })).data;
    const charx = writeCharX(document, [{ type: 'icon', name: 'main', ext: 'png', data: png }]);
    const charxResult = readCharX(charx.buffer).card;
    for (const recovered of [json, pngResult, charxResult]) {
      expect(readCardLineage(recovered)).toEqual(saved.lineage);
      expect(await verifyCardLineage(recovered, options)).toBe(true);
      expect(await computeCardContentIdentity(recovered, options)).toEqual(saved.lineage.content);
    }
    expect(card().data.extensions).not.toHaveProperty('foundry');
    expect(await hashBytes(charx.buffer)).not.toBe(originalHash);
  });

  it('preserves opaque descriptors on request and detects loss from legacy descriptor generation', async () => {
    const data = card();
    Object.assign(data.data.assets?.[0] ?? {}, { unknown_asset_metadata: 'must survive' });
    const options = { assets: [{ pointer: '/assets/0/uri', hash: await hashBytes(png) }] };
    const saved = await createCardRevision(data, { ...options, originalHash: 'a'.repeat(64), operation: 'edit', author: 'urn:unity:fixture',
      createdAt: '2026-10-11T00:00:00.000Z', nonce: 'integration-nonce-0002' });
    const exported = writeCharX(saved.card as unknown as CCv3Data, [{ type: 'icon', name: 'main', ext: 'png', data: png }]);
    expect(await verifyCardLineage(readCharX(exported.buffer).card, options)).toBe(false);
    const preserved = writeCharX(saved.card as unknown as CCv3Data, [{ type: 'icon', name: 'main', ext: 'png', data: png }], { preserveDescriptors: true });
    expect(await verifyCardLineage(readCharX(preserved.buffer).card, options)).toBe(true);
    expect(readCharX(preserved.buffer).card.data.assets?.[0]).toHaveProperty('unknown_asset_metadata', 'must survive');
  });
});
