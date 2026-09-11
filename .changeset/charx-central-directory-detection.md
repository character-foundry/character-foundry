---
"@character-foundry/character-foundry": patch
"@character-foundry/cli": patch
---

Fix CharX detection for large archives by reading the complete ZIP central directory instead of scanning only its final 64 KiB.
