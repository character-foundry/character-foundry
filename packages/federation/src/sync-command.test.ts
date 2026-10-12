import { beforeAll, describe, expect, it } from 'vitest';
import { createSyncToken, verifySyncHttp } from './sync-http.js';
import { createSyncCommandClient, parseSyncCommand, encodeSyncCommand, decodeSyncCommand, parseSyncCommandReceipt,
  SYNC_COMMAND_VERSION, SYNC_COMMAND_MAX_BYTES } from './sync-command.js';
let key: CryptoKeyPair;
beforeAll(async () => { key = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']); });
const actor = 'https://peer.example/actor', keyId = `${actor}#one`, baseUrl = 'https://hub.example/api/sync/v1';
const selection = { revisionIds: ['one', 'two'], policy: { visibility: 'members' as const, allowFork: true } };
const command = { version: SYNC_COMMAND_VERSION, operation: 'publications.publish' as const, ...selection };
const receipt = (requestId: string) => ({ version: SYNC_COMMAND_VERSION, operation: 'publications.publish', requestId,
  publications: [{ id: 'p-one', policyVersion: 1 }, { id: 'p-two', policyVersion: 1 }] });
const client = (fetch: typeof globalThis.fetch, timeoutMs = 30000) => createSyncCommandClient({ baseUrl, actor, keyId, privateKey: key.privateKey, fetch, timeoutMs });

describe('signed publication command v1', () => {
  it('owns strict bounded selections and rejects caller-selected identity or original permissions', () => {
    const parsed = parseSyncCommand(command); if (parsed.operation !== 'publications.publish') throw new Error('Wrong operation');
    parsed.revisionIds.push('changed'); expect(selection.revisionIds).toEqual(['one', 'two']);
    expect(decodeSyncCommand(encodeSyncCommand(command))).toEqual(command);
    for (const change of [{ actor }, { workspaceId: 'foreign' }, { version: 'v2' }, { revisionIds: [] }, { revisionIds: Array(1) }, { revisionIds: ['a', 'a'] },
      { revisionIds: Array.from({ length: 21 }, (_, n) => `r${n}`) }, { revisionIds: ['../private'] },
      { policy: { ...selection.policy, allowOriginal: true } }, { policy: { visibility: 'everyone', allowFork: true } }]) {
      expect(() => parseSyncCommand({ ...command, ...change })).toThrow();
    }
    expect(() => decodeSyncCommand(new Uint8Array(SYNC_COMMAND_MAX_BYTES + 1))).toThrow();
    expect(() => decodeSyncCommand(new Uint8Array([0xff]))).toThrow();
    expect(() => parseSyncCommand({ version: SYNC_COMMAND_VERSION, operation: 'publications.fork', publicationId: 'p', author: actor })).toThrow();
  });

  it('signs exact canonical selections with explicit stable IDs and fresh nonces for each retry', async () => {
    const nonces = new Set<string>(), hashes = new Set<string>(), requestId = createSyncToken();
    const sdk = client(async (url, init) => {
      expect(String(url)).toBe(`${baseUrl}/commands/publish`); expect(init).toMatchObject({ method: 'POST', credentials: 'omit', redirect: 'manual' });
      const body = new Uint8Array(await new Response(init!.body).arrayBuffer());
      const verified = await verifySyncHttp({ method: 'POST', url: String(url), headers: new Headers(init!.headers), body }, {
        resolveKey: async () => ({ actor, keyId, publicKey: key.publicKey }), consumeNonce: async (claim) => { nonces.add(claim.nonce); return true; },
      });
      expect(verified.requestId).toBe(requestId); hashes.add(verified.requestHash); expect(decodeSyncCommand(verified.body)).toEqual(command);
      return Response.json(receipt(requestId));
    });
    expect(await sdk.publish(selection, requestId)).toEqual(receipt(requestId));
    expect(await sdk.publish(selection, requestId)).toEqual(receipt(requestId));
    expect(nonces.size).toBe(2); expect(hashes.size).toBe(1);
    await expect(sdk.publish(selection, 'automatic')).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
  });

  it('rejects substituted, duplicate, excessive and noninitial acknowledgements', async () => {
    const requestId = createSyncToken();
    for (const value of [{ ...receipt(requestId), extra: true }, { ...receipt(requestId), requestId: createSyncToken() },
      { ...receipt(requestId), publications: [] }, { ...receipt(requestId), publications: [{ id: 'one', policyVersion: 2 }] },
      { ...receipt(requestId), publications: [{ id: 'one', policyVersion: 1 }, { id: 'one', policyVersion: 1 }] },
      { version: SYNC_COMMAND_VERSION, operation: 'publications.fork', requestId, cardId: 'one', revisionId: 'two' }]) {
      await expect(client(async () => Response.json(value)).publish(selection, requestId)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    }
    expect(parseSyncCommandReceipt({ version: SYNC_COMMAND_VERSION, operation: 'publications.fork', requestId, cardId: 'c', revisionId: 'r' })).toMatchObject({ cardId: 'c' });
    expect(await client(async () => Response.json({ version: SYNC_COMMAND_VERSION, operation: 'publications.fork', requestId, cardId: 'c', revisionId: 'r' })).fork('pub', requestId)).toMatchObject({ revisionId: 'r' });
  });

  it('bounds receipts, refuses redirects and reports conflicts without retrying', async () => {
    const requestId = createSyncToken();
    for (const [response, code] of [[new Response('', { status: 302, headers: { location: 'https://other.example/' } }), 'INVALID_RESPONSE'],
      [new Response('{}', { status: 409 }), 'OPERATION_CONFLICT'], [new Response('private trace', { status: 503 }), 'UNAVAILABLE'],
      [new Response('a'.repeat(SYNC_COMMAND_MAX_BYTES + 1), { headers: { 'content-type': 'application/json' } }), 'TOO_LARGE'],
      [new Response('not json', { headers: { 'content-type': 'application/json' } }), 'INVALID_RESPONSE']] as const) {
      let calls = 0; await expect(client(async () => { calls++; return response; }).publish(selection, requestId)).rejects.toMatchObject({ code }); expect(calls).toBe(1);
    }
    const controller = new AbortController(); controller.abort();
    await expect(client(async () => { throw new Error('must not send'); }).fork('p', requestId, controller.signal)).rejects.toMatchObject({ code: 'UNAVAILABLE' });
    let cancelled = false;
    await expect(client(async () => new Response(new ReadableStream({ cancel() { cancelled = true; } }), { headers: { 'content-type': 'application/json' } }), 5)
      .fork('p', requestId)).rejects.toMatchObject({ code: 'UNAVAILABLE' }); expect(cancelled).toBe(true);
  });
});
