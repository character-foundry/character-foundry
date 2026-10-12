import { describe, expect, it } from 'vitest';
import { computeCardContentIdentity, createCardRevision, hashBytes, verifyCardLineageRecord, parseCardLineageRecord } from '@character-foundry/identity';
import type { SyncReadPublication } from './sync-read.js';
import { SYNC_FORK_VERSION, encodeSyncForkSubmission, decodeSyncForkSubmission, verifySyncForkSubmission, parseSyncForkManifest } from './sync-fork.js';
import type { SyncForkSubmission } from './sync-fork.js';
import { createSyncCommandClient } from './sync-command.js';
import { verifySyncHttp, createSyncToken } from './sync-http.js';
const actor = 'https://peer.example/actors/bob';
async function fixture(withLineage = true) {
  const bytes = new Uint8Array([1, 3, 7]); const hash = await hashBytes(bytes);
  const options = { assets: [{ pointer: '/assets/0/uri', hash }] };
  const original = { spec: 'chara_card_v3', spec_version: '3.0', data: { name: 'Aster', description: 'Parent',
    assets: [{ type: 'custom', ext: 'bin', name: 'Opaque', uri: 'embedded://opaque.bin', unknown: ['preserve'] }] } };
  const before = await createCardRevision(original, { ...options, originalHash: 'a'.repeat(64), operation: 'edit', author: 'urn:alice', createdAt: '2026-10-11T00:00:00.000Z', nonce: 'parent_record_0001' });
  const parent: SyncReadPublication = { id: 'parent', document: withLineage ? before.card : original,
    identity: await computeCardContentIdentity(original, options), originalHash: 'a'.repeat(64), publishedAt: '2026-10-11T00:00:00.000Z',
    parentId: null, policy: { visibility: 'public', allowFork: true, version: 1 },
    assets: [{ path: 'declared/0', hash, byteLength: 3, mediaType: 'application/octet-stream', binding: { kind: 'uri', pointer: '/assets/0/uri' } }] };
  const fork = await createCardRevision(parent.document, { ...options, originalHash: parent.originalHash, parents: withLineage ? [before.lineage] : [], operation: 'fork', author: actor,
    createdAt: '2026-10-11T01:00:00.000Z', nonce: 'remote_fork_00001' });
  const edited = structuredClone(fork.card); edited.data.description = 'Enriched elsewhere';
  const final = await createCardRevision(edited, { ...options, originalHash: parent.originalHash, parents: [fork.lineage], operation: 'edit', author: actor,
    createdAt: '2026-10-11T02:00:00.000Z', nonce: 'remote_edit_00001' });
  const submission: SyncForkSubmission = { manifest: { version: SYNC_FORK_VERSION, publicationId: parent.id, baseIdentity: parent.identity,
    document: final.card, identity: final.lineage.content, originalHash: parent.originalHash, ancestry: [fork.lineage], assets: parent.assets }, assets: [bytes] };
  return { parent, submission, before, fork, final };
}

