---
"@character-foundry/character-foundry": patch
"@character-foundry/cli": patch
---

Make more lorebook entry fields nullable (based on 960k entry analysis)

- `position`: accept empty string `""` (defaults to 'before_char')
- `id`: accept null (28k entries have null id)
- `priority`: accept null (27k entries)
- `insertion_order`: accept null (defaults to 0)
- `secondary_keys`: accept null (27k entries)
- `comment`: accept null (6 entries)
