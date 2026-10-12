# Signed publication commands v1 (unreleased draft)

`@character-foundry/character-foundry/sync` exports the portable command schemas,
codec and client. This profile uses `foundry-sync-v1` HTTP signatures and is
separate from `foundry.sync.read.v1`. Hosts opt into writes and provision explicit
`publish` or `fork` peer scopes; enabling reads does not enable writes.

## Operations

All fields below are required; unknown fields are rejected. JSON uses UTF-8 and
is at most 64 KiB. IDs are 1–128 ASCII letters/digits/underscore/hyphen, beginning
with a letter/digit. Canonical serialization comes from Foundry's identity JSON
primitive. The ordered selected revision IDs affect the operation fingerprint.

`POST BASE/commands/publish` accepts:

```json
{"version":"foundry.sync.command.v1","operation":"publications.publish","revisionIds":["revision-id"],"policy":{"visibility":"members","allowFork":true}}
```

Select 1–20 distinct revisions already in the peer's locally granted workspace.
Visibility is `private`, `members` or `public`. The host selects the account,
workspace and author from the grant, verifies every selected revision and asset,
and disables accepted-original downloads. This is publication of host-resident
revisions; it is not a remote card upload. A successful receipt contains exactly
one publication reference per selected revision, in selection order:

```json
{"version":"foundry.sync.command.v1","operation":"publications.publish","requestId":"43-character-sync-token","publications":[{"id":"publication-id","policyVersion":1}]}
```

`POST BASE/commands/fork` accepts:

```json
{"version":"foundry.sync.command.v1","operation":"publications.fork","publicationId":"publication-id"}
```

The host checks current publication and ancestor visibility and fork permission,
verifies and copies the public snapshot/assets into the granted workspace, and
adds fork lineage under the mapped local account. It never attributes the fork
to an arbitrary incoming embedded author. The receipt contains only the newly
created private resource references, visible to this authorized peer:

```json
{"version":"foundry.sync.command.v1","operation":"publications.fork","requestId":"43-character-sync-token","cardId":"card-id","revisionId":"revision-id"}
```

`GET BASE/command-capabilities` uses the read `pull` scope and returns
`syncCommandCapabilities()` only when writes are enabled. A peer granted only
`publish`/`fork` can execute its known operation without this discovery read.
The read capabilities remain unchanged and do not advertise command support.

## Authentication and recovery

A signed POST binds the exact target, method, content type, body digest, actor,
key, fresh nonce and explicit operation ID. Authenticate bounded bytes before
JSON decoding. The URL selects the required scope; the body operation must match.
Caller-selected account/workspace/context and ambient browser credentials are
forbidden. Current grants and source policy are rechecked at commit time.

Hosts atomically commit domain writes and a receipt bound to actor, operation ID,
request fingerprint and operation kind. A fresh signed retry with the same ID and
bytes returns the original references without duplicate publication/fork writes.
A source policy change during an operation fails with `CHANGED` (HTTP 412).
A changed request using that ID fails with `OPERATION_CONFLICT` (HTTP 409). Policy
version 1 describes creation, not current policy. Receipt lookup must still check
current permission; a historical receipt does not authorize access after revocation.

The client requires a caller-persisted operation ID (`createSyncToken()`) and never
automatically retries. Save the ID and command before sending. On lost responses,
network errors, cancellation or timeout, the operation may already have committed:
retry with the same ID and command, a fresh nonce and an active key. Do not choose
a new ID just because the response was lost. Resource failures use bounded generic
errors; response traces are not exposed. Successful responses use HTTP 200 JSON,
no-store caching, HTTPS authentication, and no redirects. Receipts are not signed.

The client bounds responses, validates version/operation/request ID and result
shape/cardinality, and omits browser credentials. It does not independently prove
remote persistence; that is a host transaction guarantee. Downloaded publication
identity and assets should subsequently be verified with the read client.

The [fork submission extension](sync-fork-v1.md) adds a bounded binary upload
through `forks.submit` and `createSyncCommandClient().submitFork`. Its receipts use
the same command version and fork-reference shape. Remote pull/edit UI, public
actor provisioning, resumable staging and a complete independent-instance workflow
remain application work.
