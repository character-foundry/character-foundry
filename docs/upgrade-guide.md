# Upgrade Implementation Guide

This guide covers the release that introduces:
- Loader content hash v2 (`computeContentHashV2()` + `authoritative.contentHashV2`)
- Federation internal network key gate (`X-Foundry-Network-Key`)
- Federation log levels (default `warn`)
- CharX/Voxta writer changes to preserve arbitrary asset extensions safely
- `CardNormalizer` methods no longer depend on `this` (safe to destructure)

It is written for downstream apps integrating `@character-foundry/character-foundry` (recommended) or workspace packages directly.

---

## 1) Loader: Content Hash v2 (max compatibility)

### What changed
- `validateClientMetadata()` now computes two canonical hashes:
  - `authoritative.contentHash` (legacy v1, kept for backwards compatibility)
  - `authoritative.contentHashV2` (new v2, preferred for new storage/deduplication)
- Client `contentHash` is accepted if it matches **either** v1 or v2.

### Recommended rollout (server)
1. **Add storage for v2**
   - Add a `contentHashV2` column/field alongside your existing `contentHash` (v1).
2. **Start writing v2**
   - On ingest, store:
     - `contentHash = result.authoritative.contentHash` (v1)
     - `contentHashV2 = result.authoritative.contentHashV2` (v2)
3. **Gradually migrate reads/dedup to v2**
   - Prefer v2 for deduplication/new indexes.
   - Keep v1 for compatibility with older rows/caches until your migration is complete.

```ts
import { validateClientMetadata } from '@character-foundry/character-foundry/loader';

const result = await validateClientMetadata(clientMeta, parseResult, { countTokens });

await db.insert({
  name: result.authoritative.name,
  tokens: result.authoritative.tokens,
  contentHash: result.authoritative.contentHash,          // v1 (legacy)
  contentHashV2: result.authoritative.contentHashV2,      // v2 (preferred)
});
```

### Recommended rollout (client)
- **No immediate change required**: sending v1 still works.
- To upgrade, compute and send v2:

```ts
import { computeContentHashV2 } from '@character-foundry/character-foundry/loader';

const contentHash = await computeContentHashV2(card); // card: CCv3Data
```

### Notes
- Some deployments may see v1 and v2 differ for the same card due to v1 canonicalization quirks. This is expected; store both during migration.

---

## 2) Federation: Hardening + Internal Network Key Gate

### What changed
- Signature verification now fails when a signature claims to sign headers that are missing.
- `handleInbox()` supports an **optional** shared network key gate:
  - Header: `X-Foundry-Network-Key` (configurable)
  - Option: `networkKey` / `networkKeyHeader`
  - In `strictMode`, the header must also be included in the signed header list.

### Upgrade steps (inbox)
1. Choose a shared secret (user-set; stored in your settings).
2. Pass it to `handleInbox()`:

```ts
import { handleInbox } from '@character-foundry/character-foundry/federation';

const rawBody = await req.text();
const body = JSON.parse(rawBody);

const result = await handleInbox(body, req.headers, {
  rawBody,
  strictMode: true,
  method: 'POST',
  path: '/api/federation/inbox',
  networkKey: settings.federationNetworkKey,
  fetchActor,
});
```

### Sender requirements (strict mode)
If the receiver sets `networkKey` and `strictMode: true`, senders must:
- Include `X-Foundry-Network-Key: <value>` in the request headers, and
- Include `x-foundry-network-key` in the HTTP signature `headers="..."` list.

---

## 3) Federation: Logging Levels (default `warn`)

### What changed
- Federation logging now uses a configurable logger with default verbosity `warn`.

### Upgrade steps
If you need more logs (e.g., in development), configure at enable time:

```ts
import { enableFederation } from '@character-foundry/character-foundry/federation';

enableFederation({ logLevel: 'debug' });
```

Or set later:

```ts
import { setFederationLogLevel } from '@character-foundry/character-foundry/federation';

setFederationLogLevel('info');
```

---

## 4) CharX / Voxta Writers: Arbitrary Extensions + Safety

### What changed
- Writers no longer coerce unknown extensions to `.bin`.
- Writers **reject** unsafe extensions that could lead to ZIP path traversal.

### Upgrade steps
1. Ensure `asset.ext` is just an extension (no leading path, no `/` or `\\`).
2. If you previously passed full filenames, split them first:

```ts
const filename = 'avatar.png';
const name = filename.replace(/\.[^.]+$/, '');
const ext = filename.split('.').pop() || 'bin';
```

---

## 5) Schemas: `CardNormalizer` Destructuring Safety

### What changed
- `CardNormalizer` methods no longer rely on `this`, so destructuring works:

```ts
import { CardNormalizer } from '@character-foundry/character-foundry/schemas';

const { normalize } = CardNormalizer;
const card = normalize(input, 'v3');
```

---

## 6) Release Notes

This repo uses Changesets as release notes + versioning. See `docs/release-notes.md`.