describe('verified remote fork bundles', () => {
  it('retains exact assets, opaque descriptors and linear ancestry for original and revised parents', async () => {
    for (const withLineage of [true, false]) {
      const { parent, submission } = await fixture(withLineage);
      const bytes = await encodeSyncForkSubmission(submission), decoded = await decodeSyncForkSubmission(bytes);
      expect(decoded).toEqual(submission); expect(await encodeSyncForkSubmission(decoded)).toEqual(bytes);
      expect(await verifySyncForkSubmission(decoded, parent, actor)).toEqual(submission);
      decoded.assets[0]![0] = 9; decoded.manifest.document.extra = 'local';
      expect(submission.assets[0]![0]).toBe(1); expect(submission.manifest.document.extra).toBeUndefined();
      expect(await decodeSyncForkSubmission(bytes)).toEqual(submission);
    }
  });
  it('rejects frame corruption, truncation, trailing bytes, count/length/hash mismatch and oversized metadata', async () => {
    const { submission } = await fixture(), bytes = await encodeSyncForkSubmission(submission);
    for (const input of [bytes.slice(1), bytes.slice(0, 12), bytes.slice(0, -1), new Uint8Array([...bytes, 0])]) {
      await expect(decodeSyncForkSubmission(input)).rejects.toThrow();
    }
    const modified = new Uint8Array(bytes); modified[modified.length - 1] ^= 1;
    await expect(decodeSyncForkSubmission(modified)).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    await expect(encodeSyncForkSubmission({ ...submission, assets: [] })).rejects.toThrow();
    await expect(encodeSyncForkSubmission({ ...submission, assets: [new Uint8Array([0, 0, 0])] })).rejects.toThrow();
    expect(() => parseSyncForkManifest({ ...submission.manifest, ancestry: Array(33).fill(submission.manifest.ancestry[0]) })).toThrow();
    expect(() => parseSyncForkManifest({ ...submission.manifest, actor })).toThrow();
    const large = new Uint8Array(bytes); new DataView(large.buffer).setUint32(new TextEncoder().encode('foundry.sync.fork.v1\n').length, 600000);
    await expect(decodeSyncForkSubmission(large)).rejects.toMatchObject({ code: 'TOO_LARGE' });
  });
  it('rejects invented authors, parent substitution, missing/changed ancestry and stale final identity', async () => {
    const { parent, submission, before } = await fixture();
    for (const manifest of [
      { ...submission.manifest, publicationId: 'other' }, { ...submission.manifest, originalHash: 'b'.repeat(64) },
      { ...submission.manifest, baseIdentity: { ...parent.identity, hash: 'c'.repeat(64) } },
      { ...submission.manifest, ancestry: [] }, { ...submission.manifest, ancestry: [before.lineage, ...submission.manifest.ancestry] },
      { ...submission.manifest, ancestry: submission.manifest.ancestry.map((record) => ({ ...record, author: 'https://victim.example/actor' })) },
      { ...submission.manifest, document: { ...submission.manifest.document, changed: true } },
    ]) await expect(verifySyncForkSubmission({ ...submission, manifest }, parent, actor)).rejects.toThrow();
    await expect(verifySyncForkSubmission(submission, parent, 'https://other.example/actor')).rejects.toThrow();
    const record = parseCardLineageRecord(submission.manifest.ancestry[0]);
    expect(await verifyCardLineageRecord(record)).toBe(true); record.author = 'urn:forged'; expect(await verifyCardLineageRecord(record)).toBe(false);
    expect(() => parseCardLineageRecord({ ...record, operation: ['fork'] })).toThrow();
  });
  it('snapshots caller buffers and nested manifests before asynchronous verification', async () => {
    const { submission, parent } = await fixture(); const expected = structuredClone(submission);
    const pending = encodeSyncForkSubmission(submission); submission.assets[0]![0] = 9; submission.manifest.document.extra = 'changed';
    expect(await decodeSyncForkSubmission(await pending)).toEqual(expected);
    const verifying = verifySyncForkSubmission(expected, parent, actor); expected.assets[0]![0] = 8; parent.identity.hash = 'f'.repeat(64);
    expect((await verifying).assets[0]![0]).toBe(1);
  });
  it('signs the exact binary bundle, matches fork receipts and keeps the operation fingerprint across retries', async () => {
    const { submission } = await fixture(), bytes = await encodeSyncForkSubmission(submission);
    const keys = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']), keyId = `${actor}#one`, requestId = createSyncToken();
    const fingerprints = new Set(), nonces = new Set();
    const client = createSyncCommandClient({ baseUrl: 'https://hub.example/api/sync/v1', actor, keyId, privateKey: keys.privateKey,
      fetch: async (url, init) => {
        expect(String(url)).toBe('https://hub.example/api/sync/v1/commands/submit-fork/parent');
        const body = new Uint8Array(await new Response(init!.body).arrayBuffer()); expect(body).toEqual(bytes);
        const verified = await verifySyncHttp({ method: 'POST', url: String(url), headers: new Headers(init!.headers), body }, {
          resolveKey: async () => ({ actor, keyId, publicKey: keys.publicKey }), consumeNonce: async () => true,
        });
        expect(verified.contentType).toBe('application/octet-stream'); fingerprints.add(verified.requestHash); nonces.add(verified.nonce);
        return Response.json({ version: 'foundry.sync.command.v1', operation: 'forks.submit', requestId, cardId: 'card', revisionId: 'revision' });
      } });
    expect(await client.submitFork(bytes, requestId)).toMatchObject({ operation: 'forks.submit', cardId: 'card' });
    await client.submitFork(bytes, requestId); expect(fingerprints.size).toBe(1); expect(nonces.size).toBe(2);
  });
});
