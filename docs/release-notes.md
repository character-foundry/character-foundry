# Release Notes

This repo uses **Changesets** as the source of truth for release notes and versioning.

Only two packages are published to npm:
- `@character-foundry/character-foundry`
- `@character-foundry/cli`

All other workspace packages are bundled into `@character-foundry/character-foundry`.

## When to add release notes

Add a changeset whenever you make a user-facing change that affects:
- Runtime behavior
- Public API/types
- Security characteristics
- Documentation that changes how consumers should use the library/CLI

## How to write them

Changeset summaries should be written like release notes:
- Start with what changed (1–2 sentences)
- Call out any breaking changes explicitly
- Include migration guidance when relevant
- Prefer concrete identifiers (function names, headers, file formats)

## Workflow

```bash
# Create a changeset (select the published package(s))
pnpm changeset

# Apply changesets (updates package versions + CHANGELOGs)
pnpm version
```

Generated changelogs live in:
- `packages/character-foundry/CHANGELOG.md`
- `packages/cli/CHANGELOG.md`

## Upgrade Guide

For implementation/migration steps for recent changes, see `docs/upgrade-guide.md`.
