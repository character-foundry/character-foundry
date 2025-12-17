---
"@character-foundry/character-foundry": patch
"@character-foundry/cli": patch
---

Fix insertion_order null handling with z.preprocess

.default() only works for undefined, not null. Use z.preprocess() to convert null/undefined to 0.
