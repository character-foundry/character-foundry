# Work In Progress (WIP) Tracking

## 🔴 Critical Blocking Tasks

### 1. CardsHub Federation Implementation
- [ ] **Infrastructure:** Setup Cloudflare Queues for Inbox/Outbox.
- [ ] **Database:** Create `federation_sync_state` table in D1.
- [ ] **Adapter:** Implement `CardsHubAdapter` (D1 + R2) inside `cards-hub` codebase.
- [ ] **API Routes:** Implement the **Zero-Negotiation** route set:
    - `GET /.well-known/webfinger`
    - `GET /.well-known/nodeinfo`
    - `GET /api/federation/actor`
    - `POST /api/federation/inbox` (Queue Producer)
    - `GET /api/federation/outbox`
    - `GET /api/federation/assets/{id}`

### 2. Card Doctor Refactor
- [ ] **Dependency Migration:**
    - Remove local `@card-architect/*` packages.
    - Install `@character-foundry/*` packages.
    - Refactor imports in `apps/web` and `apps/api`.
- [ ] **Sync Integration:**
    - Implement `SyncEngine` in Card Doctor's API.
    - Connect it to the local SQLite database via a new `DoctorAdapter`.
    - Test sync against a mock CardsHub endpoint.

## 🟡 Maintenance & Improvements

### 3. Package Polish
- [ ] **Release:** Configure changeset/semantic-release for NPM publishing.
- [ ] **Federation:** Ensure `crypto` usage is fully compatible with Cloudflare Workers (Web Crypto API).
- [ ] **Tests:** Add unit tests for `loader` fix (RisuAI asset extraction).

## 🟢 Completed
- [x] **Loader:** Fix RisuAI PNG asset extraction (`chara-ext-asset_:N`).
- [x] **Federation:** Define strict route constants (`FederationRoutes`).
- [x] **Compliance:** Add `COMPLIANCE.md` and `CODEOWNERS` to enforce standards.
