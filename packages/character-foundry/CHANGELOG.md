# @character-foundry/character-foundry

## 0.5.0

### Minor Changes

- [#44](https://github.com/character-foundry/character-foundry/pull/44) [`43c3b7a`](https://github.com/character-foundry/character-foundry/commit/43c3b7a02da96cbddd3bc50501f4ba7e3d8fdab6) Thanks [@axAilotl](https://github.com/axAilotl)! - Add `onValidationError` and `onRawChange` callbacks to AutoForm

  - `onValidationError`: Called when Zod validation fails during onChange, providing the ZodError
  - `onRawChange`: Called on every value change regardless of validation status, useful for tracking raw user input

### Patch Changes

- [#44](https://github.com/character-foundry/character-foundry/pull/44) [`78075b3`](https://github.com/character-foundry/character-foundry/commit/78075b3feb4cd0756c624915090453c1cf97b03b) Thanks [@axAilotl](https://github.com/axAilotl)! - Schemas: Add lenient preprocessing for common real-world card variants (fixes #43)

  - **Timestamps**: Accept ISO strings, numeric strings, and milliseconds in `creation_date`/`modification_date` fields. Automatically converts to Unix seconds. Drops negative timestamps (.NET default dates).
  - **Lorebook fields**: Accept string values for `scan_depth` and `token_budget` (e.g., `"40"` instead of `40`).
  - **Asset types**: Unknown asset type values (e.g., `"link"`) are coerced to `"custom"` instead of failing validation.

  This fixes cards that were incorrectly rejected as "unknown format" due to strict schema validation on optional fields with common non-spec-but-valid values.

## 0.4.4

### Patch Changes

- [#41](https://github.com/character-foundry/character-foundry/pull/41) [`2f5662c`](https://github.com/character-foundry/character-foundry/commit/2f5662c056a4ea492a5b738ff7e7f8d066662697) Thanks [@axAilotl](https://github.com/axAilotl)! - - Loader: add content hash v2 (`computeContentHashV2()`), expose `authoritative.contentHashV2`, and accept v1 or v2 hashes in `validateClientMetadata()`.
  - Federation: add optional internal network key gate (`X-Foundry-Network-Key`), fail verification when claimed signed headers are missing, and add configurable logging (default `warn`).
  - CharX/Voxta: preserve arbitrary asset extensions and reject unsafe extensions to prevent ZIP path traversal.
  - Schemas: make `CardNormalizer` methods safe to destructure (no `this` binding required).

## 0.4.3

### Patch Changes

- [#39](https://github.com/character-foundry/character-foundry/pull/39) [`6352698`](https://github.com/character-foundry/character-foundry/commit/63526982f38c5f4cab4085fa8a669713cc4d3447) Thanks [@axAilotl](https://github.com/axAilotl)! - Add 'in_chat' to lorebook position enum (RisuAI compatibility)

  Found 8 entries using `position: "in_chat"` in wild data.
  Validated against 1,295 lorebook entries - 100% pass rate.

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
