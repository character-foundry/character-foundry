# AGENTS.md — @character-foundry/federation

## Purpose

Sync card state between Architect, Hub, and Archive using ActivityPub-shaped messages.

**Status:** Phase 2+ (not MVP)

---

## Scope

```
Card Architect (Editor)
       ↕ webhook
    CardsHub (Hub)
       ↕ webhook
Character Archive (Library)
```

---

## Activity Types

```typescript
interface CardActivity {
  "@context": "https://www.w3.org/ns/activitystreams";
  type: "Create" | "Update" | "Delete" | "Announce";
  actor: string;           // App or user URI
  object: FederatedCard;
  published: string;       // ISO 8601
  signature?: string;      // HMAC (Phase 1) or HTTP Sig (Phase 3)
}

interface FederatedCard {
  type: "CharacterCard";
  id: string;              // Master UUID v4
  version: number;         // Incrementing version
  contentHash: string;     // SHA256 of card content
  spec: "v2" | "v3";
  assetManifest: AssetRef[];
}
```

---

## Transport Phases

| Phase | Transport | Auth |
|-------|-----------|------|
| 1 | Webhooks | HMAC signature |
| 2 | Webhooks + API | API keys |
| 3 | Full ActivityPub | HTTP Signatures |

---

## Deployment Tracking

```typescript
interface DeploymentStatus {
  target: "chub" | "wyvern" | "risuai" | "cardshub" | "archive";
  externalId?: string;
  externalUrl?: string;
  status: "pending" | "published" | "failed" | "outdated";
  lastSync: string;
}

// Track where a card has been published
// Detect when local version is newer than remote
```

---

## Master Card Concept

Architect generates canonical UUID. All deployments reference this UUID.

```typescript
// Card Architect creates master
const masterCard = {
  id: randomUUID(),        // Canonical ID
  version: 1,
  // ...
};

// Deployments reference master
deployment.masterId = masterCard.id;
deployment.target = 'cardshub';
deployment.externalId = 'cardshub-specific-id';
```

---

## Dependencies

- `@character-foundry/core`
- `@character-foundry/schemas`

---

## Testing Focus

- Activity serialization/deserialization
- HMAC signature verification
- Version conflict detection
- Deployment status tracking
