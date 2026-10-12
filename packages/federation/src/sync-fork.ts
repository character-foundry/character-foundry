import { canonicalJson, hashBytes, readCardLineage, parseCardLineageRecord, verifyCardLineageRecord } from '@character-foundry/identity';
import type { CardLineageV1 } from '@character-foundry/identity';
import { parseSyncReadPublication, syncResourceId, verifySyncReadPublication } from './sync-read.js';
import type { SyncReadPublication, SyncReadAsset } from './sync-read.js';
import { SyncCommandError } from './sync-command-error.js';

export const SYNC_FORK_VERSION = 'foundry.sync.fork.v1' as const;
export const SYNC_FORK_MAX_BYTES = 8 * 1024 * 1024;
export const SYNC_FORK_MAX_METADATA_BYTES = 512 * 1024;
export const SYNC_FORK_MAX_ANCESTORS = 32;
const magic = new TextEncoder().encode('foundry.sync.fork.v1\n');
export interface SyncForkManifest {
  version: typeof SYNC_FORK_VERSION;
  publicationId: string;
  baseIdentity: SyncReadPublication['identity'];
  document: SyncReadPublication['document'];
  identity: SyncReadPublication['identity'];
  originalHash: string;
  /** Oldest first, excludes both the selected publication's record and the final record. */
  ancestry: CardLineageV1[];
  assets: SyncReadAsset[];
}
export interface SyncForkSubmission { manifest: SyncForkManifest; assets: Uint8Array[] }
function invalid(message: string): never { throw new SyncCommandError('INVALID_REQUEST', message); }
function large(): never { throw new SyncCommandError('TOO_LARGE', 'Fork submission exceeds its profile limits'); }
function view(manifest: Pick<SyncForkManifest, 'publicationId' | 'document' | 'identity' | 'originalHash' | 'assets'>): SyncReadPublication {
  return parseSyncReadPublication({ id: manifest.publicationId, document: manifest.document, identity: manifest.identity,
    originalHash: manifest.originalHash, assets: manifest.assets, parentId: null, publishedAt: '1970-01-01T00:00:00.000Z',
    policy: { visibility: 'private', allowFork: false, version: 1 } });
}
/** Owned metadata. This does not authenticate a sender or verify content/ancestry. */
export function parseSyncForkManifest(input: unknown): SyncForkManifest {
  try {
    if (!input || typeof input !== 'object' || Array.isArray(input)) invalid('Expected fork manifest');
    const value = input as Record<string, unknown>;
    const keys = ['version', 'publicationId', 'baseIdentity', 'document', 'identity', 'originalHash', 'ancestry', 'assets'];
    if (Object.keys(value).length !== keys.length || keys.some((key) => !Object.hasOwn(value, key)) || value.version !== SYNC_FORK_VERSION) invalid('Invalid fork manifest fields/version');
    if (!Array.isArray(value.ancestry) || value.ancestry.length > SYNC_FORK_MAX_ANCESTORS) large();
    const publicationId = syncResourceId(value.publicationId);
    const revision = view({ publicationId, document: value.document as SyncReadPublication['document'], identity: value.identity as SyncReadPublication['identity'],
      originalHash: value.originalHash as string, assets: value.assets as SyncReadAsset[] });
    const base = view({ ...revision, publicationId, identity: value.baseIdentity as SyncReadPublication['identity'] });
    const manifest: SyncForkManifest = { version: SYNC_FORK_VERSION, publicationId, baseIdentity: base.identity,
      document: revision.document, identity: revision.identity, originalHash: revision.originalHash,
      ancestry: Array.from(value.ancestry, parseCardLineageRecord), assets: revision.assets };
    if (new TextEncoder().encode(canonicalJson(manifest)).length > SYNC_FORK_MAX_METADATA_BYTES) large();
    return manifest;
  } catch (error) { if (error instanceof SyncCommandError) throw error; invalid('Invalid fork manifest'); }
}
function capture(input: SyncForkSubmission): SyncForkSubmission {
  const manifest = parseSyncForkManifest(input.manifest);
  if (!Array.isArray(input.assets) || input.assets.length !== manifest.assets.length) invalid('Asset bytes must match the manifest order');
  let size = 0;
  const assets = Array.from(input.assets, (bytes, index) => {
    if (!(bytes instanceof Uint8Array) || bytes.length !== manifest.assets[index]!.byteLength) invalid('Asset length does not match manifest');
    size += bytes.length; if (size > SYNC_FORK_MAX_BYTES) large(); return new Uint8Array(bytes);
  });
  if (size + magic.length + 4 + new TextEncoder().encode(canonicalJson(manifest)).length > SYNC_FORK_MAX_BYTES) large();
  return { manifest, assets };
}
async function verifyBytes(input: SyncForkSubmission) {
  for (const [index, bytes] of input.assets.entries()) if (await hashBytes(bytes) !== input.manifest.assets[index]!.hash) invalid('Asset hash does not match manifest');
}
/** Stable binary framing: magic, u32 big-endian metadata length, canonical UTF-8 metadata, ordered raw assets. */
export async function encodeSyncForkSubmission(input: SyncForkSubmission): Promise<Uint8Array> {
  const captured = capture(input);
  const metadata = new TextEncoder().encode(canonicalJson(captured.manifest));
  const size = magic.length + 4 + metadata.length + captured.assets.reduce((size, bytes) => size + bytes.length, 0);
  if (size > SYNC_FORK_MAX_BYTES) large();
  await verifyBytes(captured);
  const output = new Uint8Array(size); output.set(magic);
  new DataView(output.buffer).setUint32(magic.length, metadata.length, false);
  let offset = magic.length + 4; output.set(metadata, offset); offset += metadata.length;
  for (const bytes of captured.assets) { output.set(bytes, offset); offset += bytes.length; }
  return output;
}
/** Invoke after authenticating these exact bytes. All decoded buffers are owned copies. */
export async function decodeSyncForkSubmission(input: Uint8Array): Promise<SyncForkSubmission> {
  if (!(input instanceof Uint8Array)) invalid('Expected fork bytes');
  if (input.length > SYNC_FORK_MAX_BYTES) large();
  const bytes = new Uint8Array(input);
  if (bytes.length < magic.length + 4 || !magic.every((value, index) => bytes[index] === value)) invalid('Invalid fork frame');
  const size = new DataView(bytes.buffer).getUint32(magic.length, false);
  if (size > SYNC_FORK_MAX_METADATA_BYTES) large();
  let offset = magic.length + 4;
  if (!size || offset + size > bytes.length) invalid('Truncated fork metadata');
  let value: unknown;
  const encoded = bytes.subarray(offset, offset + size); offset += size;
  try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(encoded)); } catch { return invalid('Invalid fork metadata JSON'); }
  const manifest = parseSyncForkManifest(value);
  const canonical = new TextEncoder().encode(canonicalJson(manifest));
  if (canonical.length !== encoded.length || !canonical.every((value, index) => encoded[index] === value)) invalid('Fork metadata must use canonical JSON');
  const assets = manifest.assets.map((asset) => {
    if (offset + asset.byteLength > bytes.length) invalid('Truncated fork asset');
    const result = bytes.slice(offset, offset + asset.byteLength); offset += asset.byteLength; return result;
  });
  if (offset !== bytes.length) invalid('Unclaimed fork bytes');
  const result = { manifest, assets }; await verifyBytes(result); return result;
}
/** Proves the declared linear chain and final content/assets; it does not prove historical asset bytes. */
export async function verifySyncForkSubmission(input: SyncForkSubmission, parentInput: SyncReadPublication, actor: string): Promise<SyncForkSubmission> {
  let author: URL; try { author = new URL(actor); } catch { return invalid('Expected the authenticated HTTPS actor'); }
  if (author.protocol !== 'https:' || author.href !== actor || author.username || author.password || author.search || author.hash) invalid('Expected the authenticated HTTPS actor');
  const submission = capture(input), parentSnapshot = parseSyncReadPublication(parentInput);
  const parent = await verifySyncReadPublication(parentSnapshot);
  const { manifest } = submission;
  if (manifest.publicationId !== parent.id || manifest.originalHash !== parent.originalHash
    || canonicalJson(manifest.baseIdentity) !== canonicalJson(parent.identity)) invalid('Fork does not match selected publication');
  const remote = await verifySyncReadPublication(view(manifest));
  await verifyBytes(submission);
  const final = readCardLineage(remote.document);
  if (!final) invalid('Submitted fork requires explicit lineage');
  let previous = readCardLineage(parent.document);
  const seen = new Set(previous ? [previous.revisionHash] : []);
  for (const [index, record] of [...manifest.ancestry, final].entries()) {
    if (record.author !== actor || record.originalHash !== parent.originalHash || !await verifyCardLineageRecord(record)
      || seen.has(record.revisionHash) || (index === 0 && record.operation !== 'fork')) invalid('Invalid or unattributable fork ancestry');
    const expected = previous ? [{ revisionHash: previous.revisionHash, content: previous.content }] : [];
    if (canonicalJson(record.parents) !== canonicalJson(expected)) invalid('Fork ancestry is disconnected or has unproven parents');
    seen.add(record.revisionHash); previous = record;
  }
  return submission;
}
