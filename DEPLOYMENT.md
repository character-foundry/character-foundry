# Deployment Guide

## Simplified Architecture

Only **TWO packages** are published to npm:
- `@character-foundry/character-foundry` - Bundled library
- `@character-foundry/cli` - Command-line tool

All other packages (core, schemas, png, etc.) are private workspace packages that get **bundled into** the main package at build time.

This eliminates the old cascading version bump problem - no more bumping 10+ packages!

---

## Release Workflow

### Step 1: Make Changes

Make changes to any package in the monorepo. The source files are organized by functionality:
- `packages/core/` - Binary utilities, ZIP, base64
- `packages/schemas/` - Types and Zod validation
- `packages/loader/` - Parse functions
- etc.

### Step 2: Build & Test

```bash
pnpm build
pnpm test
```

### Step 3: Bump Version

Only bump the published packages:

```bash
# If you changed library code:
# Edit packages/character-foundry/package.json version

# If you changed CLI code:
# Edit packages/cli/package.json version

# If you changed both:
# Bump both
```

### Step 4: Update Docs

Update the version table in `CLAUDE.md`.

### Step 5: Commit & Push

```bash
git add .
git commit -m "feat/fix/chore: description"
git push origin master
```

### Step 6: Verify

```bash
# Check CI succeeded
gh run list --limit 1

# Check published version
npm info @character-foundry/character-foundry version
```

---

## How Bundling Works

The `character-foundry` package uses:
- **tsup** with `noExternal` to bundle all workspace packages into the JS output
- **dts-bundle-generator** to bundle all type declarations into the `.d.ts` files

External dependencies (installed by consumers):
- `fflate` - Compression (browser/node conditional)
- `zod` - Runtime validation
- `gpt-tokenizer` - Token counting
- `sharp` (optional) - Image processing

Peer dependencies (for app-framework):
- `react`, `react-dom`, `react-hook-form`, `@hookform/resolvers`

---

## Troubleshooting

### Build Fails

```bash
# Clean and rebuild
pnpm clean
pnpm build
```

### Types Not Bundling

The type bundling script is at `packages/character-foundry/scripts/bundle-types.js`. If it fails, check:
- All workspace packages are built first
- No circular type dependencies

### npm Publish Fails

| Error | Fix |
|-------|-----|
| 403 | Regenerate NPM_PUBLISH_TOKEN secret |
| Version exists | Bump the version |
| Scope not found | Ensure @character-foundry org exists on npm |

---

## Consumer Usage

Consumers install and import from subpaths:

```typescript
import { parseCard } from '@character-foundry/character-foundry/loader';
import { exportCard } from '@character-foundry/character-foundry/exporter';
import type { CCv3Data } from '@character-foundry/character-foundry/schemas';
```

Or use the convenience main export:

```typescript
import { parseCard, exportCard, CCv3Data } from '@character-foundry/character-foundry';
```
