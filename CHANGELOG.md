# Changelog

All notable changes to Character Foundry will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Dev CI pipeline with `@dev` npm tag for pre-release testing
- Changesets for automated versioning and CHANGELOG generation
- Branch protection workflow: `feature` → `dev` → `master`

### Changed
- Publishing now uses changesets Release PR workflow
- CI runs on both `master` and `dev` branches

---

## [@character-foundry/character-foundry@0.1.7] - 2024-12-16

### Added
- `image-utils` subpath export for image URL extraction and SSRF protection
- `cf scan` CLI command for directory scanning and card categorization

### Fixed
- Reverted to pure 1:1 field mapping in normalizer, removed extraction logic

## [@character-foundry/cli@0.3.1] - 2024-12-16

### Added
- `scan` command for batch processing character card directories
- `optimize` command for compressing media in packages

### Fixed
- Added missing `@character-foundry/voxta` dependency

---

## [@character-foundry/character-foundry@0.1.6] - 2024-12-15

### Added
- Runtime validation with Zod schemas for CCv2, CCv3, and assets
- `safeParse()` helper for error handling
- Type guards: `isV2Card()`, `isV3Card()`

## [@character-foundry/character-foundry@0.1.5] - 2024-12-14

### Added
- Server-side metadata validation with `validateClientMetadata()`
- Content hash computation for deduplication
- Token tolerance configuration

---

*Earlier versions not documented. See git history for details.*

[Unreleased]: https://github.com/character-foundry/character-foundry/compare/v0.1.7...HEAD
[@character-foundry/character-foundry@0.1.7]: https://github.com/character-foundry/character-foundry/releases/tag/v0.1.7
[@character-foundry/cli@0.3.1]: https://github.com/character-foundry/character-foundry/releases/tag/cli-v0.3.1
