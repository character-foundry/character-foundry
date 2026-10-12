/** Foundry sync HTTP profile v1 (unreleased). See docs/sync-http-v1.md. */
export const SYNC_HTTP_PROFILE = 'foundry-sync-v1' as const;
export const SYNC_HTTP_MAX_BYTES = 32 * 1024 * 1024;
export const SYNC_HTTP_MAX_AGE = 300;
export const SYNC_HTTP_CLOCK_SKEW = 30;
const components = '("@method" "@target-uri" "content-digest" "content-type" "foundry-sync-actor" "idempotency-key")';
const encoder = new TextEncoder();
export type SyncHttpErrorCode = 'MALFORMED' | 'TOO_LARGE' | 'EXPIRED' | 'UNTRUSTED_KEY' | 'INVALID_KEY' | 'INVALID_DIGEST' | 'INVALID_SIGNATURE' | 'REPLAY';
export class SyncHttpError extends Error {
  constructor(public readonly code: SyncHttpErrorCode, message: string) { super(message); this.name = 'SyncHttpError'; }
}
function fail(code: SyncHttpErrorCode, message: string): never { throw new SyncHttpError(code, message); }
export interface SyncHttpMessage { method: string; url: string; headers: Headers; body: Uint8Array }
export interface SyncNonceClaim {
  actor: string; keyId: string; nonce: string; requestId: string; requestHash: string;
  /** Unix seconds, including the verifier's clock-skew allowance. Retain through this instant. */
  retainUntil: number;
}
export interface VerifiedSyncHttp extends SyncNonceClaim {
  method: 'GET' | 'POST'; url: string; contentType: string;
  /** Owned bytes that were verified. Process these, never re-read the caller's message. */
  body: Uint8Array;
}
export interface SyncHttpKey { actor: string; keyId: string; publicKey: CryptoKey }

function base64(bytes: Uint8Array): string { return btoa(String.fromCharCode(...bytes)); }
function decode(value: string, size: number): Uint8Array<ArrayBuffer> {
  try {
    const bytes = Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
    if (bytes.length !== size || base64(bytes) !== value) fail('MALFORMED', 'Non-canonical signature encoding');
    return bytes;
  } catch { return fail('MALFORMED', 'Invalid signature encoding'); }
}
/** A fresh 256-bit token for each nonce or new logical operation ID. */
export function createSyncToken(): string {
  return base64(crypto.getRandomValues(new Uint8Array(32))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function token(value: string) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(value)) fail('MALFORMED', 'Expected a canonical 256-bit token');
  decode(value.replace(/-/g, '+').replace(/_/g, '/') + '=', 32);
  return value;
}
function seconds(value: number) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 999_999_999_999) fail('MALFORMED', 'Expected Unix seconds');
  return value;
}
function url(value: string) {
  try {
    const parsed = new URL(value);
    if (typeof value !== 'string' || value.length > 4096 || parsed.href !== value || parsed.protocol !== 'https:'
      || parsed.username || parsed.password || parsed.hash || /[^\x21-\x7e]/.test(value)) fail('MALFORMED', 'Expected a canonical HTTPS URL');
    return parsed;
  } catch { return fail('MALFORMED', 'Expected a canonical HTTPS URL'); }
}
function actorKey(actor: string, keyId: string) {
  const parsed = url(actor);
  if (actor.length > 1024 || parsed.search || typeof keyId !== 'string' || !keyId.startsWith(`${actor}#`)
    || !/^[A-Za-z0-9._-]{1,80}$/.test(keyId.slice(actor.length + 1))) fail('MALFORMED', 'Key ID must identify a key of the exact actor');
}
function key(value: CryptoKey, operation: 'sign' | 'verify') {
  if (!value || value.algorithm.name !== 'Ed25519' || value.type !== (operation === 'sign' ? 'private' : 'public')
    || !value.usages.includes(operation)) fail('INVALID_KEY', 'Expected an Ed25519 key with the required usage');
}
function snapshot(input: SyncHttpMessage): { method: 'GET' | 'POST'; url: string; body: Uint8Array<ArrayBuffer>; headers: Headers; contentType: string } {
  if (!(input.body instanceof Uint8Array) || input.body.byteLength > SYNC_HTTP_MAX_BYTES) fail('TOO_LARGE', 'Sync body exceeds 32 MiB');
  const method = input.method;
  if (method !== 'GET' && method !== 'POST') fail('MALFORMED', 'Sync supports GET and POST');
  if (method === 'GET' && input.body.byteLength) fail('MALFORMED', 'GET must have an empty body');
  const target = url(input.url).href;
  const body = new Uint8Array(input.body), headers = new Headers(input.headers);
  const contentType = headers.get('content-type');
  if (contentType !== 'application/json' && contentType !== 'application/octet-stream') fail('MALFORMED', 'Unsupported sync content type');
  if (headers.has('content-encoding')) fail('MALFORMED', 'Content encoding is not supported by this profile');
  return { method, url: target, body, headers, contentType };
}
async function hash(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
}
function signatureBase(message: ReturnType<typeof snapshot>, parameters: string): string {
  return [
    `"@method": ${message.method}`, `"@target-uri": ${message.url}`,
    `"content-digest": ${message.headers.get('content-digest')}`,
    `"content-type": ${message.contentType}`,
    `"foundry-sync-actor": ${message.headers.get('foundry-sync-actor')}`,
    `"idempotency-key": ${message.headers.get('idempotency-key')}`,
    `"@signature-params": ${parameters}`,
  ].join('\n');
}

