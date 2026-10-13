import { canonicalJson, digestString, hashBytes, IdentityError, jsonCopy, object } from './json.js';
import type { JsonObject, JsonValue } from './json.js';

export const CARD_CONTENT_ALGORITHM = 'foundry-card-v1-sha256' as const;
/** Declared assets plus portrait a card identity can bind. */
export const MAX_ASSET_BINDINGS = 8192;
export interface CardContentIdentity { algorithm: typeof CARD_CONTENT_ALGORITHM; hash: string }
/** RFC 6901 pointer relative to data; the target must be an asset URI string. */
export interface AssetDigestBinding { pointer: string; hash: string }
export interface CardIdentityOptions { assets?: readonly AssetDigestBinding[]; portraitHash?: string }
export interface CardEnvelope extends JsonObject { spec: string; spec_version: string; data: JsonObject }

export function copyCard(input: unknown): CardEnvelope {
  const card = object(jsonCopy(input));
  if (!((card.spec === 'chara_card_v2' && card.spec_version === '2.0') || (card.spec === 'chara_card_v3' && card.spec_version === '3.0'))) {
    throw new IdentityError('INVALID_CARD', 'Expected a wrapped CCv2 or CCv3 card; convert legacy/Voxta explicitly first');
  }
  object(card.data);
  return card as CardEnvelope;
}

export function extensionObjects(card: CardEnvelope): { extensions: JsonObject; foundry: JsonObject | undefined } {
  const extensions = card.data.extensions === undefined ? {} : object(card.data.extensions);
  const foundry = extensions.foundry === undefined ? undefined : object(extensions.foundry);
  return { extensions, foundry };
}

function removePrivateMetadata(card: CardEnvelope, lineage: boolean): string[] {
  const { extensions, foundry } = extensionObjects(card);
  const removed: string[] = [];
  if (Object.hasOwn(extensions, 'charx_media')) { delete extensions.charx_media; removed.push('/data/extensions/charx_media'); }
  if (foundry) {
    if (Object.hasOwn(foundry, 'local')) { delete foundry.local; removed.push('/data/extensions/foundry/local'); }
    if (lineage) delete foundry.lineage;
    if (!Object.keys(foundry).length) delete extensions.foundry;
  }
  card.data.extensions = extensions;
  return removed;
}

/** Publication policy v1 removes only the documented local fields; unknowns remain. */
export function sanitizeCardForPublish(input: unknown): { card: CardEnvelope; policy: 'foundry-publish-v1'; removed: string[] } {
  const card = copyCard(input);
  const removed = removePrivateMetadata(card, false);
  return { card, policy: 'foundry-publish-v1', removed };
}

function tokens(pointer: string): string[] {
  if (typeof pointer !== 'string' || !pointer.startsWith('/') || pointer.length > 1024 || /~(?![01])/u.test(pointer)) {
    throw new IdentityError('INVALID_ASSET', 'Expected an RFC 6901 data pointer');
  }
  return pointer.slice(1).split('/').map((token) => token.replace(/~1/g, '/').replace(/~0/g, '~'));
}
function bind(data: JsonObject, binding: AssetDigestBinding): void {
  const path = tokens(binding.pointer);
  const first = path[0];
  if (first !== 'assets' && first !== 'extensions') throw new IdentityError('INVALID_ASSET', 'Asset bindings are limited to assets and extension resource references');
  if (first === 'assets' && (path.length !== 3 || !/^(0|[1-9][0-9]*)$/.test(path[1] ?? '') || path[2] !== 'uri')) {
    throw new IdentityError('INVALID_ASSET', 'Declared asset bindings must target the URI field');
  }
  if (first === 'extensions' && (path[1] === 'charx_media' || (path[1] === 'foundry' && ['lineage', 'local'].includes(path[2] ?? '')))) {
    throw new IdentityError('INVALID_ASSET', 'Cannot bind an excluded metadata field');
  }
  let parent: JsonValue = data;
  for (const token of path.slice(0, -1)) {
    if (!parent || typeof parent !== 'object' || !Object.hasOwn(parent, token)) throw new IdentityError('INVALID_ASSET', 'Asset pointer does not exist');
    parent = (parent as JsonObject)[token] as JsonValue;
  }
  const last = path[path.length - 1] as string;
  if (!parent || typeof parent !== 'object' || !Object.hasOwn(parent, last) || typeof (parent as JsonObject)[last] !== 'string') {
    throw new IdentityError('INVALID_ASSET', 'Asset pointer must identify an existing URI string');
  }
  (parent as JsonObject)[last] = `urn:sha256:${digestString(binding.hash)}`;
}

export function canonicalCardContent(input: unknown, options: CardIdentityOptions = {}): string {
  const card = copyCard(input);
  removePrivateMetadata(card, true);
  // Explicit defaults bridge v2 optional fields and v3 required empty fields.
  for (const key of ['name', 'description', 'personality', 'scenario', 'first_mes', 'mes_example', 'creator_notes',
    'system_prompt', 'post_history_instructions', 'creator', 'character_version']) {
    if (!Object.hasOwn(card.data, key)) card.data[key] = '';
  }
  for (const key of ['alternate_greetings', 'group_only_greetings', 'tags', 'assets']) {
    if (!Object.hasOwn(card.data, key)) card.data[key] = [];
  }
  const bindings = options.assets ?? [];
  // Large RisuAI CharX packages declare a thousand or more assets; Foundry's loader and CharX handle them, so identity does too.
  if (bindings.length > MAX_ASSET_BINDINGS) throw new IdentityError('LIMIT', 'Too many asset bindings');
  const seen = new Set<string>();
  const resources: JsonObject = {};
  for (const binding of bindings) {
    if (seen.has(binding.pointer)) throw new IdentityError('INVALID_ASSET', 'Duplicate asset pointer');
    seen.add(binding.pointer);
    bind(card.data, binding);
    Object.defineProperty(resources, binding.pointer, { value: digestString(binding.hash), enumerable: true, writable: true, configurable: true });
  }
  const declaredAssets = card.data.assets;
  if (!Array.isArray(declaredAssets)) throw new IdentityError('INVALID_CARD', 'Card assets must be an array');
  for (let i = 0; i < declaredAssets.length; i++) {
    const descriptor = object(declaredAssets[i], 'INVALID_ASSET');
    if (typeof descriptor.uri !== 'string') throw new IdentityError('INVALID_ASSET', 'Declared assets require a URI');
    if (!seen.has(`/assets/${i}/uri`)) throw new IdentityError('INVALID_ASSET', 'Every declared asset requires a verified digest binding');
  }
  const extra: JsonObject = {};
  for (const key of Object.keys(card)) {
    if (!['spec', 'spec_version', 'data'].includes(key)) Object.defineProperty(extra, key, { value: card[key], enumerable: true });
  }
  return canonicalJson({ algorithm: CARD_CONTENT_ALGORITHM, data: card.data, envelope: extra,
    assets: resources, portrait: options.portraitHash === undefined ? null : digestString(options.portraitHash) });
}

export async function computeCardContentIdentity(input: unknown, options: CardIdentityOptions = {}): Promise<CardContentIdentity> {
  const canonical = canonicalCardContent(input, options);
  return { algorithm: CARD_CONTENT_ALGORITHM, hash: await hashBytes(new TextEncoder().encode(canonical)) };
}
