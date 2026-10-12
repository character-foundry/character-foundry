# Publication read protocol v1 (unreleased draft)

This additive contract is exposed through `@character-foundry/character-foundry/sync`.
It uses the [signed HTTP transport](sync-http-v1.md). It is a read surface, not a
claim that enriched-card return, publication writes or federation interoperability
are complete. Legacy ActivityPub and hash APIs are unchanged.

An operator supplies one exact HTTPS API base, without a trailing slash, query,
fragment or credentials, and a trusted actor/key pair. There is no discovery.
All requests below are signed GETs with an empty body, `application/json` request
media type, fresh nonce and operation ID. Hosts require the local `pull` grant,
perform durable replay admission, and recheck the key/account/grant before returning
protected data. A signature alone does not grant publication access.

| Suffix under the configured base | Result |
| --- | --- |
| `/capabilities` | `SyncReadCapabilities` |
| `/publications?limit=20&after=ID&parent=ID` | `SyncReadPage`; all query fields optional |
| `/publications/ID` | `{ version: "foundry.sync.read.v1", publication: SyncReadPublication }` |
| `/publications/ID/asset?path=PATH&policyVersion=N` | Exact manifest bytes with their declared media type |

The source interfaces and runtime parsers in `packages/federation/src/sync-read.ts`
are the field definitions. Protocol objects reject missing/unknown fields. Card
documents retain all JSON fields, including opaque extensions, and use Foundry's
canonical JSON validation. IDs/cursors are 1–128 ASCII letters/digits, underscores
or hyphens, starting with a letter/digit. Query keys are single-valued. Pages use
strictly increasing opaque IDs, at most 20 items, and a cursor equal to the final
visible ID. A full final page may lead to an empty continuation. Ordering is stable;
this is a live catalog, not a frozen snapshot across policy changes or insertions.
A `parent` filter lists direct published forks, subject to current parent/ancestor
visibility. Filtering happens before pagination and must reveal no hidden counts.

Capabilities identify `foundry.sync.read.v1`, transport `foundry-sync-v1`, and the
three implemented operations in declared order: `publications.list`,
`publications.get`, `assets.get`. A host may reduce the advertised numeric limits:
20 items/page, 256 KiB/card document, 32 MiB/asset and 64 assets/publication. JSON
responses are bounded at 8 MiB. No write capability is implied or advertised.

A publication carries its opaque ID, sanitized card document, content identity,
original root hash, optional parent publication ID, canonical UTC publication date,
current policy version/visibility/fork flag, and an asset manifest. It excludes
local workspace/revision IDs, owner database IDs, original container/provenance,
storage keys and account credentials. The root hash without verifiable lineage
remains the trusted publisher's provenance claim; it cannot be reconstructed from
a sanitized snapshot. Embedded lineage does not authenticate every historical author.

Each manifest entry binds one logical relative path to a byte hash, byte length,
bare lowercase media type, and either the portrait or `/assets/N/uri` identity
binding. Paths and bindings are unique. No manifest entry instructs a client to
fetch a card-authored external URL. The client validates content identity and any
lineage before returning a publication, and checks exact length/SHA-256 before
returning downloaded bytes. Asset reads pin the observed publication policy
version; changed policy returns 409 rather than silently treating an old manifest
as current authorization. All ancestor visibility restrictions still apply.

The supplied fetch implementation is a trusted I/O boundary. The default client
uses `redirect: manual`, `credentials: omit`, no cookie/auth headers, bounded
stream reads and a 30-second timeout (configurable 1–120,000 ms), and cancellation.
Redirects, changed response URLs, substituted resource IDs, invalid UTF-8/JSON,
invalid identity/lineage, oversized bodies and mismatched bytes fail. It does not
retry automatically or cache capabilities/results across authorization changes.
TLS authenticates responses; this draft does not define response message signatures.
Hosts integrating server-selected destination URLs still own outbound network policy.

Successful reads return 200 with JSON or the exact asset media type. Hosts use
non-cacheable responses and machine-readable error envelopes:
`{ version: "foundry.sync.read.v1", error: { code, message } }`. Statuses are 400
invalid request, 401 signature/replay/admission failure, 403 forbidden, 404 absent
or hidden publication/asset, 409 changed policy, 413 byte limit, 429 rate limit,
and 503 unavailable. The client maps statuses without displaying an untrusted
server message. It never falls back to unsigned/legacy requests.

Before enabling a host, verify actual SDK clients across its runtime and database
adapters, current-policy and revocation races, exact manifest bytes and blocked
redirect/tamper/replay paths. These reads alone do not prove a two-instance
publish → pull → enriched fork return workflow; that remains a separate gate.
