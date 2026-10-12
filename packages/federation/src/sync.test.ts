import { readFileSync } from 'node:fs';
import { createPublicKey, verify as nativeVerify } from 'node:crypto';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createSyncToken, signSyncHttp, verifySyncHttp, SYNC_HTTP_MAX_BYTES } from './sync.js';
import type { SyncHttpMessage, SyncNonceClaim } from './sync.js';

const vector = JSON.parse(readFileSync(new URL('../fixtures/sync-http-v1.json', import.meta.url), 'utf8'));
const bytes = (value: string) => new TextEncoder().encode(value);
let privateKey: CryptoKey, publicKey: CryptoKey;
beforeAll(async () => {
  privateKey = await crypto.subtle.importKey('pkcs8', Buffer.from(vector.privateKeyPkcs8, 'base64'), 'Ed25519', false, ['sign']);
  publicKey = await crypto.subtle.importKey('spki', Buffer.from(vector.publicKeySpki, 'base64'), 'Ed25519', false, ['verify']);
});
const input = () => ({ method: 'POST' as const, url: vector.url, body: bytes(vector.body), contentType: 'application/json' as const,
  actor: vector.actor, keyId: vector.keyId, privateKey, requestId: vector.requestId, nonce: vector.nonce, created: vector.created });
function verifier() {
  const seen = new Set<string>();
  const consumeNonce = vi.fn(async (claim: Readonly<SyncNonceClaim>) => {
    const id = `${claim.actor}\n${claim.nonce}`;
    if (seen.has(id)) return false; seen.add(id); return true;
  });
  return { now: vector.created, resolveKey: vi.fn(async () => ({ actor: vector.actor, keyId: vector.keyId, publicKey })), consumeNonce };
}
const clone = (message: SyncHttpMessage) => ({ ...message, body: new Uint8Array(message.body), headers: new Headers(message.headers) });

