---
"@character-foundry/character-foundry": patch
"@character-foundry/cli": patch
---

Accept empty string for lorebook entry position field

Some tools set `position: ""` instead of omitting it. Now treated as default ('before_char').
