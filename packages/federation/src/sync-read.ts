import { canonicalJson, IdentityError, computeCardContentIdentity, readCardLineage, verifyCardLineage } from '@character-foundry/identity';
import type { CardIdentityOptions } from '@character-foundry/identity';
import { createSyncToken, signSyncHttp, SYNC_HTTP_PROFILE, SYNC_HTTP_MAX_BYTES } from './sync-http.js';

export const SYNC_READ_VERSION = 'foundry.sync.read.v1' as const;
export const SYNC_READ_MAX_JSON_BYTES = 8 * 1024 * 1024;
export const SYNC_READ_MAX_DOCUMENT_BYTES = 256 * 1024;
export const SYNC_READ_PAGE_SIZE = 20;
export const SYNC_READ_OPERATIONS = ['publications.list', 'publications.get', 'assets.get'] as const;
export type SyncReadErrorCode = 'INVALID_REQUEST' | 'INVALID_RESPONSE' | 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'CHANGED' | 'TOO_LARGE' | 'RATE_LIMITED' | 'UNAVAILABLE';
export class SyncReadError extends Error {
  constructor(public readonly code: SyncReadErrorCode, message: string, public readonly status?: number) { super(message); this.name = 'SyncReadError'; }
}
export interface SyncReadCapabilities {
  version: typeof SYNC_READ_VERSION; transport: typeof SYNC_HTTP_PROFILE;
  operations: readonly (typeof SYNC_READ_OPERATIONS)[number][];
  limits: { pageSize: number; documentBytes: number; assetBytes: number; assetsPerPublication: number };
}
export interface SyncReadAsset {
  path: string; hash: string; byteLength: number; mediaType: string;
  binding: { kind: 'portrait' } | { kind: 'uri'; pointer: string };
}
export interface SyncReadPublication {
  id: string; document: Record<string, unknown>; identity: { algorithm: string; hash: string }; originalHash: string;
  parentId: string | null; publishedAt: string;
  policy: { visibility: 'private' | 'members' | 'public'; allowFork: boolean; version: number };
  assets: SyncReadAsset[];
}
export interface SyncReadPage { version: typeof SYNC_READ_VERSION; publications: SyncReadPublication[]; nextAfter: string | null }
export interface SyncReadSelection { after?: string; limit?: number; parent?: string }
const encoder = new TextEncoder();
function invalid(message: string): never { throw new SyncReadError('INVALID_RESPONSE', message); }
function object(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== keys.length
    || keys.some((key) => !Object.hasOwn(value, key))) invalid('Unexpected or missing protocol fields');
  return value as Record<string, unknown>;
}
function text(value: unknown, max: number): string {
  if (typeof value !== 'string' || !value || value.length > max || Array.from(value).some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) invalid('Invalid protocol string');
  return value;
}
export function syncResourceId(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value)) throw new SyncReadError('INVALID_REQUEST', 'Invalid publication ID or cursor');
  return value;
}
function responseId(value: unknown): string {
  try { return syncResourceId(value); } catch { return invalid('Invalid response publication ID or cursor'); }
}
function hash(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) invalid('Expected a SHA-256 digest');
  return value;
}
function count(value: unknown, max: number, minimum = 0): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum || value > max) invalid('Invalid protocol count');
  return value;
}
function boolean(value: unknown): boolean { if (typeof value !== 'boolean') invalid('Invalid protocol boolean'); return value; }
function jsonDocument(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid('Expected a card document');
  let encoded: string;
  try { encoded = canonicalJson(value); }
  catch (error) {
    if (error instanceof IdentityError && error.code === 'LIMIT') throw new SyncReadError('TOO_LARGE', 'Card document exceeds structural limits');
    return invalid('Expected a plain acyclic JSON document');
  }
  if (encoder.encode(encoded).length > SYNC_READ_MAX_DOCUMENT_BYTES) throw new SyncReadError('TOO_LARGE', 'Card document exceeds the read profile limit');
  return JSON.parse(encoded) as Record<string, unknown>;
}
export function syncReadCapabilities(): SyncReadCapabilities {
  return { version: SYNC_READ_VERSION, transport: SYNC_HTTP_PROFILE, operations: [...SYNC_READ_OPERATIONS],
    limits: { pageSize: SYNC_READ_PAGE_SIZE, documentBytes: SYNC_READ_MAX_DOCUMENT_BYTES, assetBytes: SYNC_HTTP_MAX_BYTES, assetsPerPublication: 64 } };
}
export function parseSyncReadCapabilities(input: unknown): SyncReadCapabilities {
  const value = object(input, ['version', 'transport', 'operations', 'limits']);
  const operations = value.operations;
  if (value.version !== SYNC_READ_VERSION || value.transport !== SYNC_HTTP_PROFILE || !Array.isArray(operations)
    || operations.length !== SYNC_READ_OPERATIONS.length || SYNC_READ_OPERATIONS.some((item, index) => operations[index] !== item)) invalid('Unsupported read protocol or operations');
  const limits = object(value.limits, ['pageSize', 'documentBytes', 'assetBytes', 'assetsPerPublication']);
  return { version: SYNC_READ_VERSION, transport: SYNC_HTTP_PROFILE, operations: [...SYNC_READ_OPERATIONS], limits: {
    pageSize: count(limits.pageSize, SYNC_READ_PAGE_SIZE, 1), documentBytes: count(limits.documentBytes, SYNC_READ_MAX_DOCUMENT_BYTES, 1),
    assetBytes: count(limits.assetBytes, SYNC_HTTP_MAX_BYTES, 1), assetsPerPublication: count(limits.assetsPerPublication, 64, 1),
  } };
}
export function parseSyncReadPublication(input: unknown): SyncReadPublication {
  const value = object(input, ['id', 'document', 'identity', 'originalHash', 'parentId', 'publishedAt', 'policy', 'assets']);
  const identity = object(value.identity, ['algorithm', 'hash']);
  const policy = object(value.policy, ['visibility', 'allowFork', 'version']);
  if (!['private', 'members', 'public'].includes(String(policy.visibility))) invalid('Invalid publication visibility');
  const publishedAt = text(value.publishedAt, 32);
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(publishedAt) || !Number.isFinite(Date.parse(publishedAt)) || new Date(publishedAt).toISOString() !== publishedAt) invalid('Expected a canonical publication date');
  if (!Array.isArray(value.assets) || value.assets.length > 64) invalid('Invalid asset manifest');
  const paths = new Set<string>(), bindings = new Set<string>();
  const assets = value.assets.map((entry) => {
    const asset = object(entry, ['path', 'hash', 'byteLength', 'mediaType', 'binding']);
    const path = text(asset.path, 512);
    if (path.includes('\\') || path.split('/').some((part) => !part || part === '.' || part === '..') || paths.has(path)) invalid('Invalid or duplicate asset path');
    paths.add(path);
    if (!asset.binding || typeof asset.binding !== 'object' || Array.isArray(asset.binding)) invalid('Invalid asset binding');
    const kind = (asset.binding as Record<string, unknown>).kind;
    const binding = object(asset.binding, kind === 'portrait' ? ['kind'] : ['kind', 'pointer']);
    let output: SyncReadAsset['binding'];
    if (kind === 'portrait') output = { kind };
    else if (kind === 'uri' && typeof binding.pointer === 'string' && /^\/assets\/(0|[1-9][0-9]{0,5})\/uri$/.test(binding.pointer)) output = { kind, pointer: binding.pointer };
    else return invalid('Invalid portable asset binding');
    const key = output.kind === 'portrait' ? 'portrait' : output.pointer;
    if (bindings.has(key)) invalid('Duplicate portable asset binding'); bindings.add(key);
    const mediaType = text(asset.mediaType, 200);
    if (!/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(mediaType)) invalid('Expected a bare lowercase media type');
    return { path, hash: hash(asset.hash), byteLength: count(asset.byteLength, SYNC_HTTP_MAX_BYTES), mediaType, binding: output };
  });
  return { id: responseId(value.id), document: jsonDocument(value.document), identity: { algorithm: text(identity.algorithm, 80), hash: hash(identity.hash) },
    originalHash: hash(value.originalHash), parentId: value.parentId === null ? null : responseId(value.parentId), publishedAt,
    policy: { visibility: policy.visibility as SyncReadPublication['policy']['visibility'], allowFork: boolean(policy.allowFork), version: count(policy.version, Number.MAX_SAFE_INTEGER, 1) }, assets };
}
export function parseSyncReadPage(input: unknown): SyncReadPage {
  const value = object(input, ['version', 'publications', 'nextAfter']);
  if (value.version !== SYNC_READ_VERSION || !Array.isArray(value.publications) || value.publications.length > SYNC_READ_PAGE_SIZE) invalid('Invalid publication page');
  const publications = value.publications.map(parseSyncReadPublication);
  if (publications.some((item, index) => index > 0 && item.id <= publications[index - 1]!.id)) invalid('Publications must be strictly ID ordered');
  const nextAfter = value.nextAfter === null ? null : responseId(value.nextAfter);
  if (nextAfter !== null && nextAfter !== publications.at(-1)?.id) invalid('Cursor must identify the final visible publication');
  return { version: SYNC_READ_VERSION, publications, nextAfter };
}
/** Portable manifest bindings feed the same versioned identity implementation used by import/export. */
export async function verifySyncReadPublication(input: unknown): Promise<SyncReadPublication> {
  const publication = parseSyncReadPublication(input);
  const options: CardIdentityOptions = { assets: publication.assets.flatMap((asset) => asset.binding.kind === 'uri' ? [{ pointer: asset.binding.pointer, hash: asset.hash }] : []),
    ...(publication.assets.some((asset) => asset.binding.kind === 'portrait') ? { portraitHash: publication.assets.find((asset) => asset.binding.kind === 'portrait')!.hash } : {}) };
  try {
    const identity = await computeCardContentIdentity(publication.document, options);
    if (identity.algorithm !== publication.identity.algorithm || identity.hash !== publication.identity.hash) invalid('Publication content identity does not match');
    const lineage = readCardLineage(publication.document);
    if (lineage && (lineage.originalHash !== publication.originalHash || !await verifyCardLineage(publication.document, options))) invalid('Publication lineage does not match');
  } catch (error) { if (error instanceof SyncReadError) throw error; invalid('Publication identity or lineage is invalid'); }
  return publication;
}
export function parseSyncReadSelection(params: URLSearchParams): SyncReadSelection {
  if ([...params.keys()].some((key) => !['after', 'limit', 'parent'].includes(key) || params.getAll(key).length !== 1)) throw new SyncReadError('INVALID_REQUEST', 'Invalid publication query');
  const value: SyncReadSelection = {};
  if (params.has('after')) value.after = syncResourceId(params.get('after'));
  if (params.has('parent')) value.parent = syncResourceId(params.get('parent'));
  if (params.has('limit')) {
    const limit = params.get('limit')!;
    if (!/^(?:[1-9]|1[0-9]|20)$/.test(limit)) throw new SyncReadError('INVALID_REQUEST', 'Page size must be 1–20');
    value.limit = Number(limit);
  }
  return value;
}

