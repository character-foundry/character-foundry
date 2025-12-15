# Deployment Checklist

## THE ONE RULE

**Every push must be a COMPLETE, SELF-CONTAINED deployment. No "fix the fix" commits.**

---

## Pre-Flight (BEFORE touching any code)

```bash
# 1. Clean working tree - MANDATORY
git status
# If dirty: stash, commit, or discard. DO NOT proceed with uncommitted changes.

# 2. Pull latest
git pull origin master
```

---

## The Actual Workflow

### Step 1: Make Changes + Bump Versions

```bash
# After making code changes, bump the package:
# Edit packages/PACKAGE/package.json version field
```

### Step 2: IF YOU TOUCHED schemas OR core - BUMP ALL DEPENDENTS

This is the #1 cause of multi-push deployments. `workspace:^` means dependents keep their OLD published version until THEY are republished.

```bash
# Check what depends on the package you changed:
grep -r '"@character-foundry/schemas": "workspace' packages/*/package.json

# BUMP EVERY SINGLE ONE. No exceptions.
```

**Packages that depend on schemas (as of Dec 2024):**
- png, charx, voxta, lorebook, loader, exporter, normalizer, federation, cli, app-framework

**Packages that depend on core:**
- png, charx, voxta, lorebook, loader, exporter, normalizer, media, federation, cli

### Step 3: Regenerate Lockfile

```bash
# ALWAYS after ANY package.json change
pnpm install
```

### Step 4: Verify

```bash
pnpm build
pnpm test
pnpm verify-build
```

### Step 5: Update Version Tables

Edit CLAUDE.md "Published Versions" table. (Yes this is manual and annoying.)

### Step 6: Commit EVERYTHING Together

```bash
# Stage ALL related files in ONE commit
git add \
  packages/*/package.json \
  pnpm-lock.yaml \
  CLAUDE.md \
  [any changed source files]

git commit -m "feat/fix/chore: description"
```

### Step 7: Push ONCE

```bash
git push origin master
```

### Step 8: Verify Publish

```bash
# Wait 60s then check
gh run list --limit 1
# Must show: completed success

# Verify deps are correct on npm
pnpm view @character-foundry/PACKAGE dependencies
```

---

## NEVER DO THIS (Common Fuckups)

### ❌ Commit package.json without lockfile
```bash
# WRONG
git add packages/foo/package.json
git commit -m "bump foo"
# CI WILL FAIL: lockfile mismatch
```

### ❌ Have uncommitted changes when generating lockfile
```bash
# You have dirty package.json locally
pnpm install  # Generates lockfile from dirty state
git add pnpm-lock.yaml  # Commits lockfile that doesn't match committed package.json
# CI WILL FAIL
```

### ❌ Bump schemas without bumping dependents
```bash
# WRONG
git add packages/schemas/package.json
git commit -m "bump schemas to 0.2.2"
git push
# Downstream apps STILL get old schemas version from png, charx, etc.
```

### ❌ Assume "workspace:^" auto-updates published deps
```bash
# LOCAL: workspace:^ uses local code directly
# PUBLISHED: workspace:^ becomes "^X.Y.Z" of LAST PUBLISHED version
# If schemas@0.2.2 is published but png@0.0.5 was published with schemas@0.2.0,
# consumers installing png@0.0.5 get schemas@0.2.0, NOT 0.2.2
```

### ❌ Push without checking CI passed
```bash
git push origin master
# Immediately start next task
# CI fails, you don't notice, downstream breaks
```

### ❌ Multiple small "fix" commits
```bash
git push  # fails
git push  # fix lockfile
git push  # fix another thing
git push  # bump more packages
# 4 commits for 1 logical change = messy history + wasted CI runs
```

---

## Quick Reference: Dependency Graph

```
schemas ← png, charx, voxta, lorebook, normalizer, federation, cli, app-framework
          └─ loader, exporter (via above)

core ← png, charx, voxta, lorebook, normalizer, media, federation, cli
       └─ loader, exporter (via above)
```

When you bump `schemas`: bump png, charx, voxta, lorebook, normalizer, federation, cli, app-framework, loader, exporter (10 packages)

When you bump `core`: bump png, charx, voxta, lorebook, normalizer, media, federation, cli, loader, exporter (10 packages)

---

## Verification Commands

```bash
# Check all published packages have consistent schemas version
for pkg in png charx voxta lorebook loader exporter normalizer federation cli app-framework; do
  echo "=== $pkg ==="
  pnpm view @character-foundry/$pkg dependencies 2>&1 | grep schemas
done

# Check CI status
gh run list --limit 5

# Check specific package on npm
pnpm view @character-foundry/PACKAGE versions --json
```

---

## Why This Is Complicated

The `workspace:^` protocol creates a disconnect:
- **Locally**: Dependencies resolve to workspace packages (always latest code)
- **Published**: Dependencies resolve to npm semver ranges (frozen at publish time)

This means:
1. Tests pass locally (using workspace code)
2. Tests pass in CI (using workspace code)
3. Published package has OLD dependency versions
4. Downstream consumers get version conflicts

**The only fix**: When you bump a foundational package (schemas, core), you MUST republish ALL packages that depend on it, even if their code didn't change.

---

## Automation TODO

- [ ] `pnpm run check-deps` - Verify all published packages have consistent dependency versions
- [ ] `pnpm run bump-tree <package>` - Bump a package and all its dependents
- [ ] Pre-push hook to verify lockfile matches package.jsons
- [ ] Auto-update version tables from package.json files
