# Federation Package Documentation

The `@character-foundry/federation` package provides experimental ActivityPub-based federation for syncing character cards across platforms.

## Table of Contents

- [Overview](#overview)
- [Security Warning](#security-warning)
- [Enabling Federation](#enabling-federation)
- [Core Concepts](#core-concepts)
- [ActivityPub](#activitypub)
- [Sync Engine](#sync-engine)
- [Platform Adapters](#platform-adapters)
- [Routes](#routes)
- [Usage Examples](#usage-examples)

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

Federation features require explicit opt-in:

```typescript
import { enableFederation, isFederationEnabled } from '@character-foundry/federation';

// Option 1: Call enableFederation()
enableFederation();

// Option 2: Set environment variable
process.env.FEDERATION_ENABLED = 'true';

// Check if enabled
if (isFederationEnabled()) {
  // Safe to use federation features
}
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
type ActivityType = 'Create' | 'Update' | 'Delete' | 'Announce' | 'Like' | 'Undo';

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

## Implementation Status

| Feature | Status |
|---------|--------|
| ActivityPub object creation | ✅ Implemented |
| WebFinger handler | ✅ Implemented |
| NodeInfo handler | ✅ Implemented |
| Actor endpoint | ✅ Implemented |
| HTTP Signatures | ❌ Stub only |
| Inbox handling | ❌ Stub only |
| Following/Followers | ❌ Not implemented |
| Boost/Like | ✅ Activity creation only |

---

## Future Work

1. **HTTP Signatures** - Verify incoming requests
2. **Inbox processing** - Handle incoming activities
3. **Following** - Subscribe to remote actors
4. **Discovery** - Find characters on other instances
5. **Conflict resolution** - Handle concurrent edits
