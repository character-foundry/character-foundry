---
"@character-foundry/character-foundry": patch
---

- Loader: add content hash v2 (`computeContentHashV2()`), expose `authoritative.contentHashV2`, and accept v1 or v2 hashes in `validateClientMetadata()`.
- Federation: add optional internal network key gate (`X-Foundry-Network-Key`), fail verification when claimed signed headers are missing, and add configurable logging (default `warn`).
- CharX/Voxta: preserve arbitrary asset extensions and reject unsafe extensions to prevent ZIP path traversal.
- Schemas: make `CardNormalizer` methods safe to destructure (no `this` binding required).

