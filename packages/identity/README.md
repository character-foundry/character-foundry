# Versioned card identity

Additive primitives exposed through `@character-foundry/character-foundry/identity`.
This internal workspace package is bundled into the public SDK, not published
separately. Existing loader/normalizer hashes are unchanged. No database, account,
network, image optimization or implicit file mutation is performed here.

```ts
import { computeCardContentIdentity, createCardRevision, verifyCardLineage }
  from '@character-foundry/character-foundry/identity';

const identity = await computeCardContentIdentity(originalDocument, {
  assets: [{ pointer: '/assets/0/uri', hash: verifiedAssetSha256 }],
});
const saved = await createCardRevision(editedDocument, {
  originalHash: acceptedFileSha256,
  operation: 'edit',
  parents: previousLineage ? [previousLineage] : [],
  author: 'urn:example:user:alice',
  createdAt: new Date().toISOString(),
  nonce: crypto.randomUUID(),
  assets: [{ pointer: '/assets/0/uri', hash: verifiedAssetSha256 }],
});
// After export and re-import, reject a false result rather than retaining stale identity.
const preserved = await verifyCardLineage(reimportedDocument, resolvedAssetDigests);
```

Use the original wrapped JSON document, not a schema parser or normalized view
that may discard unknown fields. Supports wrapped CCv2 `2.0` and CCv3 `3.0`;
legacy/unwrapped/Voxta data must be converted explicitly before hashing.
Pass only digests verified against actual asset bytes. The SDK cannot verify bytes
it has not received. The full normative rules are in [the specification](../../docs/identity-v1.md).

| API | Behavior |
|---|---|
| `canonicalJson` | Bounded JSON-value serialization with lexical keys and JCS primitive rules |
| `hashBytes` | SHA-256 of an owned snapshot of accepted bytes |
| `canonicalCardContent` | Versioned portable payload; no mutation |
| `computeCardContentIdentity` | `{ algorithm: 'foundry-card-v1-sha256', hash }` |
| `createCardRevision` | Explicit save/fork; returns a new card and lineage |
| `readCardLineage` | Structural validation only; no writes |
| `verifyCardLineage` | Checks content and revision digests; no authentication claim |
| `stripCardLineage` | Removes only lineage from a copy |
| `sanitizeCardForPublish` | Removes documented local fields and reports paths |
| `assertLineageExportSupported` | Rejects lineage export outside the known JSON/PNG/CharX envelope |

Node 20.9+, browsers and Workers with Web Crypto are intended runtimes. This
change adds no dependencies. Tests exercise JSON/PNG/CharX primitives and detect
existing lossy CharX descriptor rebuilding. It does not establish a real
SillyTavern round trip, all legacy normalizer paths, or external peer trust.
Even an allowed container must be re-imported and checked for content loss.
