# @character-foundry/character-foundry

## 0.4.2

### Patch Changes

- [#37](https://github.com/character-foundry/character-foundry/pull/37) [`3c33e00`](https://github.com/character-foundry/character-foundry/commit/3c33e00050fa85fca199532a195a1996229dadd8) Thanks [@axAilotl](https://github.com/axAilotl)! - Fix insertion_order null handling with z.preprocess

  .default() only works for undefined, not null. Use z.preprocess() to convert null/undefined to 0.

## 0.4.1

### Patch Changes

- [#35](https://github.com/character-foundry/character-foundry/pull/35) [`085ac4d`](https://github.com/character-foundry/character-foundry/commit/085ac4df641cbb6609a9383b3a29fb62c5256adf) Thanks [@axAilotl](https://github.com/axAilotl)! - Make more lorebook entry fields nullable (based on 960k entry analysis)

  - `position`: accept empty string `""` (defaults to 'before_char')
  - `id`: accept null (28k entries have null id)
  - `priority`: accept null (27k entries)
  - `insertion_order`: accept null (defaults to 0)
  - `secondary_keys`: accept null (27k entries)
  - `comment`: accept null (6 entries)

## 0.4.0

### Minor Changes

- [#30](https://github.com/character-foundry/character-foundry/pull/30) [`1771f00`](https://github.com/character-foundry/character-foundry/commit/1771f00c10a2709ae3b28a272846bb47a8976938) Thanks [@axAilotl](https://github.com/axAilotl)! - Make lorebook entry schemas lenient for real-world compatibility

  - Accept numeric `position` values (SillyTavern uses 0/1/4 instead of 'before_char'/'after_char')
  - Accept numeric `role` and `selective_logic` values
  - Allow `null` for boolean fields (`case_sensitive`, `selective`, `constant`)
  - Default `enabled` to `true` and `insertion_order` to `0` when missing
  - Make `keys` optional (some tools use `key` instead)
  - Add `.passthrough()` to allow tool-specific extension fields
  - Update normalizer and lorebook handler to handle nullable types

  Tested against 969 real-world lorebook entries (100% pass rate).

### Patch Changes

- [#33](https://github.com/character-foundry/character-foundry/pull/33) [`b312464`](https://github.com/character-foundry/character-foundry/commit/b31246438059fa0a12c4adf491ed2ff25c95e3ec) Thanks [@axAilotl](https://github.com/axAilotl)! - Fix negative Unix timestamps from .NET default dates

  - Sanitize creation_date/modification_date when converting from Voxta format
  - .NET default dates (0001-01-01) produce negative Unix timestamps (-62135596800)
  - CCv3 schema requires nonnegative timestamps, so these are now treated as undefined
  - Also added defense-in-depth sanitization in the normalizer's fixTimestamps
