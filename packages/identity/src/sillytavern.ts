import { canonicalJson, IdentityError, object } from './json.js';
import type { JsonObject, JsonValue } from './json.js';
import { CARD_CONTENT_ALGORITHM, computeCardContentIdentity, copyCard, extensionObjects, sanitizeCardForPublish } from './content.js';
import type { CardIdentityOptions } from './content.js';
import { readCardLineage, verifyCardLineage } from './lineage.js';

const profile = 'foundry-sillytavern-json-v1';
const mirrors = ['name', 'description', 'personality', 'scenario', 'first_mes', 'mes_example', 'tags', 'talkativeness'] as const;
const allowed = [...mirrors.map((key) => `/${key}`), '/fav', '/data/extensions/fav', '/create_date'];
function fail(message: string): never { throw new IdentityError('LOSSY_FORMAT', message); }
function transportObject(value: JsonValue | undefined): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('Invalid SillyTavern transport marker');
  return value;
}
function snapshot(options: CardIdentityOptions): CardIdentityOptions {
  return { ...(options.assets ? { assets: options.assets.map((binding) => ({ ...binding })) } : {}),
    ...(options.portraitHash ? { portraitHash: options.portraitHash } : {}) };
}
function same(a: JsonValue | undefined, b: JsonValue | undefined): boolean {
  return a === undefined || b === undefined ? a === b : canonicalJson(a) === canonicalJson(b);
}
function mirrorValue(data: JsonObject, extensions: JsonObject, key: string): JsonValue | undefined {
  return key === 'talkativeness' ? extensions.talkativeness : data[key];
}

/** Explicit transport copy; existing canonical hash APIs retain their exact meanings. */
export async function prepareSillyTavernTransport(input: unknown, options: CardIdentityOptions = {}) {
  const card = sanitizeCardForPublish(input).card; options = snapshot(options);
  const { extensions } = extensionObjects(card);
  for (const key of ['chat', 'json_data', 'create_date']) {
    if (Object.hasOwn(card, key)) fail(`SillyTavern overwrites ${key}; this card needs an explicit conversion`);
  }
  for (const key of mirrors) {
    if (Object.hasOwn(card, key) && !same(card[key], mirrorValue(card.data, extensions, key))) fail(`SillyTavern overwrites the independent ${key} envelope field`);
  }
  if ((Object.hasOwn(card, 'fav') && card.fav !== false)
    || (Object.hasOwn(extensions, 'fav') && extensions.fav !== false)) fail('SillyTavern overwrites authored favorite fields');
  const lineage = readCardLineage(card);
  if (lineage && !await verifyCardLineage(card, options)) fail('Cannot export invalid lineage');
  const content = await computeCardContentIdentity(card, options);
  const absent = allowed.filter((path) => path === '/data/extensions/fav' ? !Object.hasOwn(extensions, 'fav') : !Object.hasOwn(card, path.slice(1)));
  const foundry = extensions.foundry === undefined ? {} : object(extensions.foundry);
  foundry.local = { sillyTavernTransport: { profile, content: { ...content }, revisionHash: lineage?.revisionHash ?? null, absent } };
  extensions.foundry = foundry; card.data.extensions = extensions;
  return { card, profile, content };
}

/**
 * Undo only documented additions on an explicitly prepared transport. No inferred
 * recovery of arbitrary stale lineage, meaningful edits, or missing asset bytes.
 * null means no transport marker; callers retain their ordinary import path.
 */
export async function restoreSillyTavernTransport(input: unknown, options: CardIdentityOptions = {}) {
  const card = copyCard(input); options = snapshot(options);
  const { extensions, foundry } = extensionObjects(card);
  const local = foundry?.local;
  if (!local || typeof local !== 'object' || Array.isArray(local) || !Object.hasOwn(local, 'sillyTavernTransport')) return null;
  const marker = transportObject(local.sillyTavernTransport);
  const content = transportObject(marker.content);
  if (Object.keys(marker).sort().join(',') !== 'absent,content,profile,revisionHash' || marker.profile !== profile
    || Object.keys(content).sort().join(',') !== 'algorithm,hash' || content.algorithm !== CARD_CONTENT_ALGORITHM
    || typeof content.hash !== 'string' || !/^[a-f0-9]{64}$/.test(content.hash)
    || !(marker.revisionHash === null || typeof marker.revisionHash === 'string' && /^[a-f0-9]{64}$/.test(marker.revisionHash))
    || !Array.isArray(marker.absent) || marker.absent.length > allowed.length
    || marker.absent.some((path) => typeof path !== 'string' || !allowed.includes(path))
    || new Set(marker.absent).size !== marker.absent.length) fail('Invalid SillyTavern transport marker');
  // Check all returned mirror values before removing any fields they depend on.
  for (const path of marker.absent as string[]) {
    const key = path.slice(1);
    if (path === '/data/extensions/fav') {
      if (Object.hasOwn(extensions, 'fav') && extensions.fav !== false) fail('Transport favorite field changed');
    } else if (Object.hasOwn(card, key)) {
      if (key === 'create_date') {
        const value = card[key];
        if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) fail('Unexpected transport timestamp');
      } else if (!same(card[key], key === 'fav' ? false : mirrorValue(card.data, extensions, key))) fail(`Transport mirror ${key} changed`);
    }
  }
  for (const path of marker.absent as string[]) {
    if (path === '/data/extensions/fav') delete extensions.fav;
    else delete card[path.slice(1)];
  }
  const restored = sanitizeCardForPublish(card).card;
  const lineage = readCardLineage(restored);
  if ((lineage?.revisionHash ?? null) !== marker.revisionHash
    || canonicalJson(await computeCardContentIdentity(restored, options)) !== canonicalJson(content)
    || lineage && !await verifyCardLineage(restored, options)) fail('SillyTavern changed portable content, assets or lineage');
  return { card: restored, profile, content: await computeCardContentIdentity(restored, options) };
}
