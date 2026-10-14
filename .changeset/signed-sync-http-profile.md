---
"@character-foundry/character-foundry": minor
---

Add an unreleased `/sync` HTTP Message Signatures profile using Ed25519, mandatory
signed body digests, exact actor/key binding, bounded freshness and host-injected
atomic replay admission. Include independent transport vectors and a contract
that separates signature verification from application authorization and durable
mutation idempotency. Existing federation and hash APIs retain their behavior.
