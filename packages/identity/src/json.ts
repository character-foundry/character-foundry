export type JsonValue = null | boolean | number | string | JsonValue[] | JsonObject;
export interface JsonObject { [key: string]: JsonValue }
export class IdentityError extends Error {
  constructor(public readonly code: 'INVALID_JSON' | 'INVALID_CARD' | 'INVALID_ASSET' | 'INVALID_LINEAGE' | 'LIMIT' | 'LOSSY_FORMAT', message: string) {
    super(message);
    this.name = 'IdentityError';
  }
}

function checkString(value: string): void {
  if (value.length > 4 * 1024 * 1024) throw new IdentityError('LIMIT', 'JSON string exceeds the serialization limit');
  for (let i = 0; i < value.length; i++) {
    const unit = value.charCodeAt(i);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(++i);
      if (!(next >= 0xdc00 && next <= 0xdfff)) throw new IdentityError('INVALID_JSON', 'Unpaired Unicode surrogate');
    } else if (unit >= 0xdc00 && unit <= 0xdfff) throw new IdentityError('INVALID_JSON', 'Unpaired Unicode surrogate');
  }
}

/** JSON-value canonicalization using JCS ordering/primitive rules, with bounded input. */
export function canonicalJson(value: unknown): string {
  const active = new Set<object>();
  let nodes = 0;
  let length = 0;
  function emit(text: string): string {
    length += text.length;
    if (length > 4 * 1024 * 1024) throw new IdentityError('LIMIT', 'Canonical JSON exceeds 4 Mi UTF-16 code units');
    return text;
  }
  function visit(item: unknown, depth: number): string {
    if (++nodes > 100_000 || depth > 64) throw new IdentityError('LIMIT', 'Canonical JSON exceeds structural limits');
    if (item === null) return emit('null');
    if (typeof item === 'string') { checkString(item); return emit(JSON.stringify(item)); }
    if (typeof item === 'boolean') return emit(String(item));
    if (typeof item === 'number') {
      if (!Number.isFinite(item)) throw new IdentityError('INVALID_JSON', 'Non-finite JSON number');
      return emit(JSON.stringify(item));
    }
    if (typeof item !== 'object') throw new IdentityError('INVALID_JSON', 'Expected JSON values only');
    if (active.has(item)) throw new IdentityError('INVALID_JSON', 'Cyclic JSON value');
    active.add(item);
    try {
      const array = Array.isArray(item);
      const prototype = Object.getPrototypeOf(item);
      if (!array && prototype !== Object.prototype && prototype !== null) throw new IdentityError('INVALID_JSON', 'Expected plain JSON objects');
      const descriptors = Object.getOwnPropertyDescriptors(item);
      if (Object.getOwnPropertySymbols(item).length) throw new IdentityError('INVALID_JSON', 'Symbol properties are not JSON');
      for (const [key, descriptor] of Object.entries(descriptors)) {
        if (array && key === 'length') continue;
        if (!descriptor.enumerable || !('value' in descriptor)) throw new IdentityError('INVALID_JSON', 'Accessors and hidden properties are not JSON');
      }
      if (array) {
        if (item.length > 100_000 || Object.keys(descriptors).length !== item.length + 1) throw new IdentityError('INVALID_JSON', 'Sparse or decorated arrays are not JSON');
        const entries: string[] = [];
        for (let i = 0; i < item.length; i++) {
          const descriptor = descriptors[String(i)];
          if (!descriptor) throw new IdentityError('INVALID_JSON', 'Sparse arrays are not JSON');
          entries.push(visit(descriptor.value, depth + 1));
        }
        emit('[' + ','.repeat(Math.max(0, entries.length - 1)) + ']');
        return `[${entries.join(',')}]`;
      }
      const entries = Object.keys(descriptors).sort().map((key) => {
        checkString(key);
        const encodedKey = emit(JSON.stringify(key) + ':');
        return encodedKey + visit(descriptors[key]?.value, depth + 1);
      });
      emit('{' + ','.repeat(Math.max(0, entries.length - 1)) + '}');
      return `{${entries.join(',')}}`;
    } finally { active.delete(item); }
  }
  return visit(value, 0);
}

export function jsonCopy(value: unknown): JsonValue { return JSON.parse(canonicalJson(value)) as JsonValue; }
export function object(value: JsonValue | undefined, code: 'INVALID_CARD' | 'INVALID_ASSET' | 'INVALID_LINEAGE' = 'INVALID_CARD'): JsonObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new IdentityError(code, 'Expected an object');
  return value;
}
export function digestString(value: unknown): string {
  if (typeof value !== 'string' || value.length !== 64 || /[^a-f0-9]/.test(value)) throw new IdentityError('INVALID_ASSET', 'Expected a lowercase SHA-256 digest');
  return value;
}
export async function hashBytes(bytes: Uint8Array): Promise<string> {
  const owned = new Uint8Array(bytes);
  const result = await globalThis.crypto.subtle.digest('SHA-256', owned);
  return Array.from(new Uint8Array(result), (value) => value.toString(16).padStart(2, '0')).join('');
}
