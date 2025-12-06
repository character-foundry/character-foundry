# Federation Integration Plan: CardsHub

**Goal:** Transform `cards-hub` into a Federation Node (ActivityPub) using the `@character-foundry/federation` package. This will enable it to sync character cards with other hubs, private archives, and local desktop clients (e.g., Card Doctor).

**Target Environment:** Cloudflare Workers (Edge Runtime) + D1 (Database) + R2 (Storage).

---

## 1. Architecture Overview

CardsHub will act as a "Service" actor in ActivityPub terms. It maintains a "canonical" version of cards and accepts updates from authorized peers.

```mermaid
graph TD
    A[External Hub/Client] -->|ActivityPub (JSON-LD)| B(Cloudflare Worker)
    B -->|Verify Sig| C{Router}
    C -->|Inbox POST| D[Queue: Federation-In]
    C -->|Outbox GET| E[D1 Database]
    D --> F[Consumer Worker]
    F -->|Process Activity| G[Federation Package]
    G -->|Adapter| H[D1 Database]
```

---

## 2. Package Compatibility Check

The `@character-foundry/federation` package must be Edge-compatible.
*   **Crypto:** Must use `SubtleCrypto` (Web Crypto API) instead of Node's `crypto`.
*   **Timers:** `setInterval` in `SyncEngine` cannot be used for long-running background syncs in Workers. We must use **Cloudflare Cron Triggers**.
*   **State:** `SyncStateStore` needs a D1 or KV implementation, not FileSystem.

---

## 3. Implementation Steps

### Phase 1: The Adapter Layer
Implement the `PlatformAdapter` interface from `@character-foundry/federation` to wrap the existing `cards-hub` logic.

**File:** `src/lib/federation/cardshub-adapter.ts`

```typescript
class CardsHubAdapter implements PlatformAdapter {
    readonly platform = 'hub';
    
    constructor(private db: AsyncDb, private r2: R2Bucket) {}

    async getCard(localId: string): Promise<CCv3Data> {
        // Query D1 'cards' and 'card_versions' tables
        // Convert row -> CCv3Data
    }

    async saveCard(card: CCv3Data): Promise<string> {
        // Upsert into D1
        // Upload assets to R2
    }
    
    // ... implement listCards, deleteCard, etc.
}
```

### Phase 2: Storage & State
Implement `SyncStateStore` using Cloudflare D1.

**File:** `src/lib/federation/d1-store.ts`
**Schema:**
```sql
CREATE TABLE federation_sync_state (
    federated_id TEXT PRIMARY KEY,
    local_id TEXT,
    version_hash TEXT,
    sync_data JSON, -- stores platform_ids, last_sync timestamps
    updated_at INTEGER
);
```

### Phase 3: API Routes (The Surface)
Mount standard ActivityPub endpoints.

*   **`GET /.well-known/webfinger`**: Resource discovery (aliases `user@domain` to Actor URI).
*   **`GET /api/federation/actor`**: Returns the Service Actor JSON.
*   **`POST /api/federation/inbox`**: Receives activities (`Create`, `Update`, `Delete`).
    *   *Action:* Validate signature -> Push to Cloudflare Queue -> Return 202 Accepted.
*   **`GET /api/federation/outbox`**: Lists public activities (New uploads, updates).

### Phase 4: Background Processing
Since Workers are ephemeral, we cannot keep a `SyncEngine` running.

**Approach:**
1.  **Incoming:** Use Cloudflare Queues. The `inbox` route pushes the JSON; a Consumer worker spins up, instantiates `SyncEngine` + `CardsHubAdapter`, processes the item, and spins down.
2.  **Outgoing:** Use Cloudflare Queues. When a user uploads a card via UI, push a job to the "Broadcast" queue to generate `Create` activities and POST them to followers' inboxes.
3.  **Scheduled Sync:** Use Cron Triggers (`scheduled()`) to run `syncEngine.syncAll()` logic periodically if pulling from specific peers.

---

## 4. Security & Auth

*   **HTTP Signatures:** Required for all incoming POSTs.
*   **Key Management:**
    *   Generate RSA-2048 keypair for the Hub Actor.
    *   Store Private Key in **Cloudflare Secrets**.
    *   Publish Public Key in the Actor JSON.
*   **Allowlist:** Initially, strictly limit federation to trusted domains (e.g., `my-private-archive.com`) to prevent spam.

---

## 5. Roadmap

1.  **Refactor Federation Package:** Ensure `crypto` usage is Web API compatible.
2.  **Hub Adapter:** Create `CardsHubAdapter` in `cards-hub`.
3.  **Read-Only Federation:** Implement Outbox so other apps can "subscribe" to the Hub.
4.  **Write Federation:** Implement Inbox to accept updates from trusted peers.
