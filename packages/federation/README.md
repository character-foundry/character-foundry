# @character-foundry/federation

ActivityPub federation and HTTP signatures for AI character cards (experimental).

## Installation

```bash
npm install @character-foundry/federation
```

## Features

- **ActivityPub** - WebFinger, NodeInfo, Actor endpoints
- **HTTP Signatures** - Request signing and verification
- **D1 Storage** - Cloudflare D1 sync state store
- **Gated by default** - Must explicitly enable

## Quick Start

```typescript
import {
  enableFederation,
  createActor,
  signRequest,
  verifySignature,
  D1SyncStateStore,
} from '@character-foundry/federation';

// Enable federation (required)
enableFederation();

// Create ActivityPub actor
const actor = createActor({
  id: 'https://example.com/users/alice',
  name: 'Alice',
  preferredUsername: 'alice',
});

// Sign outgoing request
const signedHeaders = await signRequest(request, privateKey, keyId);

// Verify incoming request
const isValid = await verifySignature(request, publicKey);

// D1 storage for Cloudflare Workers
const store = new D1SyncStateStore(env.DB);
await store.init();
```

## Security

- Gated by default - must call `enableFederation()`
- HTTP signature strict mode (opt-in)
- SSRF protection for resource IDs
- Sync mutex prevents concurrent operations

## Documentation

See [docs/federation.md](../../docs/federation.md) for full API documentation.

## License

MIT
