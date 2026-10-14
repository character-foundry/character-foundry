# Upgrade Implementation Guide

## Unreleased: identity and sync development contracts

This section describes the **unreleased `feat/unity-identity` development
branch**, including the resource-bound changes at `7699064`. It does not describe
an npm release, a merge to `master`, or a documentation-site deployment. Use a
pinned source checkout when evaluating these contracts; the historical CLI
version below does not establish that they are available in that package.

### Identity is additive, not loader hash v3

The public `@character-foundry/character-foundry/identity` subpath exports
`computeCardContentIdentity`, `createCardRevision`, `readCardLineage`,
`verifyCardLineage` and `sanitizeCardForPublish`, among the primitives documented
in [Card content and lineage v1](identity-v1.md).

Existing `computeContentHash` and `computeContentHashV2` loader APIs keep their
existing meanings. They are not interchangeable with the new
`{ algorithm: "foundry-card-v1-sha256", hash }` content identity or
`foundry-revision-v1-sha256` lineage digest. Retain the algorithm identifier
alongside a stored identity; equal-looking hash strings from different contracts
are not evidence of equality. This section does not prescribe a database
migration, corpus re-hash, or replacement of existing hash columns.

The canonical serializer now allows depth 64, 2,000,000 visited JSON values and
32 Mi UTF-16 code units of serialized output, with at most 100,000 entries per
array. Card identity accepts up to 8,192 pointer/digest asset bindings, plus an
optional separate portrait digest. These are bounded serialization/binding
limits, not a promise to accept arbitrary files of that byte size. Increasing
these bounds does not change the canonical payload, algorithm identifiers or
digests of previously accepted inputs.

### Host responsibilities

- Preserve exact accepted original bytes and source provenance separately from
  portable content identity. Reads and untouched exports must not manufacture
  lineage; call `createCardRevision` only for an explicit edit/fork.
- Preserve unknown envelope, extension, lorebook and asset-descriptor fields.
  Supply bindings derived from verified asset bytes, including external assets;
  an asset URL is not a content digest. Extract an implicit portrait consistently
  and hash its image bytes, not the containing character PNG.
- Verify content and lineage after a container round trip. Supported lineage
  export formats are not a guarantee that every writer option preserves every
  field. CharX's `preserveDescriptors: true` option retains authored descriptors
  when matching assets are supplied positionally. Reject loss or explicitly
  create a transformed derivative; never retain a stale identity silently.
- `readCardLineage` is structural parsing; `verifyCardLineage` additionally checks
  current content and revision digests. Neither authenticates an author or
  recursively proves ancestry. Hosts own account/peer authentication, trusted-key
  resolution, access policy and durable replay/idempotency storage.
- `sanitizeCardForPublish` removes only the documented local fields and reports
  them. Unknown fields remain; it is not a general secret detector or permission
  to publish a card. The explicit SillyTavern transport helpers described in the
  identity contract do not repair arbitrary edits or relax asset verification.

### Sync profiles

These separate opt-in development contracts build on identity and keep host
authorization and persistence explicit:

- [Signed HTTP profile v1](sync-http-v1.md): signed requests, key resolution and
  replay admission.
- [Publication reads v1](sync-read-v1.md): bounded publication/asset reads and
  verification.
- [Remote fork submission v1](sync-fork-v1.md): selected fork content, ancestry
  records and verified asset bytes.
- [Publish/fork commands v1](sync-command-v1.md): explicit write commands and
  receipts, separate from read support.

Adopting an identity helper does not enable federation, deploy a host, configure
peer trust or make local Archive files remotely accessible.

---

## Historical release: loader hash v2 and federation hardening

The sections below retain the earlier release's integration guidance and pinned
CLI examples. Their rollout recommendations refer to the older loader hashes,
not the unreleased identity/sync contracts above.

This guide covers the release that introduces:
- Loader content hash v2 (`computeContentHashV2()` + `authoritative.contentHashV2`)
- Federation internal network key gate (`X-Foundry-Network-Key`)
- Federation log levels (default `warn`)
- CharX/Voxta writer changes to preserve arbitrary asset extensions safely
- `CardNormalizer` methods no longer depend on `this` (safe to destructure)

It is written for downstream apps integrating `@character-foundry/character-foundry` (recommended) or workspace packages directly.

---

## 0) CLI: Quick Verification (Optional)

If you want a fast sanity check before/after upgrading, use the CLI to validate and inspect cards.

Use the pinned dev build:

```bash
npx @character-foundry/cli@0.4.2-dev.1765997746 detect ./card.charx
npx @character-foundry/cli@0.4.2-dev.1765997746 validate ./card.charx --strict
npx @character-foundry/cli@0.4.2-dev.1765997746 info ./card.charx
```

Or install globally:

```bash
npm install -g @character-foundry/cli@0.4.2-dev.1765997746
cf validate ./card.charx --strict
```

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
