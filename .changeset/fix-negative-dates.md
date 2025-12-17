---
"@character-foundry/character-foundry": patch
"@character-foundry/cli": patch
---

Fix negative Unix timestamps from .NET default dates

- Sanitize creation_date/modification_date when converting from Voxta format
- .NET default dates (0001-01-01) produce negative Unix timestamps (-62135596800)
- CCv3 schema requires nonnegative timestamps, so these are now treated as undefined
- Also added defense-in-depth sanitization in the normalizer's fixTimestamps
