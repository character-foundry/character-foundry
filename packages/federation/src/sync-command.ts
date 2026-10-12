import { canonicalJson } from '@character-foundry/identity';
import { signSyncHttp, SYNC_HTTP_PROFILE } from './sync-http.js';

export const SYNC_COMMAND_VERSION = 'foundry.sync.command.v1' as const;
export const SYNC_COMMAND_MAX_BYTES = 64 * 1024;
export const SYNC_COMMAND_MAX_REVISIONS = 20;
export type SyncCommandErrorCode = 'INVALID_REQUEST' | 'INVALID_RESPONSE' | 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'OPERATION_CONFLICT' | 'CHANGED' | 'TOO_LARGE' | 'RATE_LIMITED' | 'UNAVAILABLE';
export class SyncCommandError extends Error {
  constructor(public readonly code: SyncCommandErrorCode, message: string, public readonly status?: number) { super(message); this.name = 'SyncCommandError'; }
}
export interface SyncPublishSelection { revisionIds: string[]; policy: { visibility: 'private' | 'members' | 'public'; allowFork: boolean } }
export type SyncCommand = { version: typeof SYNC_COMMAND_VERSION } & (
  { operation: 'publications.publish' } & SyncPublishSelection | { operation: 'publications.fork'; publicationId: string });
export type SyncCommandReceipt = { version: typeof SYNC_COMMAND_VERSION; requestId: string } & (
  { operation: 'publications.publish'; publications: { id: string; policyVersion: 1 }[] }
  | { operation: 'publications.fork'; cardId: string; revisionId: string });
export function syncCommandCapabilities() {
  return { version: SYNC_COMMAND_VERSION, transport: SYNC_HTTP_PROFILE,
    operations: ['publications.publish', 'publications.fork'] as const,
    limits: { commandBytes: SYNC_COMMAND_MAX_BYTES, revisions: SYNC_COMMAND_MAX_REVISIONS } };
}
function invalid(message: string): never { throw new SyncCommandError('INVALID_REQUEST', message); }
function object(input: unknown, keys: readonly string[]) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length !== keys.length
    || keys.some((key) => !Object.hasOwn(input, key))) invalid('Unexpected or missing command fields');
  return input as Record<string, unknown>;
}
function id(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value)) invalid('Invalid resource ID'); return value;
}
function token(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(value)) invalid('Expected an explicit sync operation ID'); return value;
}
/** Owned allowlist. Account/workspace/author and original-download permission are host-selected. */
export function parseSyncCommand(input: unknown): SyncCommand {
  const operation = input && typeof input === 'object' ? (input as Record<string, unknown>).operation : null;
  const value = object(input, operation === 'publications.publish' ? ['version', 'operation', 'revisionIds', 'policy'] : ['version', 'operation', 'publicationId']);
  if (value.version !== SYNC_COMMAND_VERSION) invalid('Unsupported command version');
  if (operation === 'publications.fork') return { version: SYNC_COMMAND_VERSION, operation, publicationId: id(value.publicationId) };
  if (operation !== 'publications.publish') invalid('Unknown command operation');
  if (!Array.isArray(value.revisionIds) || !value.revisionIds.length || value.revisionIds.length > SYNC_COMMAND_MAX_REVISIONS) invalid('Select 1–20 distinct revisions');
  const revisionIds = Array.from(value.revisionIds, id); if (new Set(revisionIds).size !== revisionIds.length) invalid('Duplicate revision selection');
  const policy = object(value.policy, ['visibility', 'allowFork']);
  if (typeof policy.visibility !== 'string' || !['private', 'members', 'public'].includes(policy.visibility) || typeof policy.allowFork !== 'boolean') invalid('Invalid publication policy');
  return { version: SYNC_COMMAND_VERSION, operation, revisionIds,
    policy: { visibility: policy.visibility as SyncPublishSelection['policy']['visibility'], allowFork: policy.allowFork } };
}
export function encodeSyncCommand(input: unknown): Uint8Array {
  const bytes = new TextEncoder().encode(canonicalJson(parseSyncCommand(input)));
  if (bytes.length > SYNC_COMMAND_MAX_BYTES) throw new SyncCommandError('TOO_LARGE', 'Command exceeds its byte limit');
  return bytes;
}
/** Call only after signature verification over these exact bytes. */
export function decodeSyncCommand(bytes: Uint8Array): SyncCommand {
  if (bytes.length > SYNC_COMMAND_MAX_BYTES) throw new SyncCommandError('TOO_LARGE', 'Command exceeds its byte limit');
  let value: unknown; try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { return invalid('Expected UTF-8 JSON'); }
  return parseSyncCommand(value);
}
export function parseSyncCommandReceipt(input: unknown): SyncCommandReceipt {
  try {
    const operation = input && typeof input === 'object' ? (input as Record<string, unknown>).operation : null;
    const value = object(input, operation === 'publications.publish' ? ['version', 'operation', 'requestId', 'publications'] : ['version', 'operation', 'requestId', 'cardId', 'revisionId']);
    if (value.version !== SYNC_COMMAND_VERSION) invalid('Unsupported receipt version');
    const requestId = token(value.requestId);
    if (operation === 'publications.fork') return { version: SYNC_COMMAND_VERSION, operation, requestId, cardId: id(value.cardId), revisionId: id(value.revisionId) };
    if (operation !== 'publications.publish' || !Array.isArray(value.publications) || !value.publications.length || value.publications.length > SYNC_COMMAND_MAX_REVISIONS) invalid('Invalid publication receipt');
    const publications = Array.from(value.publications, (input) => {
      const item = object(input, ['id', 'policyVersion']); if (item.policyVersion !== 1) invalid('Receipt must retain initial policy version');
      return { id: id(item.id), policyVersion: 1 as const };
    });
    if (new Set(publications.map((item) => item.id)).size !== publications.length) invalid('Duplicate publication receipt');
    return { version: SYNC_COMMAND_VERSION, operation, requestId, publications };
  } catch { throw new SyncCommandError('INVALID_RESPONSE', 'Invalid command receipt'); }
}