describe('signed HTTP sync v1 profile', () => {
  it('matches independently assembled Node-crypto vectors, including exact RFC signature-base bytes', async () => {
    const message = await signSyncHttp(input());
    expect(message.headers.get('content-digest')).toBe(vector.contentDigest);
    expect(message.headers.get('signature-input')).toBe(vector.signatureInput);
    expect(message.headers.get('signature')).toBe(vector.signature);
    expect(nativeVerify(null, Buffer.from(vector.signatureBase), createPublicKey({ key: Buffer.from(vector.publicKeySpki, 'base64'), format: 'der', type: 'spki' }),
      Buffer.from(message.headers.get('signature')!.slice(9, -1), 'base64'))).toBe(true);
    const verify = verifier(); const result = await verifySyncHttp(message, verify);
    expect(result).toMatchObject({ actor: vector.actor, keyId: vector.keyId, nonce: vector.nonce, requestId: vector.requestId,
      requestHash: vector.requestHash, retainUntil: vector.expires + 30 });
    expect(result.body).toEqual(bytes(vector.body)); expect(verify.consumeNonce).toHaveBeenCalledOnce();
    expect(Object.isFrozen(verify.consumeNonce.mock.calls[0]![0])).toBe(true);
  });

  it('requires signed exact body bytes, target/query, method, media type, actor and operation ID', async () => {
    const signed = await signSyncHttp(input());
    const mutations: ((message: SyncHttpMessage) => void)[] = [
      (m) => { m.body[0] ^= 1; }, (m) => { m.url = m.url.replace('hub.example', 'other.example'); },
      (m) => { m.url += '&extra=1'; }, (m) => { m.method = 'GET'; m.body = new Uint8Array(); },
      (m) => { m.headers.set('content-type', 'application/octet-stream'); },
      (m) => { m.headers.set('foundry-sync-actor', 'https://peer.example/actors/test-other'); },
      (m) => { m.headers.set('idempotency-key', createSyncToken()); },
    ];
    for (const mutate of mutations) {
      const message = clone(signed), options = verifier(); mutate(message);
      await expect(verifySyncHttp(message, options)).rejects.toThrow(); expect(options.consumeNonce).not.toHaveBeenCalled();
    }
    const recomputed = clone(signed); recomputed.body = bytes('altered');
    recomputed.headers.set('content-digest', (await signSyncHttp({ ...input(), body: recomputed.body })).headers.get('content-digest')!);
    await expect(verifySyncHttp(recomputed, verifier())).rejects.toMatchObject({ code: 'INVALID_SIGNATURE' });
  });

  it('rejects missing/unsigned digests, duplicates, extra parameters, downgrade algorithms and noncanonical encodings', async () => {
    const signed = await signSyncHttp(input());
    for (const name of ['content-digest', 'content-type', 'foundry-sync-actor', 'idempotency-key', 'signature-input', 'signature']) {
      const message = clone(signed), options = verifier(); message.headers.delete(name);
      await expect(verifySyncHttp(message, options)).rejects.toThrow(); expect(options.consumeNonce).not.toHaveBeenCalled();
      const duplicate = clone(signed); duplicate.headers.append(name, signed.headers.get(name)!);
      await expect(verifySyncHttp(duplicate, verifier())).rejects.toThrow();
    }
    for (const replacement of [vector.signatureInput.replace('"content-digest" ', ''), vector.signatureInput + ';created=1',
      vector.signatureInput.replace('ed25519', 'rsa-sha256'), vector.signatureInput.replace('foundry-sync-v1', 'foundry-sync-v2'),
      vector.signatureInput.replace('foundry=', 'other='), vector.signatureInput.replace(/;nonce="[^"]+"/, ';nonce="short"')]) {
      const message = clone(signed); message.headers.set('signature-input', replacement);
      await expect(verifySyncHttp(message, verifier())).rejects.toMatchObject({ code: 'MALFORMED' });
    }
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const signatureBytes = signed.headers.get('signature')!.slice(9, -1);
    const alternatePadding = signatureBytes.slice(0, 85) + alphabet[alphabet.indexOf(signatureBytes[85]!) + 1] + '==';
    const noncanonical = clone(signed); noncanonical.headers.set('signature', `foundry=:${alternatePadding}:`);
    await expect(verifySyncHttp(noncanonical, verifier())).rejects.toMatchObject({ code: 'MALFORMED' });
    const encoded = clone(signed); encoded.headers.set('content-encoding', 'gzip');
    await expect(verifySyncHttp(encoded, verifier())).rejects.toMatchObject({ code: 'MALFORMED' });
  });

  it('requires an exact allowlisted actor/key pair and never admits a nonce for a wrong key', async () => {
    const message = await signSyncHttp(input());
    for (const trusted of [null, { actor: vector.actor + '-other', keyId: vector.keyId, publicKey },
      { actor: vector.actor, keyId: vector.keyId + '-other', publicKey }]) {
      const options = verifier(); options.resolveKey.mockResolvedValueOnce(trusted as never);
      await expect(verifySyncHttp(message, options)).rejects.toMatchObject({ code: 'UNTRUSTED_KEY' }); expect(options.consumeNonce).not.toHaveBeenCalled();
    }
    const pair = await crypto.subtle.generateKey('Ed25519', false, ['sign', 'verify']);
    const options = verifier(); options.resolveKey.mockResolvedValueOnce({ actor: vector.actor, keyId: vector.keyId, publicKey: pair.publicKey });
    await expect(verifySyncHttp(message, options)).rejects.toMatchObject({ code: 'INVALID_SIGNATURE' }); expect(options.consumeNonce).not.toHaveBeenCalled();
  });

  it('bounds signature validity and retains replay claims through the full skew window', async () => {
    const message = await signSyncHttp(input());
    for (const now of [vector.created - 31, vector.expires + 31]) {
      const options = { ...verifier(), now };
      await expect(verifySyncHttp(message, options)).rejects.toMatchObject({ code: 'EXPIRED' }); expect(options.consumeNonce).not.toHaveBeenCalled();
    }
    for (const now of [vector.created - 30, vector.expires + 30]) await expect(verifySyncHttp(message, { ...verifier(), now })).resolves.toMatchObject({ retainUntil: vector.expires + 30 });
    await expect(signSyncHttp({ ...input(), lifetime: 301 })).rejects.toMatchObject({ code: 'MALFORMED' });
  });

  it('requires replay admission, rejects a repeated nonce and preserves logical operation identity across fresh signatures', async () => {
    const message = await signSyncHttp(input()), options = verifier();
    const attempts = await Promise.allSettled([verifySyncHttp(message, options), verifySyncHttp(message, options)]);
    expect(attempts.filter((value) => value.status === 'fulfilled')).toHaveLength(1);
    expect(attempts.find((value) => value.status === 'rejected')).toMatchObject({ reason: { code: 'REPLAY' } });
    const retry = await verifySyncHttp(await signSyncHttp({ ...input(), nonce: createSyncToken(), created: vector.created + 1 }), verifier());
    expect(retry.requestHash).toBe(vector.requestHash); expect(retry.requestId).toBe(vector.requestId);
    const changed = await verifySyncHttp(await signSyncHttp({ ...input(), body: bytes('different operation') }), verifier());
    expect(changed.requestHash).not.toBe(vector.requestHash);
    await expect(verifySyncHttp(message, { ...verifier(), consumeNonce: undefined } as never)).rejects.toMatchObject({ code: 'MALFORMED' });
    await expect(verifySyncHttp(message, { ...verifier(), consumeNonce: async () => { throw new Error('durable storage unavailable'); } })).rejects.toThrow('durable storage unavailable');
  });

  it('owns inputs across asynchronous signing and verification and supports signed empty GETs', async () => {
    const original = input(); const signing = signSyncHttp(original); original.body.fill(0); original.actor = 'changed';
    const signed = await signing; expect(signed.body).toEqual(bytes(vector.body));
    const checking = verifySyncHttp(signed, verifier()); signed.body.fill(0); signed.headers.set('idempotency-key', createSyncToken());
    expect((await checking).body).toEqual(bytes(vector.body));
    const get = await signSyncHttp({ ...input(), method: 'GET', body: new Uint8Array() });
    expect((await verifySyncHttp(get, verifier())).body).toHaveLength(0);
    await expect(signSyncHttp({ ...input(), method: 'GET' })).rejects.toMatchObject({ code: 'MALFORMED' });
  });

  it('rejects oversized bodies, ambiguous URLs and actor/key confusion before signing', async () => {
    await expect(signSyncHttp({ ...input(), body: new Uint8Array(SYNC_HTTP_MAX_BYTES + 1) })).rejects.toMatchObject({ code: 'TOO_LARGE' });
    for (const url of ['http://hub.example/publish', 'https://hub.example:443/publish', 'https://user@hub.example/publish', 'https://hub.example/publish#fragment']) {
      await expect(signSyncHttp({ ...input(), url })).rejects.toMatchObject({ code: 'MALFORMED' });
    }
    await expect(signSyncHttp({ ...input(), keyId: vector.actor + '-fake#key' })).rejects.toMatchObject({ code: 'MALFORMED' });
    expect(createSyncToken()).not.toBe(createSyncToken());
  });
});
