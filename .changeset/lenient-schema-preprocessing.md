---
"@character-foundry/character-foundry": patch
---

Schemas: Add lenient preprocessing for common real-world card variants (fixes #43)

- **Timestamps**: Accept ISO strings, numeric strings, and milliseconds in `creation_date`/`modification_date` fields. Automatically converts to Unix seconds. Drops negative timestamps (.NET default dates).
- **Lorebook fields**: Accept string values for `scan_depth` and `token_budget` (e.g., `"40"` instead of `40`).
- **Asset types**: Unknown asset type values (e.g., `"link"`) are coerced to `"custom"` instead of failing validation.

This fixes cards that were incorrectly rejected as "unknown format" due to strict schema validation on optional fields with common non-spec-but-valid values.
