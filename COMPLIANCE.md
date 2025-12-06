# COMPLIANCE RULES FOR AI AGENTS

**CRITICAL:** You are working in a strict ecosystem. Deviating from these rules causes system-wide failure.

## 1. Federation Routes (Zero-Negotiation)
**DO NOT** hardcode API routes for federation.
**DO** import `FederationRoutes` from `@character-foundry/federation`.

| Constant | Value | Usage |
| :--- | :--- | :--- |
| `FederationRoutes.DISCOVERY.WEBFINGER` | `/.well-known/webfinger` | Discovery |
| `FederationRoutes.API.ACTOR` | `/api/federation/actor` | Identity |
| `FederationRoutes.API.INBOX` | `/api/federation/inbox` | Receiving Activities |
| `FederationRoutes.API.OUTBOX` | `/api/federation/outbox` | Publishing Activities |

## 2. Package Usage
**DO NOT** use internal/legacy packages (`@card-architect/*`).
**DO** use only `@character-foundry/*` packages.

## 3. Data Integrity
**DO NOT** mutate source data during import.
**DO** use `loader.parseCard()` which returns `rawBuffer` for bit-perfect preservation.

## 4. File Structure
**DO NOT** create new directories for known types.
**DO** follow the monorepo structure: `packages/{feature}/src`.

**VIOLATION OF THESE RULES WILL RESULT IN BROKEN SYNCHRONIZATION.**
