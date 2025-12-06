# Pending Tasks

## 1. Fix PNG Loader for RisuAI Assets
**Issue:** RisuAI cards use `chara-ext-asset_:N` chunk keywords, but the loader looks for numeric indices.
**Files:** `packages/loader/src/loader.ts`
**Action:**
- [x] Modify `parsePng` (or the underlying `extractFromPNG` in `@character-foundry/png`) to handle the prefix.
- [x] Ensure `chara-ext-asset_N` (no colon) variant is also handled.
- [ ] Add test case in `loader.test.ts` or `png/src/parser.ts`.

## 2. Implement Zero-Negotiation Federation in CardsHub
**Issue:** `cardshub` has no ActivityPub implementation yet.
**Files:** `cardshub/src/app/api/federation/...`
**Action:**
- [ ] Implement `/.well-known/webfinger`
- [ ] Implement `/.well-known/nodeinfo`
- [ ] Implement `/api/federation/actor`
- [ ] Implement `/api/federation/inbox` (Queue producer)
- [ ] Implement `/api/federation/outbox`

## 3. Refactor Card Doctor Dependencies
**Issue:** Card Doctor uses internal `@card-architect/*` packages instead of `@character-foundry/*`.
**Files:** `card_doctor/package.json`, `card_doctor/apps/*/package.json`
**Action:**
- [ ] Update `package.json` dependencies.
- [ ] Replace imports in source code.
- [ ] Verify `SyncEngine` integration.

## 4. Release Phase 1 Packages
**Issue:** Packages are currently just source in a repo.
**Action:**
- [ ] Configure `changesets` or `semantic-release`.
- [ ] Publish to NPM (or private registry).
