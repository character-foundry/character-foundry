---
"@character-foundry/character-foundry": minor
---

Add an unreleased publication-read protocol and signed client to `/sync`, with
capability negotiation, bounded selection pages, portable asset manifests,
identity/lineage verification and exact asset hash checks. The client refuses
redirects and ambient credentials, bounds streaming responses and supports
cancellation. Read capabilities do not advertise mutation endpoints.
