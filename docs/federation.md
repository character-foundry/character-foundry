# Federation Package Documentation

**Package:** `@character-foundry/federation`
**Version:** 0.5.2
**Environment:** Node.js (>=18), Browser, and Cloudflare Workers

The `@character-foundry/federation` package provides experimental ActivityPub-based federation for syncing character cards across platforms.

## Features

- **ActivityPub** - Object creation, activity types, WebFinger, NodeInfo
- **Fork Support** - Cross-instance fork tracking and notifications
- **Install Stats** - Track installations from consumers (SillyTavern, Voxta)
- **SyncEngine** - Manages card synchronization across platforms
- **State stores** - `MemorySyncStateStore`, `FileSyncStateStore`, `D1SyncStateStore` (Cloudflare D1)
- **HTTP Signatures** - Full signing/verification using Web Crypto API
- **Platform adapters** - Memory, HTTP, SillyTavern, Archive, Hub
- **Inbox Handler** - Process incoming ActivityPub activities

## Table of Contents

- [Overview](#overview)
- [Security Warning](#security-warning)
- [Enabling Federation](#enabling-federation)
- [Core Concepts](#core-concepts)
- [ActivityPub](#activitypub)
- [Fork Support](#fork-support)
- [Install Stats](#install-stats)
- [Inbox Handler](#inbox-handler)
- [Sync Engine](#sync-engine)
- [Platform Adapters](#platform-adapters)
- [Routes](#routes)
- [Usage Examples](#usage-examples)
- [HTTP Signatures](#http-signatures)
- [D1 Sync State Store](#d1-sync-state-store)

---

## Overview

Federation allows character cards to be:
- Synced across multiple platforms
- Discovered via WebFinger
- Updated via ActivityPub activities
- Shared with followers

This is inspired by how Mastodon and other fediverse apps work.

---

## Security Warning

> **This package is experimental and incomplete.**
>
> Security-critical features (signature validation, inbox handling) are stubbed.
> Do NOT use in production without explicit opt-in.

Federation is disabled by default. You must explicitly enable it.

---

## Enabling Federation

Federation features require explicit opt-in. The requirements depend on your environment:

### Node.js (Dual Opt-In Required)

In Node.js, BOTH steps are required as a safety mechanism:

```typescript
import { enableFederation, isFederationEnabled } from '@character-foundry/federation';

// Step 1: Set environment variable
process.env.FEDERATION_ENABLED = 'true';

// Step 2: Call enableFederation()
enableFederation();

// Check if enabled
if (isFederationEnabled()) {
  // Safe to use federation features
}
```

### Browser / Cloudflare Workers

In environments without `process.env`, use `skipEnvCheck`:

```typescript
import { enableFederation } from '@character-foundry/federation';

// Single opt-in with skipEnvCheck
enableFederation({ skipEnvCheck: true });
```

### Logging

Federation uses a lightweight logger with a default verbosity of `warn`. You can configure it via `enableFederation()`:

```typescript
import { enableFederation } from '@character-foundry/federation';

enableFederation({ logLevel: 'debug' }); // 'silent' | 'error' | 'warn' | 'info' | 'debug'
```

Or set it explicitly:

```typescript
import { setFederationLogLevel } from '@character-foundry/federation';

setFederationLogLevel('info');
```

If you try to use federation features without enabling:

```typescript
import { SyncEngine } from '@character-foundry/federation';

const engine = new SyncEngine(config);
// Throws: "Federation is not enabled. SyncEngine requires federation..."
```

---

## Core Concepts

### Federated IDs

Characters have globally unique IDs:

```typescript
type FederatedCardId = string;  // 'https://example.com/cards/abc123'
type PlatformId = string;       // 'example.com'
```

### Actors

Each platform is represented as an ActivityPub actor:

```typescript
interface FederatedActor {
  id: string;                    // 'https://example.com/actor'
  type: 'Application' | 'Service';
  name: string;
  preferredUsername: string;
  inbox: string;                 // 'https://example.com/inbox'
  outbox: string;                // 'https://example.com/outbox'
  publicKey?: {
    id: string;
    owner: string;
    publicKeyPem: string;
  };
}
```

### Activities

Changes are communicated via activities:

```typescript
type ActivityType = 'Create' | 'Update' | 'Delete' | 'Announce' | 'Like' | 'Undo' | 'Fork' | 'Follow' | 'Install';

interface FederatedActivity {
  '@context': string;
  id: string;
  type: ActivityType;
  actor: string;
  object: unknown;
  published: string;
  to?: string[];
  cc?: string[];
}
```

### Platform Roles

Platforms have different roles in the federation topology:

```typescript
type PlatformRole =
  | 'publisher'   // Archive: sends Create/Update to Hub, Architect
  | 'hub'         // Hub: bi-directional with Architect, distributes to consumers
  | 'architect'   // Architect: bi-directional with Hub, sends to ST/Voxta
  | 'consumer';   // ST/Voxta: receive-only, send install stats back
```

---

## ActivityPub

Utilities for working with ActivityPub.

### Create Activities

```typescript
import {
  cardToActivityPub,
  createCreateActivity,
  createUpdateActivity,
  createDeleteActivity,
  createAnnounceActivity,
} from '@character-foundry/federation';

// Convert card to ActivityPub object
const apObject = cardToActivityPub(card, 'https://example.com/cards/123');

// Create activities
const create = createCreateActivity(actor, apObject);
const update = createUpdateActivity(actor, apObject);
const del = createDeleteActivity(actor, 'https://example.com/cards/123');
const announce = createAnnounceActivity(actor, apObject);
```

### Parse Activities

```typescript
import { parseActivity, validateActivitySignature } from '@character-foundry/federation';

// Parse incoming activity
const activity = parseActivity(jsonBody);

// Validate HTTP signature (stub - always returns true currently)
const valid = await validateActivitySignature(request);
```

### Generate IDs

```typescript
import { generateCardId, generateActivityId } from '@character-foundry/federation';

const cardId = generateCardId('example.com', 'abc123');
// 'https://example.com/cards/abc123'

const activityId = generateActivityId('example.com');
// 'https://example.com/activities/550e8400-...'
```

---

## Fork Support

The federation package supports tracking card forks across instances.

### Fork Types

```typescript
// Reference to the source card stored in the fork
interface ForkReference {
  federatedId: string;      // Source card URI
  platform: PlatformId;     // Source platform
  forkedAt: string;         // ISO timestamp
  sourceVersionHash?: string;
}

// Notification received when someone forks your card
interface ForkNotification {
  forkId: string;           // Federated URI of the fork
  actorId: string;          // Actor who created the fork
  platform: PlatformId;     // Platform where fork was created
  timestamp: string;
}

// Fork activity (custom ActivityPub extension)
interface ForkActivity extends FederatedActivity {
  type: 'Fork';
  object: string;           // Source card URI being forked
  result: FederatedCard;    // The newly created fork
}
```

### Creating Fork Activities

```typescript
import {
  createForkActivity,
  parseForkActivity,
  cardToActivityPub,
  FORK_ACTIVITY_CONTEXT,
} from '@character-foundry/federation';

// Create a fork activity to notify the source instance
const forkedCard = cardToActivityPub(newCard, {
  id: 'https://hub.example.com/cards/fork-123',
  actorId: 'https://hub.example.com/actor',
});

const forkActivity = createForkActivity(
  'https://archive.example.com/cards/source-456', // Source card URI
  forkedCard,
  'https://hub.example.com/actor',
  'https://hub.example.com'
);

// Parse incoming fork activity
const parsed = parseForkActivity(incomingActivity);
if (parsed) {
  console.log(`Fork of ${parsed.sourceCardId} by ${parsed.actor}`);
}
```

### Forking Cards with SyncEngine

```typescript
import { SyncEngine, MemorySyncStateStore } from '@character-foundry/federation';

const engine = new SyncEngine({
  baseUrl: 'https://hub.example.com',
  actorId: 'https://hub.example.com/actor',
  stateStore: new MemorySyncStateStore(),
});

// Fork a card from archive to hub
const result = await engine.forkCard(
  'https://archive.example.com/cards/source-123',
  'archive',
  'hub',
  {
    modifications: { name: 'My Fork of Character' },
  }
);

if (result.success) {
  console.log(`Created fork: ${result.forkFederatedId}`);
  console.log(`Fork metadata stored: ${result.forkState?.forkedFrom?.federatedId}`);
}

// Get fork count for a card
const forkCount = await engine.getForkCount('https://hub.example.com/cards/my-card');

// Find all forks of a card
const forks = await engine.findForks('https://archive.example.com/cards/source-123');
```

### Fork Metadata in Cards

Fork metadata is stored in the card's extensions:

```typescript
// Path: card.data.extensions['character-foundry'].forkedFrom
{
  spec: 'chara_card_v3',
  data: {
    name: 'My Forked Character',
    // ... other fields ...
    extensions: {
      'character-foundry': {
        forkedFrom: {
          federatedId: 'https://archive.example.com/cards/source-123',
          platform: 'archive',
          forkedAt: '2024-01-15T10:30:00Z',
          sourceVersionHash: 'abc123',
        },
      },
    },
  },
}
```

### Fork Events

```typescript
// Listen for fork events
engine.on('card:forked', (event) => {
  console.log(`Created fork: ${event.data.forkFederatedId}`);
});

engine.on('card:fork-received', (event) => {
  console.log(`Received fork notification from ${event.data.notification.actorId}`);
  console.log(`New fork count: ${event.data.newForkCount}`);
});
```

---

## Install Stats

Track card installations from consumer platforms (SillyTavern, Voxta).

### Install Types

```typescript
// Notification received when a consumer installs a card
interface InstallNotification {
  platform: PlatformId;      // Where card was installed
  actorId?: string;          // User who installed (if known)
  timestamp: string;         // ISO timestamp
}

// Aggregated stats for a card
interface CardStats {
  installCount: number;                            // Total installs
  installsByPlatform: Partial<Record<PlatformId, number>>;
  forkCount: number;
  likeCount: number;
  lastUpdated: string;
}

// Install activity (custom ActivityPub extension)
interface InstallActivity extends FederatedActivity {
  type: 'Install';
  object: string;            // Card URI that was installed
  target?: {
    type: 'Application';
    name: PlatformId;        // Platform where installed
  };
}
```

### Creating Install Activities

Consumers (SillyTavern, Voxta) send Install activities when a user adds a card:

```typescript
import {
  createInstallActivity,
  parseInstallActivity,
  INSTALL_ACTIVITY_CONTEXT,
} from '@character-foundry/federation';

// Create install activity to notify hub
const installActivity = createInstallActivity(
  'https://hub.example.com/cards/card-123', // Card federated ID
  'https://sillytavern.local/actor',         // Consumer actor
  'https://sillytavern.local',               // Consumer base URL
  'sillytavern'                              // Platform ID
);

// Parse incoming install activity
const parsed = parseInstallActivity(incomingActivity);
if (parsed) {
  console.log(`Card ${parsed.cardId} installed on ${parsed.platform}`);
}
```

### Handling Install Notifications

```typescript
import { SyncEngine, handleInbox } from '@character-foundry/federation';

const engine = new SyncEngine({ /* config */ });

// In your inbox handler
app.post('/inbox', async (req) => {
  const result = await handleInbox(await req.json(), req.headers, {
    fetchActor,
    onInstall: async (activity) => {
      // This updates install count in sync state
      await engine.handleInstallNotification(activity);
    },
  });

  return result.accepted
    ? new Response(null, { status: 202 })
    : new Response(result.error, { status: 400 });
});
```

### Getting Stats

```typescript
// Get full stats for a card
const stats = await engine.getCardStats('https://hub.example.com/cards/card-123');
console.log(`Total installs: ${stats.installCount}`);
console.log(`SillyTavern installs: ${stats.installsByPlatform.sillytavern}`);

// Get just install count
const installCount = await engine.getInstallCount('https://hub.example.com/cards/card-123');
```

### Install Events

```typescript
// Listen for install events
engine.on('card:installed', (event) => {
  console.log(`Pushed card to ${event.data.platform}`);
});

engine.on('card:install-received', (event) => {
  console.log(`Install notification from ${event.data.platform}`);
  console.log(`New install count: ${event.data.newInstallCount}`);
});
```

### SillyTavern Bridge Extensions

The SillyTavern bridge interface includes optional methods for stats:

```typescript
interface SillyTavernBridge {
  // ... base methods ...

  // Optional: Get usage stats for a character
  getCharacterStats?(name: string): Promise<STCharacterStats | null>;

  // Optional: Get stats for all characters
  getAllStats?(): Promise<Map<string, STCharacterStats>>;

  // Optional: Notify hub about installation
  notifyInstall?(federatedId: string, hubInbox: string): Promise<void>;
}

interface STCharacterStats {
  chatCount?: number;
  messageCount?: number;
  lastUsed?: string;
  installedAt?: string;
}
```

---

## Inbox Handler

Process incoming ActivityPub activities with the inbox handler.

### Basic Usage

```typescript
import { handleInbox, validateForkActivity } from '@character-foundry/federation';

// In your web framework (Express, Hono, etc.)
app.post('/inbox', async (req) => {
  const result = await handleInbox(await req.json(), req.headers, {
    fetchActor: async (actorId) => {
      // Fetch actor from network for signature verification
      return await fetchActorFromRemote(actorId);
    },
    strictMode: true, // Enforce HTTP signature validation

    // Activity handlers
    onFork: async (activity) => {
      await syncEngine.handleForkNotification(activity);
    },
    onCreate: async (activity) => {
      console.log(`New card created: ${activity.object.name}`);
    },
    onUpdate: async (activity) => {
      console.log(`Card updated: ${activity.object.id}`);
    },
    onDelete: async (activity) => {
      console.log(`Card deleted: ${activity.object}`);
    },
    onLike: async (activity) => {
      console.log(`Card liked: ${activity.object}`);
    },
  });

  if (result.accepted) {
    return new Response(null, { status: 202 });
  } else {
    return new Response(result.error, { status: 400 });
  }
});
```

### Handling Fork Notifications

```typescript
import { SyncEngine, handleInbox } from '@character-foundry/federation';

const engine = new SyncEngine({ /* config */ });

app.post('/inbox', async (req) => {
  const result = await handleInbox(await req.json(), req.headers, {
    fetchActor,
    onFork: async (activity) => {
      // This updates the fork count and stores notification
      await engine.handleForkNotification(activity);
    },
  });

  return result.accepted
    ? new Response(null, { status: 202 })
    : new Response(result.error, { status: 400 });
});
```

### Validating Fork Activities

```typescript
import { validateForkActivity } from '@character-foundry/federation';

const validation = validateForkActivity(incomingActivity);

if (validation.valid) {
  // Process the fork
} else {
  console.error(`Invalid fork activity: ${validation.error}`);
}
```

---

## Sync Engine

The sync engine manages card synchronization.

### Configuration

```typescript
interface FederationConfig {
  domain: string;              // Your domain
  actorId: string;             // Your actor URL
  privateKey?: string;         // For signing (not implemented)
  publicKey?: string;
}

interface SyncEngineOptions {
  config: FederationConfig;
  stateStore: SyncStateStore;
  adapters: PlatformAdapter[];
}
```

### Usage

```typescript
import {
  SyncEngine,
  MemorySyncStateStore,
  MemoryPlatformAdapter,
  enableFederation,
} from '@character-foundry/federation';

// Enable federation first!
enableFederation();

const engine = new SyncEngine({
  config: {
    domain: 'myapp.example.com',
    actorId: 'https://myapp.example.com/actor',
  },
  stateStore: new MemorySyncStateStore(),
  adapters: [new MemoryPlatformAdapter()],
});

// Sync a card
const result = await engine.sync(card);

// Handle incoming activity
await engine.handleActivity(activity);
```

### State Stores

Track sync state between runs:

```typescript
import {
  MemorySyncStateStore,
  FileSyncStateStore,
  createLocalStorageStore,
} from '@character-foundry/federation';

// In-memory (lost on restart)
const memory = new MemorySyncStateStore();

// File-based (Node.js)
const file = new FileSyncStateStore('./sync-state.json');

// LocalStorage (browser)
const local = createLocalStorageStore('card-sync');
```

---

## Platform Adapters

Adapters connect to specific platforms.

### Built-in Adapters

```typescript
import {
  MemoryPlatformAdapter,
  HttpPlatformAdapter,
  SillyTavernAdapter,
  createArchiveAdapter,
  createHubAdapter,
} from '@character-foundry/federation';

// In-memory (for testing)
const memory = new MemoryPlatformAdapter();

// Generic HTTP adapter
const http = new HttpPlatformAdapter({
  baseUrl: 'https://api.example.com',
  fetch: globalThis.fetch,
});

// SillyTavern integration
const st = new SillyTavernAdapter(sillyTavernBridge);

// Archive.org adapter
const archive = createArchiveAdapter();

// Character hub adapter
const hub = createHubAdapter('https://hub.example.com');
```

### Custom Adapter

```typescript
import { BasePlatformAdapter } from '@character-foundry/federation';

class MyPlatformAdapter extends BasePlatformAdapter {
  id = 'my-platform';
  name = 'My Platform';

  async fetchCard(id: string): Promise<AdapterCard | null> {
    // Fetch from your platform
  }

  async pushCard(card: AdapterCard): Promise<void> {
    // Push to your platform
  }

  async deleteCard(id: string): Promise<void> {
    // Delete from your platform
  }
}
```

### SillyTavern Bridge

For SillyTavern integration:

```typescript
interface SillyTavernBridge {
  getCharacter(name: string): Promise<STCharacter | null>;
  saveCharacter(char: STCharacter): Promise<void>;
  deleteCharacter(name: string): Promise<void>;
  listCharacters(): Promise<string[]>;
}

// Convert between formats
import { stCharacterToCCv3, ccv3ToSTCharacter } from '@character-foundry/federation';

const ccv3 = stCharacterToCCv3(stCharacter);
const st = ccv3ToSTCharacter(ccv3Card);

// Create mock bridge for testing
const mockBridge = createMockSTBridge();
```

---

## Routes

HTTP route handlers for federation endpoints.

### WebFinger

```typescript
import { handleWebFinger } from '@character-foundry/federation';

// Handle /.well-known/webfinger?resource=acct:card@example.com
app.get('/.well-known/webfinger', (req, res) => {
  const response = handleWebFinger(req.query.resource, config);
  res.json(response);
});
```

### NodeInfo

```typescript
import { handleNodeInfoDiscovery, handleNodeInfo } from '@character-foundry/federation';

// Discovery endpoint
app.get('/.well-known/nodeinfo', (req, res) => {
  res.json(handleNodeInfoDiscovery(config));
});

// NodeInfo endpoint
app.get('/nodeinfo/2.0', (req, res) => {
  res.json(handleNodeInfo(config, stats));
});
```

### Actor

```typescript
import { handleActor } from '@character-foundry/federation';

// Actor endpoint
app.get('/actor', (req, res) => {
  res.json(handleActor(config));
});
```

---

## Usage Examples

### Basic Sync Setup

```typescript
import {
  enableFederation,
  SyncEngine,
  MemorySyncStateStore,
  HttpPlatformAdapter,
} from '@character-foundry/federation';

// Enable federation
enableFederation();

// Create adapters for platforms you want to sync with
const adapters = [
  new HttpPlatformAdapter({
    baseUrl: 'https://platform1.example.com',
    fetch: globalThis.fetch,
  }),
  new HttpPlatformAdapter({
    baseUrl: 'https://platform2.example.com',
    fetch: globalThis.fetch,
  }),
];

// Create sync engine
const engine = new SyncEngine({
  config: {
    domain: 'myapp.example.com',
    actorId: 'https://myapp.example.com/actor',
  },
  stateStore: new MemorySyncStateStore(),
  adapters,
});

// Sync a card to all platforms
async function syncCard(card: CCv3Data) {
  const results = await engine.sync(card);

  for (const result of results) {
    if (result.success) {
      console.log(`Synced to ${result.platform}`);
    } else {
      console.error(`Failed to sync to ${result.platform}:`, result.error);
    }
  }
}
```

### Express Server with Federation

```typescript
import express from 'express';
import {
  enableFederation,
  handleWebFinger,
  handleNodeInfoDiscovery,
  handleNodeInfo,
  handleActor,
} from '@character-foundry/federation';

enableFederation();

const app = express();
const config = {
  domain: 'cards.example.com',
  actorId: 'https://cards.example.com/actor',
};

// WebFinger
app.get('/.well-known/webfinger', (req, res) => {
  const resource = req.query.resource as string;
  const response = handleWebFinger(resource, config);
  res.json(response);
});

// NodeInfo
app.get('/.well-known/nodeinfo', (req, res) => {
  res.json(handleNodeInfoDiscovery(config));
});

app.get('/nodeinfo/2.0', (req, res) => {
  res.json(handleNodeInfo(config, { cardCount: 100 }));
});

// Actor
app.get('/actor', (req, res) => {
  res.json(handleActor(config));
});

// Inbox (stub)
app.post('/inbox', express.json(), async (req, res) => {
  // Handle incoming activities
  // NOTE: Signature validation not implemented!
  res.status(202).send();
});

app.listen(3000);
```

### Event Listening

```typescript
import { SyncEngine, FederationEventListener } from '@character-foundry/federation';

const listener: FederationEventListener = (event) => {
  switch (event.type) {
    case 'sync:start':
      console.log(`Starting sync for ${event.cardId}`);
      break;
    case 'sync:complete':
      console.log(`Sync complete for ${event.cardId}`);
      break;
    case 'sync:error':
      console.error(`Sync failed:`, event.error);
      break;
    case 'activity:received':
      console.log(`Received ${event.activity.type} activity`);
      break;
  }
};

engine.on('*', listener);
```

---

## HTTP Signatures

Full HTTP signature support using Web Crypto API (works in Node.js, browsers, and Cloudflare Workers).

### Sign Outgoing Requests

```typescript
import { signRequest, calculateDigest } from '@character-foundry/federation';

const body = JSON.stringify(activity);
const digest = await calculateDigest(body);

const { signature, date } = await signRequest({
  privateKeyPem: PRIVATE_KEY,
  keyId: 'https://example.com/actor#main-key',
  method: 'POST',
  path: '/inbox',
  host: 'remote.example.com',
  digest,
  contentType: 'application/activity+json',
});

// Add headers to request
headers.set('Signature', signature);
headers.set('Date', date);
headers.set('Digest', digest);
```

### Verify Incoming Requests

```typescript
import {
  parseSignatureHeader,
  verifyHttpSignature,
  validateActivitySignature,
} from '@character-foundry/federation';

// Low-level verification
const parsed = parseSignatureHeader(request.headers.get('Signature')!);
const valid = await verifyHttpSignature(
  parsed,
  actor.publicKey.publicKeyPem,
  'POST',
  '/inbox',
  request.headers
);

// High-level validation (fetches actor, checks date, validates)
const result = await validateActivitySignature(activity, request.headers, {
  method: 'POST',
  path: '/inbox',
  fetchActor: async (id) => fetchActorFromRemote(id),
  maxAge: 300, // 5 minutes
});

if (result.valid) {
  console.log(`Verified activity from ${result.actor.id}`);
} else {
  console.error(`Signature invalid: ${result.error}`);
}
```

### Signature Types

```typescript
interface ParsedSignature {
  keyId: string;      // Actor key ID
  algorithm: string;  // 'rsa-sha256' or 'hs2019'
  headers: string[];  // Headers included in signature
  signature: string;  // Base64 signature
}

interface SignatureValidationResult {
  valid: boolean;
  error?: string;
  actor?: FederatedActor;
  keyId?: string;
}
```

---

## Security Configuration

The federation package includes several security options that can be configured based on your deployment mode.

### Deployment Modes

| Mode | Description | Recommended Settings |
|------|-------------|---------------------|
| **Full (local/web)** | Full federation with other instances | `strictMode: true`, `secureHashing: true` |
| **PWA LITE** | Local-only editing, no federation | Federation disabled (default) |

### HTTP Signature Strict Mode

By default, signature validation is permissive for backwards compatibility. Enable strict mode for production deployments:

```typescript
import { validateHttpSignature } from '@character-foundry/federation';

const result = await validateHttpSignature(activity, headers, {
  method: 'POST',
  path: '/inbox',
  fetchActor,
  maxAge: 300,
  strictMode: true, // Recommended for production
});
```

**Strict mode enforces:**
- `(request-target)` header MUST be signed
- `host` header MUST be present and signed
- `date` header MUST be present and signed

> **⚠️ CRITICAL: Path Must Match Your Route**
>
> The `path` option MUST match the actual request path. If your inbox is mounted at
> `/api/federation/inbox`, you must pass that exact path—not `/inbox`. Signature
> verification will fail if the path doesn't match what the sender signed.
>
> ```typescript
> // ❌ WRONG - signatures will fail to verify
> handleInbox(body, headers, { path: '/inbox', ... });
>
> // ✅ CORRECT - matches your actual route
> handleInbox(body, headers, { path: '/api/federation/inbox', ... });
> ```

**Security implications:**
- Without `date` in signature: replay attacks possible
- Without `host` in signature: cross-host request reuse possible

### Internal Network Key (Optional)

For internal-only deployments (e.g., multiple instances on the same private network), you can require a shared network key on inbound requests.

- Header: `X-Foundry-Network-Key`
- Option: `handleInbox(..., { networkKey: 'your-secret' })`
- In `strictMode`, the header must also be included in the signed header list (prevents downgrade/injection).

```typescript
import { handleInbox } from '@character-foundry/federation';

const rawBody = await req.text();
const body = JSON.parse(rawBody);

const result = await handleInbox(body, req.headers, {
  rawBody,
  strictMode: true,
  method: 'POST',
  path: '/api/federation/inbox',
  networkKey: process.env.FOUNDRY_NETWORK_KEY!,
  fetchActor,
});
```

### Digest Verification (Body Integrity)

HTTP signatures only cover headers, not the request body. Without Digest verification, an attacker could intercept a signed request, modify the JSON body, and the signature would still pass.

The `handleInbox` function verifies the `Digest` header when present:

```typescript
// CRITICAL: Capture raw body BEFORE JSON parsing
const rawBody = await req.text();
const body = JSON.parse(rawBody);

const result = await handleInbox(body, req.headers, {
  rawBody, // Required for body integrity verification
  strictMode: true,
  method: 'POST',
  path: '/api/federation/inbox',
  fetchActor,
});
```

**Verification order (fail-fast):**
1. **Digest verification** (SHA-256 hash, cheap) - Reject tampered bodies early
2. **Signature verification** (RSA crypto, expensive) - Verify header integrity

**What gets verified:**
- If `Digest` header present → MUST provide `rawBody`, hash MUST match
- If signature includes `digest` in signed headers → `Digest` header MUST be present
- Supported format: `SHA-256=<base64-hash>` (RFC 3230)

**Without `rawBody`:**
```typescript
// ❌ If Digest header present, this will fail
handleInbox(body, headers, { strictMode: true, ... });

// ✅ Always pass rawBody for full security
handleInbox(body, headers, { rawBody, strictMode: true, ... });
```

### Secure Hashing

By default, change detection uses a fast 32-bit hash. Enable SHA-256 for cross-system federation:

```typescript
import { SyncEngine, enableFederation } from '@character-foundry/federation';

enableFederation();

const engine = new SyncEngine({
  baseUrl: 'https://example.com',
  actorId: 'https://example.com/actor',
  stateStore,
  autoSyncInterval: 60000,
  secureHashing: true, // Recommended for federation
});
```

| Hash Mode | Algorithm | Collision Risk | Use Case |
|-----------|-----------|----------------|----------|
| Default | 32-bit djb2 | ~2^16 birthday bound | Local-only, trusted sources |
| Secure | SHA-256 | Negligible | Cross-system federation |

### SSRF Protection

The HTTP adapter validates resource IDs to prevent SSRF and path traversal attacks:

```typescript
import { HttpPlatformAdapter, InvalidResourceIdError } from '@character-foundry/federation';

const adapter = new HttpPlatformAdapter({
  platform: 'external',
  displayName: 'External Platform',
  baseUrl: 'https://api.example.com',
  endpoints: { /* ... */ },
});

try {
  // These will throw InvalidResourceIdError:
  await adapter.getCard('../../../etc/passwd');
  await adapter.getCard('https://evil.com/steal');
  await adapter.getCard('/absolute/path');
} catch (err) {
  if (err instanceof InvalidResourceIdError) {
    console.error(`Blocked malicious ID: ${err.id} (${err.reason})`);
  }
}
```

**Protected against:**
- Path traversal (`../`)
- Absolute paths (`/etc/passwd`, `C:\Windows`)
- Protocol injection (`https://`, `file://`)
- URL-encoded attacks (`%2e%2e`)

### Recommended Production Configuration

```typescript
import {
  enableFederation,
  SyncEngine,
  validateHttpSignature,
  D1SyncStateStore,
} from '@character-foundry/federation';

// Enable federation
enableFederation();

// Validate incoming signatures with strict mode
async function handleInbox(request: Request, activity: FederatedActivity) {
  const result = await validateHttpSignature(activity, request.headers, {
    method: 'POST',
    path: '/inbox',
    fetchActor,
    strictMode: true, // Enforce required headers
    maxAge: 300,      // 5 minute window
  });

  if (!result.valid) {
    return new Response(result.error, { status: 401 });
  }

  // Process activity...
}

// Create engine with secure hashing
const engine = new SyncEngine({
  baseUrl: 'https://production.example.com',
  actorId: 'https://production.example.com/actor',
  stateStore: new D1SyncStateStore(env.DB),
  autoSyncInterval: 60000,
  secureHashing: true, // SHA-256 for change detection
});
```

---

## Implementation Status

| Feature | Status |
|---------|--------|
| ActivityPub object creation | Implemented |
| WebFinger handler | Implemented |
| NodeInfo handler | Implemented |
| Actor endpoint | Implemented |
| HTTP Signatures | Implemented (Web Crypto) |
| HTTP Signature Strict Mode | Implemented |
| Secure Hashing (SHA-256) | Implemented |
| SSRF Protection | Implemented |
| D1 State Store | Implemented (Cloudflare D1) |
| Memory State Store | Implemented |
| File State Store | Implemented |
| LocalStorage State Store | Implemented |
| Fork Activities | Implemented |
| Fork Tracking | Implemented |
| Fork Notifications | Implemented |
| Install Activities | Implemented |
| Install Stats Tracking | Implemented |
| Inbox Handler | Implemented |
| Following/Followers | Not implemented |
| Boost/Like | Activity creation only |

---

## D1 Sync State Store

For production use on Cloudflare Workers, use `D1SyncStateStore` to persist sync state in Cloudflare D1 (SQLite).

### Setup

```typescript
import { D1SyncStateStore, enableFederation, SyncEngine } from '@character-foundry/federation';

// In your Cloudflare Worker
export default {
  async fetch(request: Request, env: Env) {
    enableFederation();

    // Create D1-backed state store
    const stateStore = new D1SyncStateStore(env.DB);
    await stateStore.init(); // Creates table if not exists (idempotent)

    const engine = new SyncEngine({
      config: {
        domain: 'myapp.example.com',
        actorId: 'https://myapp.example.com/actor',
      },
      stateStore,
      adapters: [],
    });

    // Use engine...
  },
};
```

### D1Database Interface

The store accepts any object implementing the D1Database interface:

```typescript
interface D1Database {
  prepare(query: string): D1PreparedStatement;
  exec(query: string): Promise<D1ExecResult>;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(column?: string): Promise<T | null>;
  run(): Promise<D1Result>;
  all<T = unknown>(): Promise<D1Result<T>>;
}

interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
  meta: {
    duration: number;
    changes: number;
    last_row_id: number;
    served_by?: string;
  };
}
```

### Methods

```typescript
const store = new D1SyncStateStore(db, 'custom_table_name'); // default: 'federation_sync_state'

// Initialize (creates table and indexes)
await store.init();

// Basic CRUD
await store.set(syncState);
const state = await store.get(federatedId);
await store.delete(federatedId);

// Listing
const allStates = await store.list();
const pendingStates = await store.listByStatus('pending');
const count = await store.count();

// Lookups
const byPlatform = await store.findByPlatformId('chub', 'card-123');
const byLocal = await store.findByLocalId('local-id-456');

// Testing
await store.clear(); // Deletes all data - use with caution!
```

### Schema

The store creates the following table:

```sql
CREATE TABLE federation_sync_state (
  federated_id TEXT PRIMARY KEY,
  local_id TEXT NOT NULL,
  platform_ids TEXT NOT NULL,     -- JSON object
  last_sync TEXT NOT NULL,        -- JSON object
  version_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('synced', 'pending', 'conflict', 'error')),
  conflict TEXT,                  -- JSON or NULL
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Index for local ID lookups
CREATE INDEX idx_federation_sync_state_local_id ON federation_sync_state(local_id);
```

### Usage with Wrangler

1. Create a D1 database:

```bash
wrangler d1 create character-federation
```

2. Add to `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "character-federation"
database_id = "your-database-id"
```

3. Access in your worker:

```typescript
interface Env {
  DB: D1Database;
}

export default {
  async fetch(request: Request, env: Env) {
    const store = new D1SyncStateStore(env.DB);
    await store.init();
    // ...
  },
};
```

---

## Deployment Security Guide

When deploying federation endpoints in production, implement these security measures at the application layer.

### Node.js Version

The federation package requires Node.js 18+ for:
- Global `fetch` API
- `Headers` / `Request` / `Response` classes
- `crypto.subtle` (Web Crypto API)
- `atob` / `btoa` globals

```json
{
  "engines": {
    "node": ">=18.0.0"
  }
}
```

### Request Limits

Enforce inbound limits to prevent resource exhaustion:

```typescript
// Express
import express from 'express';

app.use('/api/federation', express.json({
  limit: '1mb',           // Max body size
  strict: true,           // Only accept objects/arrays
  type: ['application/json', 'application/activity+json'],
}));

// Hono
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';

app.use('/federation/*', bodyLimit({
  maxSize: 1024 * 1024, // 1MB
}));
```

### Raw Body for Digest Verification

To verify HTTP Digest headers, you need the raw request body (JSON parsers may alter whitespace):

```typescript
// Express - capture raw body
app.use('/federation/inbox', express.json({
  verify: (req, res, buf) => {
    (req as any).rawBody = buf;
  },
}));

// Then verify
import { calculateDigest } from '@character-foundry/federation';

const expectedDigest = await calculateDigest((req as any).rawBody);
const actualDigest = req.headers['digest'];
if (actualDigest !== expectedDigest) {
  return res.status(400).json({ error: 'Digest mismatch' });
}
```

### Fetch Timeouts

The `HttpPlatformAdapter` supports configurable timeouts (default: 30 seconds):

```typescript
import { HttpPlatformAdapter } from '@character-foundry/federation';

const adapter = new HttpPlatformAdapter({
  platform: 'external',
  displayName: 'External API',
  baseUrl: 'https://api.example.com',
  endpoints: { /* ... */ },
  timeout: 10000, // 10 second timeout
});
```

For custom `fetchActor` implementations, add timeouts:

```typescript
async function fetchActor(actorId: string): Promise<FederatedActor | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(actorId, {
      headers: { 'Accept': 'application/activity+json' },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
```

### Replay Protection

Implement activity deduplication to prevent replay attacks:

```typescript
import { LRUCache } from 'lru-cache';

// In-memory cache of seen activity IDs (5 minute TTL)
const seenActivities = new LRUCache<string, boolean>({
  max: 10000,
  ttl: 5 * 60 * 1000, // 5 minutes
});

app.post('/federation/inbox', async (req, res) => {
  const activity = req.body;

  // Check for replay
  if (seenActivities.has(activity.id)) {
    return res.status(200).json({ status: 'duplicate' });
  }

  // Mark as seen BEFORE processing
  seenActivities.set(activity.id, true);

  // Process activity...
});
```

### SSRF Protection for fetchActor

When fetching remote actors, prevent SSRF attacks:

```typescript
import { URL } from 'url';

function isAllowedUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);

    // HTTPS only
    if (url.protocol !== 'https:') return false;

    // Block private IP ranges
    const hostname = url.hostname;
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('172.16.') ||
      hostname.endsWith('.local')
    ) {
      return false;
    }

    // Block internal ports (optional)
    const port = url.port || '443';
    if (!['443', '8443'].includes(port)) return false;

    return true;
  } catch {
    return false;
  }
}

async function fetchActor(actorId: string): Promise<FederatedActor | null> {
  if (!isAllowedUrl(actorId)) {
    console.warn(`Blocked SSRF attempt: ${actorId}`);
    return null;
  }

  // ... fetch with timeout
}
```

### Actor Key Caching

Cache fetched actor public keys to reduce latency and external requests:

```typescript
import { LRUCache } from 'lru-cache';

const actorCache = new LRUCache<string, FederatedActor>({
  max: 1000,
  ttl: 60 * 60 * 1000, // 1 hour
});

async function fetchActorCached(actorId: string): Promise<FederatedActor | null> {
  const cached = actorCache.get(actorId);
  if (cached) return cached;

  const actor = await fetchActorFromRemote(actorId);
  if (actor) {
    actorCache.set(actorId, actor);
  }
  return actor;
}
```

### Structured Logging

Log federation activity safely (redact sensitive data):

```typescript
import { handleInbox } from '@character-foundry/federation';

app.post('/federation/inbox', async (req, res) => {
  const requestId = crypto.randomUUID();

  const result = await handleInbox(req.body, req.headers, {
    fetchActor,
    strictMode: true,
    // ... handlers
  });

  // Structured log (safe)
  console.log(JSON.stringify({
    requestId,
    timestamp: new Date().toISOString(),
    activityId: req.body?.id,
    activityType: req.body?.type,
    actor: req.body?.actor,
    accepted: result.accepted,
    error: result.error,
    // DO NOT log: req.headers (contains Signature)
    // DO NOT log: req.body.object.content (may be large)
  }));

  return res.status(result.accepted ? 202 : 400).json(result);
});
```

### Reverse Proxy Auth (Internal Testing)

For internal federation testing, add an auth layer:

```typescript
// Middleware for internal auth
function internalAuth(req, res, next) {
  const authHeader = req.headers['x-internal-auth'];
  const expectedToken = process.env.INTERNAL_AUTH_TOKEN;

  if (!authHeader || authHeader !== expectedToken) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  next();
}

// Apply to federation routes during testing
if (process.env.NODE_ENV !== 'production') {
  app.use('/api/federation', internalAuth);
}
```

Or use nginx:

```nginx
location /api/federation/ {
    # Allow internal network only
    allow 10.0.0.0/8;
    allow 172.16.0.0/12;
    allow 192.168.0.0/16;
    deny all;

    proxy_pass http://backend:3000;
}
```

### Key Management

Never log or expose private keys:

```typescript
// Load from environment or secrets manager
const PRIVATE_KEY = process.env.FEDERATION_PRIVATE_KEY;

// Validate key exists at startup
if (!PRIVATE_KEY && process.env.NODE_ENV === 'production') {
  throw new Error('FEDERATION_PRIVATE_KEY required in production');
}

// Never log keys
process.on('uncaughtException', (err) => {
  // Sanitize error - don't dump env
  console.error('Uncaught exception:', err.message);
  process.exit(1);
});
```

### Content-Type Handling

Accept ActivityPub content types:

```typescript
app.post('/federation/inbox', (req, res, next) => {
  const contentType = req.headers['content-type'] || '';

  const validTypes = [
    'application/json',
    'application/activity+json',
    'application/ld+json',
  ];

  if (!validTypes.some(t => contentType.includes(t))) {
    return res.status(415).json({
      error: 'Unsupported Media Type',
      expected: validTypes,
    });
  }

  next();
});
```

### Complete Example

```typescript
import express from 'express';
import { LRUCache } from 'lru-cache';
import {
  enableFederation,
  handleInbox,
  signRequest,
  calculateDigest,
} from '@character-foundry/federation';

// Require Node 18+
const nodeVersion = parseInt(process.version.slice(1).split('.')[0]);
if (nodeVersion < 18) {
  throw new Error('Node.js 18+ required for federation');
}

enableFederation({ skipEnvCheck: false }); // Require env var in Node.js

const app = express();

// Replay protection
const seenActivities = new LRUCache<string, boolean>({
  max: 10000,
  ttl: 5 * 60 * 1000,
});

// Actor cache
const actorCache = new LRUCache<string, FederatedActor>({
  max: 1000,
  ttl: 60 * 60 * 1000,
});

// Parse JSON with raw body capture
app.use('/federation/inbox', express.json({
  limit: '1mb',
  type: ['application/json', 'application/activity+json', 'application/ld+json'],
  verify: (req, res, buf) => { (req as any).rawBody = buf; },
}));

app.post('/federation/inbox', async (req, res) => {
  const requestId = crypto.randomUUID();
  const activity = req.body;

  // Replay check
  if (seenActivities.has(activity.id)) {
    return res.status(200).json({ status: 'duplicate' });
  }
  seenActivities.set(activity.id, true);

  // Verify digest if present
  const digestHeader = req.headers['digest'];
  if (digestHeader) {
    const expected = await calculateDigest((req as any).rawBody);
    if (digestHeader !== expected) {
      console.warn({ requestId, error: 'digest_mismatch' });
      return res.status(400).json({ error: 'Digest mismatch' });
    }
  }

  // Handle activity with strict signature verification
  const result = await handleInbox(activity, new Headers(req.headers as any), {
    method: 'POST',
    path: '/federation/inbox',
    fetchActor: async (id) => {
      if (!isAllowedUrl(id)) return null;
      return actorCache.get(id) ?? await fetchActorFromRemote(id);
    },
    strictMode: true,
    maxAge: 300,
    onFork: async (activity) => { /* ... */ },
    onInstall: async (activity) => { /* ... */ },
  });

  console.log(JSON.stringify({
    requestId,
    activityId: activity.id,
    activityType: activity.type,
    actor: activity.actor,
    accepted: result.accepted,
  }));

  return res.status(result.accepted ? 202 : 400).json(result);
});

app.listen(3000);
```

---

## Future Work

1. **Following** - Subscribe to remote actors
2. **Discovery** - Find characters on other instances
3. **Conflict resolution** - Handle concurrent edits
4. **Cross-instance fork notification delivery** - POST Fork activities to source inbox
5. **Digest header verification** - Automatic body integrity checking in handleInbox