/** Produces owned transport values; never fetches a URL or discovers a key. */
export async function signSyncHttp(input: {
  method: 'GET' | 'POST'; url: string; body: Uint8Array; contentType: 'application/json' | 'application/octet-stream';
  actor: string; keyId: string; privateKey: CryptoKey; requestId: string; nonce?: string; created?: number; lifetime?: number;
}): Promise<SyncHttpMessage> {
  // Capture all mutable caller values before the first await.
  const { actor, keyId, privateKey } = input;
  actorKey(actor, keyId); key(privateKey, 'sign');
  const requestId = token(input.requestId), nonce = token(input.nonce ?? createSyncToken());
  const created = seconds(input.created ?? Math.floor(Date.now() / 1000));
  const lifetime = input.lifetime ?? SYNC_HTTP_MAX_AGE;
  if (!Number.isInteger(lifetime) || lifetime < 1 || lifetime > SYNC_HTTP_MAX_AGE) fail('MALFORMED', 'Signature lifetime must be 1–300 seconds');
  const expires = seconds(created + lifetime);
  const message = snapshot({ method: input.method, url: input.url, body: input.body, headers: new Headers({
    'content-type': input.contentType, 'foundry-sync-actor': actor, 'idempotency-key': requestId,
  }) });
  message.headers.set('content-digest', `sha-256=:${base64(await hash(message.body))}:`);
  const parameters = `${components};created=${created};expires=${expires};nonce="${nonce}";keyid="${keyId}";alg="ed25519";tag="${SYNC_HTTP_PROFILE}"`;
  const signature = await crypto.subtle.sign('Ed25519', privateKey, encoder.encode(signatureBase(message, parameters)));
  message.headers.set('signature-input', `foundry=${parameters}`);
  message.headers.set('signature', `foundry=:${base64(new Uint8Array(signature))}:`);
  return { method: message.method, url: message.url, headers: message.headers, body: message.body };
}

/**
 * Strict profile verification, including mandatory atomic replay admission.
 * The host must resolve only pretrusted actor/key pairs and recheck application
 * permissions/idempotency at commit. Signature validity grants no write scope.
 */
export async function verifySyncHttp(input: SyncHttpMessage, options: {
  now?: number;
  resolveKey(actor: string, keyId: string): Promise<SyncHttpKey | null>;
  /** Atomically insert (actor, nonce) if absent; false means replay. Never use check-then-set. */
  consumeNonce(claim: Readonly<SyncNonceClaim>): Promise<boolean>;
}): Promise<VerifiedSyncHttp> {
  const message = snapshot(input), now = seconds(options.now ?? Math.floor(Date.now() / 1000));
  const resolveKey = options.resolveKey, consumeNonce = options.consumeNonce;
  if (typeof resolveKey !== 'function' || typeof consumeNonce !== 'function') fail('MALFORMED', 'Trusted key resolution and atomic replay admission are required');
  const actor = message.headers.get('foundry-sync-actor') ?? '';
  const requestId = token(message.headers.get('idempotency-key') ?? '');
  const signatureInput = message.headers.get('signature-input') ?? '';
  // A deliberately narrow RFC 9421 structured-field profile. Reject duplicate
  // labels/parameters, extra coverage choices and algorithm downgrade attempts.
  if (signatureInput.length > 4096 || !signatureInput.startsWith(`foundry=${components};`)) fail('MALFORMED', 'Unexpected signature profile');
  const tail = signatureInput.slice(`foundry=${components};`.length);
  const match = /^created=(0|[1-9][0-9]{0,11});expires=(0|[1-9][0-9]{0,11});nonce="([A-Za-z0-9_-]{43})";keyid="([^"\\\s]{1,1110})";alg="ed25519";tag="foundry-sync-v1"$/.exec(tail);
  if (!match) fail('MALFORMED', 'Invalid signature parameters');
  const created = seconds(Number(match[1])), expires = seconds(Number(match[2]));
  const nonce = token(match[3]!), keyId = match[4]!;
  actorKey(actor, keyId);
  if (expires <= created || expires - created > SYNC_HTTP_MAX_AGE || created > now + SYNC_HTTP_CLOCK_SKEW
    || now > expires + SYNC_HTTP_CLOCK_SKEW) fail('EXPIRED', 'Signature is outside its validity window');
  const digest = `sha-256=:${base64(await hash(message.body))}:`;
  if (message.headers.get('content-digest') !== digest) fail('INVALID_DIGEST', 'Body digest mismatch');
  const signature = /^foundry=:([A-Za-z0-9+/]{86}==):$/.exec(message.headers.get('signature') ?? '');
  if (!signature) fail('MALFORMED', 'Invalid signature field');
  const signatureBytes = decode(signature[1]!, 64);
  const trusted = await resolveKey(actor, keyId);
  if (!trusted || trusted.actor !== actor || trusted.keyId !== keyId) fail('UNTRUSTED_KEY', 'Actor/key pair is not trusted');
  const publicKey = trusted.publicKey; key(publicKey, 'verify');
  if (!await crypto.subtle.verify('Ed25519', publicKey, signatureBytes,
    encoder.encode(signatureBase(message, signatureInput.slice('foundry='.length))))) fail('INVALID_SIGNATURE', 'Signature verification failed');
  // A logical operation is independent of the signing key, nonce and time so
  // retries/rotation can share an ID. The app must pair this hash with that ID.
  const requestHash = Array.from(await hash(encoder.encode(JSON.stringify([
    SYNC_HTTP_PROFILE, actor, message.method, message.url, message.contentType, digest,
  ]))), (byte) => byte.toString(16).padStart(2, '0')).join('');
  const claim = Object.freeze({ actor, keyId, nonce, requestId, requestHash, retainUntil: expires + SYNC_HTTP_CLOCK_SKEW });
  if (!await consumeNonce(claim)) fail('REPLAY', 'Request nonce was already consumed');
  return { ...claim, method: message.method, url: message.url, contentType: message.contentType, body: message.body };
}