/** Signed, credential-free reads against one configured HTTPS base; no discovery or redirects. */
export function createSyncReadClient(options: { baseUrl: string; actor: string; keyId: string; privateKey: CryptoKey; fetch?: typeof fetch; timeoutMs?: number }) {
  const { baseUrl, actor, keyId, privateKey } = options;
  const fetcher = options.fetch ?? globalThis.fetch;
  const timeout = options.timeoutMs ?? 30_000;
  const base = new URL(baseUrl);
  if (base.href !== baseUrl || base.protocol !== 'https:' || base.username || base.password || base.search || base.hash || baseUrl.endsWith('/')
    || !Number.isSafeInteger(timeout) || timeout < 1 || timeout > 120_000) throw new SyncReadError('INVALID_REQUEST', 'Expected an exact HTTPS base without trailing slash and a bounded timeout');
  async function request(path: string, max: number, mediaType: string, signal?: AbortSignal) {
    if (signal?.aborted) throw new SyncReadError('UNAVAILABLE', 'Sync request cancelled');
    const url = `${baseUrl}/${path}`;
    const signed = await signSyncHttp({ method: 'GET', url, body: new Uint8Array(), contentType: 'application/json', actor, keyId, privateKey, requestId: createSyncToken() });
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true }); if (signal?.aborted) controller.abort();
    const timer = setTimeout(abort, timeout);
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    const cancel = () => { void reader?.cancel().catch(() => undefined); };
    controller.signal.addEventListener('abort', cancel, { once: true });
    try {
      if (controller.signal.aborted) throw new SyncReadError('UNAVAILABLE', 'Sync request cancelled');
      const response = await fetcher(url, { method: 'GET', headers: signed.headers, redirect: 'manual', credentials: 'omit', cache: 'no-store', signal: controller.signal });
      if (response.redirected || (response.status >= 300 && response.status < 400) || (response.url && response.url !== url)) {
        await response.body?.cancel(); invalid('Redirected sync responses are forbidden');
      }
      if (!response.ok) {
        await response.body?.cancel();
        const code: SyncReadErrorCode = ({ 400: 'INVALID_REQUEST', 401: 'UNAUTHENTICATED', 403: 'FORBIDDEN', 404: 'NOT_FOUND', 409: 'CHANGED', 413: 'TOO_LARGE', 429: 'RATE_LIMITED' } as Record<number, SyncReadErrorCode>)[response.status] ?? 'UNAVAILABLE';
        throw new SyncReadError(code, `Sync request failed (${response.status})`, response.status);
      }
      if (response.status !== 200 || response.headers.get('content-type')?.split(';')[0] !== mediaType) { await response.body?.cancel(); invalid('Unexpected response status or media type'); }
      const length = response.headers.get('content-length');
      if (length !== null && (!/^(0|[1-9][0-9]*)$/.test(length) || Number(length) > max)) { await response.body?.cancel(); throw new SyncReadError('TOO_LARGE', 'Sync response exceeds its byte limit'); }
      reader = response.body?.getReader(); const chunks: Uint8Array[] = []; let size = 0;
      if (controller.signal.aborted) throw new SyncReadError('UNAVAILABLE', 'Sync request cancelled or timed out');
      while (reader) {
        const value = await reader.read();
        if (controller.signal.aborted) throw new SyncReadError('UNAVAILABLE', 'Sync request cancelled or timed out');
        if (value.done) break;
        size += value.value.byteLength;
        if (size > max) throw new SyncReadError('TOO_LARGE', 'Sync response exceeds its byte limit');
        chunks.push(new Uint8Array(value.value));
      }
      const bytes = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      return bytes;
    } catch (error) {
      if (error instanceof SyncReadError) throw error;
      throw new SyncReadError('UNAVAILABLE', 'Sync network request failed or was cancelled');
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); controller.signal.removeEventListener('abort', cancel); await reader?.cancel().catch(() => undefined); reader?.releaseLock(); }
  }
  async function json(path: string, signal?: AbortSignal) {
    const bytes = await request(path, SYNC_READ_MAX_JSON_BYTES, 'application/json', signal);
    try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown; } catch { return invalid('Expected UTF-8 JSON'); }
  }
  return {
    async capabilities(signal?: AbortSignal) { return parseSyncReadCapabilities(await json('capabilities', signal)); },
    async list(selection: SyncReadSelection = {}, signal?: AbortSignal) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(selection)) params.set(key, String(value));
      const selected = parseSyncReadSelection(params);
      const page = parseSyncReadPage(await json(`publications${params.size ? `?${params}` : ''}`, signal));
      if (page.publications.length > (selected.limit ?? SYNC_READ_PAGE_SIZE) || page.publications.some((item) => (selected.after && item.id <= selected.after) || (selected.parent && item.parentId !== selected.parent))) invalid('Page does not match its selection');
      return { ...page, publications: await Promise.all(page.publications.map(verifySyncReadPublication)) };
    },
    async get(id: string, signal?: AbortSignal) {
      id = syncResourceId(id);
      const envelope = object(await json(`publications/${id}`, signal), ['version', 'publication']);
      if (envelope.version !== SYNC_READ_VERSION) invalid('Unsupported publication version');
      const publication = await verifySyncReadPublication(envelope.publication);
      if (publication.id !== id) invalid('Publication ID was substituted');
      return publication;
    },
    async asset(input: SyncReadPublication, path: string, signal?: AbortSignal) {
      const publication = await verifySyncReadPublication(input);
      const asset = publication.assets.find((item) => item.path === path);
      if (!asset) throw new SyncReadError('INVALID_REQUEST', 'Asset is not in the publication manifest');
      const params = new URLSearchParams({ path: asset.path, policyVersion: String(publication.policy.version) });
      const bytes = await request(`publications/${publication.id}/asset?${params}`, asset.byteLength, asset.mediaType, signal);
      const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (value) => value.toString(16).padStart(2, '0')).join('');
      if (bytes.length !== asset.byteLength || digest !== asset.hash) invalid('Asset does not match its publication manifest');
      return bytes;
    },
  };
}