/** No automatic retries. Persist the operation ID and selection before calling; reuse both after an uncertain outcome. */
export function createSyncCommandClient(options: { baseUrl: string; actor: string; keyId: string; privateKey: CryptoKey; fetch?: typeof fetch; timeoutMs?: number }) {
  const { baseUrl, actor, keyId, privateKey } = options;
  const base = new URL(baseUrl), timeout = options.timeoutMs ?? 30_000;
  if (base.href !== baseUrl || base.protocol !== 'https:' || base.username || base.password || base.search || base.hash || baseUrl.endsWith('/')
    || !Number.isSafeInteger(timeout) || timeout < 1 || timeout > 120_000) invalid('Expected an exact HTTPS base and bounded timeout');
  const fetcher = options.fetch ?? globalThis.fetch;
  async function send(input: SyncCommand, requestId: string, signal?: AbortSignal) {
    requestId = token(requestId); const command = parseSyncCommand(input); const body = encodeSyncCommand(command);
    const url = `${baseUrl}/commands/${command.operation === 'publications.publish' ? 'publish' : 'fork'}`;
    if (signal?.aborted) throw new SyncCommandError('UNAVAILABLE', 'Command cancelled');
    const signed = await signSyncHttp({ method: 'POST', url, body, contentType: 'application/json', actor, keyId, privateKey, requestId });
    const controller = new AbortController(), abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true }); if (signal?.aborted) controller.abort();
    const timer = setTimeout(abort, timeout);
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    const cancel = () => { void reader?.cancel().catch(() => undefined); }; controller.signal.addEventListener('abort', cancel, { once: true });
    try {
      if (controller.signal.aborted) throw new SyncCommandError('UNAVAILABLE', 'Command cancelled');
      const response = await fetcher(url, { method: 'POST', headers: signed.headers, body: body as BodyInit,
        redirect: 'manual', credentials: 'omit', cache: 'no-store', signal: controller.signal });
      if (response.redirected || (response.status >= 300 && response.status < 400) || (response.url && response.url !== url)) {
        await response.body?.cancel(); throw new SyncCommandError('INVALID_RESPONSE', 'Command redirects are forbidden');
      }
      if (!response.ok) {
        await response.body?.cancel();
        const code: SyncCommandErrorCode = ({ 400: 'INVALID_REQUEST', 401: 'UNAUTHENTICATED', 403: 'FORBIDDEN', 404: 'NOT_FOUND',
          409: 'OPERATION_CONFLICT', 412: 'CHANGED', 413: 'TOO_LARGE', 429: 'RATE_LIMITED' } as Record<number, SyncCommandErrorCode>)[response.status] ?? 'UNAVAILABLE';
        throw new SyncCommandError(code, `Command failed (${response.status})`, response.status);
      }
      if (response.status !== 200 || response.headers.get('content-type')?.split(';')[0] !== 'application/json') {
        await response.body?.cancel(); throw new SyncCommandError('INVALID_RESPONSE', 'Expected a JSON command receipt');
      }
      const length = response.headers.get('content-length');
      if (length !== null && (!/^(0|[1-9][0-9]*)$/.test(length) || Number(length) > SYNC_COMMAND_MAX_BYTES)) {
        await response.body?.cancel(); throw new SyncCommandError('TOO_LARGE', 'Receipt exceeds its byte limit');
      }
      reader = response.body?.getReader(); const chunks: Uint8Array[] = []; let size = 0;
      if (controller.signal.aborted) throw new SyncCommandError('UNAVAILABLE', 'Command cancelled or timed out');
      while (reader) {
        const chunk = await reader.read();
        if (controller.signal.aborted) throw new SyncCommandError('UNAVAILABLE', 'Command cancelled or timed out');
        if (chunk.done) break;
        size += chunk.value.byteLength; if (size > SYNC_COMMAND_MAX_BYTES) throw new SyncCommandError('TOO_LARGE', 'Receipt exceeds its byte limit');
        chunks.push(new Uint8Array(chunk.value));
      }
      const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      let value: unknown; try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
      catch { throw new SyncCommandError('INVALID_RESPONSE', 'Expected UTF-8 JSON receipt'); }
      const receipt = parseSyncCommandReceipt(value);
      if (receipt.requestId !== requestId || receipt.operation !== command.operation
        || (receipt.operation === 'publications.publish' && command.operation === 'publications.publish' && receipt.publications.length !== command.revisionIds.length)) {
        throw new SyncCommandError('INVALID_RESPONSE', 'Receipt does not match the requested operation');
      }
      return receipt;
    } catch (error) { if (error instanceof SyncCommandError) throw error; throw new SyncCommandError('UNAVAILABLE', 'Command outcome unavailable; retry only with the same operation ID and command'); }
    finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); controller.signal.removeEventListener('abort', cancel); await reader?.cancel().catch(() => undefined); reader?.releaseLock(); }
  }
  return {
    publish(selection: SyncPublishSelection, requestId: string, signal?: AbortSignal) {
      return send({ ...selection, version: SYNC_COMMAND_VERSION, operation: 'publications.publish' }, requestId, signal);
    },
    fork(publicationId: string, requestId: string, signal?: AbortSignal) {
      return send({ version: SYNC_COMMAND_VERSION, operation: 'publications.fork', publicationId }, requestId, signal);
    },
  };
}
