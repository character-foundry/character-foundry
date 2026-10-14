---
"@character-foundry/character-foundry": minor
---

Add the `identity` subpath with versioned portable card content identity, asset
digest bindings, explicit revision lineage and publication sanitization helpers.
Existing loader and normalizer hash APIs retain their current behavior.

Add an explicit SillyTavern transport profile that reverses a bounded set of
verified import/export additions while retaining existing content hash semantics.
Changed portable content, asset bindings, lineage or malformed markers fail.
