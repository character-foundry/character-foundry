---
"@character-foundry/schemas": minor
"@character-foundry/normalizer": patch
"@character-foundry/lorebook": patch
---

Make lorebook entry schemas lenient for real-world compatibility

- Accept numeric `position` values (SillyTavern uses 0/1/4 instead of 'before_char'/'after_char')
- Accept numeric `role` and `selective_logic` values
- Allow `null` for boolean fields (`case_sensitive`, `selective`, `constant`)
- Default `enabled` to `true` and `insertion_order` to `0` when missing
- Make `keys` optional (some tools use `key` instead)
- Add `.passthrough()` to allow tool-specific extension fields
- Update normalizer and lorebook handler to handle nullable types

Tested against 969 real-world lorebook entries (100% pass rate).
