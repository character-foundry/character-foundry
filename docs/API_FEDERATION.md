# CardsHub Federation API

This document details the ActivityPub-compatible federation routes implemented in `@character-foundry/federation`. These routes allow Character Cards to be discovered, exchanged, and synchronized across platforms (e.g., CardsHub, SillyTavern, Character Archive).

## Discovery Routes

### WebFinger
**Endpoint:** `GET /.well-known/webfinger`

Resolves a resource identifier (e.g., `acct:user@domain`) to an Actor profile URI.

**Query Parameters:**
- `resource` (required): The resource URI to query.

**Response:**
```json
{
  "subject": "acct:user@example.com",
  "aliases": ["https://example.com/api/federation/actor"],
  "links": [
    {
      "rel": "self",
      "type": "application/activity+json",
      "href": "https://example.com/api/federation/actor"
    }
  ]
}
```

### NodeInfo Discovery
**Endpoint:** `GET /.well-known/nodeinfo`

Provides links to the supported NodeInfo protocol versions.

**Response:**
```json
{
  "links": [
    {
      "rel": "http://nodeinfo.diaspora.foundation/ns/schema/2.1",
      "href": "https://example.com/api/federation/nodeinfo/2.1"
    }
  ]
}
```

### NodeInfo Data
**Endpoint:** `GET /api/federation/nodeinfo/2.1`

Returns server statistics and metadata (users, posts, software version).

## Actor Routes

### Actor Profile
**Endpoint:** `GET /api/federation/actor`

Returns the ActivityPub Actor object representing this instance or user.

**Response (JSON-LD):**
```json
{
  "@context": [
    "https://www.w3.org/ns/activitystreams",
    "https://w3id.org/security/v1"
  ],
  "id": "https://example.com/api/federation/actor",
  "type": "Application",
  "name": "CardsHub Instance",
  "preferredUsername": "cardshub",
  "inbox": "https://example.com/api/federation/inbox",
  "outbox": "https://example.com/api/federation/outbox",
  "publicKey": { ... }
}
```

## Activity Routes (Planned/WIP)

- **Inbox:** `POST /api/federation/inbox` - Receive activities (Follow, Create, Update).
- **Outbox:** `GET /api/federation/outbox` - List public activities.
- **Assets:** `GET /api/federation/assets/{id}` - Serve character card assets.
