import { canonicalJson, digestString, hashBytes, IdentityError, jsonCopy, object } from './json.js';
import { CARD_CONTENT_ALGORITHM, computeCardContentIdentity, copyCard, extensionObjects } from './content.js';
import type { CardContentIdentity, CardEnvelope, CardIdentityOptions } from './content.js';

export interface CardLineageV1 {
  version: 1;
  originalHash: string;
  content: CardContentIdentity;
  parents: { revisionHash: string; content: CardContentIdentity }[];
  operation: 'edit' | 'fork';
  author: string;
  createdAt: string;
  nonce: string;
  revisionHash: string;
}
export interface CardRevisionOptions extends CardIdentityOptions {
  originalHash: string;
  parents?: readonly CardLineageV1[];
  operation: 'edit' | 'fork';
  /** A stable public actor URI, not a database row ID. This is a claim, not a signature. */
  author: string;
  createdAt: string;
  /** Unique revision nonce. Supply explicitly for retry determinism. */
  nonce: string;
}
function invalid(): never { throw new IdentityError('INVALID_LINEAGE', 'Invalid v1 card lineage'); }
function identity(value: unknown): CardContentIdentity {
  const item = object(jsonCopy(value), 'INVALID_LINEAGE');
  if (Object.keys(item).sort().join(',') !== 'algorithm,hash' || item.algorithm !== CARD_CONTENT_ALGORITHM) invalid();
  return { algorithm: CARD_CONTENT_ALGORITHM, hash: digestString(item.hash) };
}
function parseLineage(value: unknown): CardLineageV1 {
  try {
    const data = object(jsonCopy(value), 'INVALID_LINEAGE');
    if (Object.keys(data).sort().join(',') !== 'author,content,createdAt,nonce,operation,originalHash,parents,revisionHash,version'
      || data.version !== 1 || !['edit', 'fork'].includes(String(data.operation))) invalid();
    if (typeof data.author !== 'string' || data.author.length > 2048 || !/^(https?:\/\/|urn:)/.test(data.author)
      || [...data.author].some((c) => c.charCodeAt(0) <= 32 || c.charCodeAt(0) === 127)) invalid();
    const url = new URL(data.author);
    if (url.username || url.password || (!url.hostname && url.protocol !== 'urn:') || (url.protocol === 'urn:' && !url.pathname)) invalid();
    if (typeof data.createdAt !== 'string' || !Number.isFinite(Date.parse(data.createdAt)) || new Date(data.createdAt).toISOString() !== data.createdAt) invalid();
    if (typeof data.nonce !== 'string' || data.nonce.length < 16 || data.nonce.length > 128 || /[^a-zA-Z0-9_-]/.test(data.nonce)) invalid();
    if (!Array.isArray(data.parents) || data.parents.length > 16) invalid();
    const parents = data.parents.map((value) => {
      const parent = object(value, 'INVALID_LINEAGE');
      if (Object.keys(parent).sort().join(',') !== 'content,revisionHash') invalid();
      return { revisionHash: digestString(parent.revisionHash), content: identity(parent.content) };
    });
    if (new Set(parents.map((parent) => parent.revisionHash)).size !== parents.length) invalid();
    return { version: 1, originalHash: digestString(data.originalHash), content: identity(data.content), parents,
      operation: data.operation as 'edit' | 'fork', author: data.author, createdAt: data.createdAt, nonce: data.nonce,
      revisionHash: digestString(data.revisionHash) };
  } catch { return invalid(); }
}
async function revisionHash(lineage: CardLineageV1): Promise<string> {
  const { revisionHash: _hash, ...body } = lineage;
  return hashBytes(new TextEncoder().encode(canonicalJson({ algorithm: 'foundry-revision-v1-sha256', lineage: body })));
}

/** Structural read only. Use verifyCardLineage to check its content and revision digest. */
export function readCardLineage(input: unknown): CardLineageV1 | null {
  const card = copyCard(input);
  const { foundry } = extensionObjects(card);
  return foundry?.lineage === undefined ? null : parseLineage(foundry.lineage);
}
export function stripCardLineage(input: unknown): CardEnvelope {
  const card = copyCard(input);
  const { extensions, foundry } = extensionObjects(card);
  if (foundry) {
    delete foundry.lineage;
    if (!Object.keys(foundry).length) delete extensions.foundry;
  }
  return card;
}
export async function verifyCardLineage(input: unknown, options: CardIdentityOptions = {}): Promise<boolean> {
  const card = copyCard(input);
  const lineage = readCardLineage(card);
  if (!lineage) return false;
  const content = await computeCardContentIdentity(card, options);
  return lineage.content.hash === content.hash && lineage.revisionHash === await revisionHash(lineage);
}

/** Explicit save/fork only. Opening or exporting a card never invokes this helper. */
export async function createCardRevision(input: unknown, options: CardRevisionOptions): Promise<{ card: CardEnvelope; lineage: CardLineageV1 }> {
  const card = copyCard(input);
  // Snapshot all caller-owned inputs before the first asynchronous digest.
  const captured = object(jsonCopy(options), 'INVALID_LINEAGE');
  const parents = (Array.isArray(captured.parents) ? captured.parents : captured.parents === undefined ? [] : invalid()).map(parseLineage);
  if (parents.length > 16) invalid();
  const content = await computeCardContentIdentity(card, captured as unknown as CardIdentityOptions);
  const lineage = parseLineage({ version: 1, originalHash: captured.originalHash, content,
    parents: parents.map((parent) => ({ revisionHash: parent.revisionHash, content: parent.content })),
    operation: captured.operation, author: captured.author, createdAt: captured.createdAt, nonce: captured.nonce,
    revisionHash: '0'.repeat(64) });
  for (const parent of parents) {
    if (parent.originalHash !== lineage.originalHash || parent.revisionHash !== await revisionHash(parent)) invalid();
  }
  const current = readCardLineage(card);
  if (current && current.revisionHash !== await revisionHash(current)) invalid();
  if (current && (current.originalHash !== lineage.originalHash || !parents.some((parent) => parent.revisionHash === current.revisionHash))) {
    throw new IdentityError('INVALID_LINEAGE', 'Existing lineage must remain a parent with the same original root');
  }
  lineage.revisionHash = await revisionHash(lineage);
  const { extensions, foundry } = extensionObjects(card);
  const namespace = foundry ?? {};
  namespace.lineage = jsonCopy(lineage);
  extensions.foundry = namespace;
  card.data.extensions = extensions;
  return { card, lineage };
}

export function lineageExportSupport(format: string): { supported: boolean; reason: string | null } {
  return ['json_v2', 'json_v3', 'png_v2', 'png_v3', 'charx'].includes(format)
    ? { supported: true, reason: null }
    : { supported: false, reason: 'This format is not in the v1 lineage preservation envelope' };
}
export function assertLineageExportSupported(input: unknown, format: string): void {
  if (readCardLineage(input) && !lineageExportSupport(format).supported) throw new IdentityError('LOSSY_FORMAT', 'Export would lose or cannot guarantee card lineage');
}
