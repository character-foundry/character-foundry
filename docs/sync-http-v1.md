# Foundry signed HTTP sync profile v1

Status: **unreleased transport draft**. The public development entrypoint is
`@character-foundry/character-foundry/sync`. This defines authentication of exact
HTTP request bytes for the proposed sync protocol. It does not yet define a
complete publish/pull/fork API, key-discovery service or server authorization
policy. Existing ActivityPub and draft-Cavage signing APIs remain unchanged.

The profile uses [RFC 9421 HTTP Message Signatures](https://www.rfc-editor.org/rfc/rfc9421.html)
with Ed25519 and [RFC 9530 Content-Digest](https://www.rfc-editor.org/rfc/rfc9530.html)
with SHA-256. It deliberately accepts one bounded serialization of those fields,
not every form those standards permit. Hosts must not route other signature
profiles into this verifier or silently fall back to the legacy verifier.

## Covered request

`signSyncHttp` accepts GET or POST, a canonical absolute HTTPS target URI, owned
input bytes, `application/json` or `application/octet-stream`, an actor/key ID,
an Ed25519 signing key and a logical operation ID. It returns method, URL, owned
headers and owned bytes. It never calls fetch, follows redirects or discovers keys.
GET has an empty body; its empty-body digest is still required. Content encoding
is rejected. Bodies are limited to 32 MiB, URLs to 4096 characters and actor URLs
to 1024 characters. Hosts must also bound the incoming stream before buffering it.

A single signature label, `foundry`, covers these components in exactly this order:

1. `@method`
2. `@target-uri`, including the complete query string
3. `content-digest`
4. `content-type`
5. `foundry-sync-actor`
6. `idempotency-key`

The signature parameters, in order, are `created`, `expires`, `nonce`, `keyid`,
`alg="ed25519"` and `tag="foundry-sync-v1"`. They are themselves signed through
the signature-parameters component. There is no trailing newline in the signature
base. The committed fixture contains every exact byte, header and signature.

Times are integer Unix seconds. Signatures last 1–300 seconds. Verification allows
at most 30 seconds of clock skew at either boundary. Missing, duplicated, extra,
reordered or alternate signature parameters/components are rejected by this
profile, as are malformed or noncanonical base64 values. Duplicate field values
combined by a standard Headers implementation do not become valid signatures.

Nonce and operation IDs are canonical unpadded base64url encodings of 32 bytes.
`createSyncToken()` produces one using Web Crypto randomness. A new request must
have a fresh nonce. A deliberate retry of the same logical operation reuses its
operation ID but gets a fresh nonce and signature.

URLs must already equal their WHATWG URL serialization. Credentials, fragments,
non-HTTPS URLs and alternate spellings such as explicit default ports are refused.
An actor has no query or fragment. Its key ID is exactly that actor URL followed
by `#` and a 1–80 character identifier using letters, digits, dot, underscore or
hyphen. Similar prefixes do not establish an actor/key relationship.

## Verification and host responsibilities

`verifySyncHttp` snapshots method, target, headers and bytes before its first
asynchronous operation. It validates the profile, time window and actual body
digest, resolves the pinned actor/key pair, verifies the signature and finally
calls the mandatory `consumeNonce` callback. Only then does it return verified,
owned bytes. Process those returned bytes; do not re-read an unverified input or
fetch a replacement document afterward.

`resolveKey(actor, keyId)` is host-injected. It must use an operator-approved trust
store and return the exact actor, exact key ID and public Ed25519 CryptoKey. A key
URL is an identifier, not permission to fetch it. No request parameter, embedded
public key, DNS redirect or untrusted actor document creates trust. Key management,
rotation, compromise handling and transport-to-local-account mapping belong in
the application. A transport signature authenticates the sending actor; it does
not prove ownership of every author name or lineage claim inside a card.

`consumeNonce(claim)` must atomically insert a unique `(actor, nonce)` claim and
return false when it already exists. Check-then-insert, per-process maps and
short-lived caches do not provide durable multi-worker replay defense. The key ID
is recorded but must not partition nonce uniqueness: rotation must not permit
nonce reuse. Keep the claim **through** `retainUntil` (signature expiration plus
skew); a cleanup job may delete only claims strictly older than its trusted clock.
Storage failures must propagate, never be converted to successful admission.

Key trust can change during verification or an upload. Applications must recheck
active key/account/scope/policy at their mutation's atomic commit boundary, along
with the operation receipt. The SDK callback contract does not implement or prove
the durability, atomicity, lifecycle or authorization of the application's store.
The repository test map is only a test double for that callback.

The returned `requestHash` is SHA-256 hex of the UTF-8 JSON array:

```text
["foundry-sync-v1", actor, method, targetUri, contentType, contentDigest]
```

This binds a logical operation to its exact target and bytes, independently of
signing-key rotation, nonce and time. It is not character content identity or a
lineage hash. Applications must store `(actor, requestId, requestHash)` with the
mutation/result in one atomic transaction. A repeated ID with different content
must fail. Retries with the same operation ID must not duplicate a committed
mutation; interrupted operations need explicit pending/recovery semantics. Do
not cache private response bytes past a permission change: reauthorize before
serving any stored result. Nonce admission alone is not mutation idempotency.

Hosts also own body limits/timeouts, endpoint/method allowlists, resource scopes,
peer admission/revocation and safe outbound connection policy. For a proxy,
reconstruct the target only from trusted host configuration and the actual path;
caller-supplied forwarded headers must not choose the signed target. Signatures
do not replace HTTPS. Responses rely on authenticated HTTPS transport; response
signing is outside this draft.

## Evidence and remaining work

Eight tests cover an independently assembled Node-crypto vector, signed-component
and body tampering, recomputed unsigned digests, missing/duplicate/extra fields,
algorithm/profile downgrade, actor/key confusion, expiration/skew boundaries,
concurrent replay admission, fresh retry identity, input mutation across awaits,
empty GETs, bounds and canonical URL rejection. The committed test key is a
synthetic public fixture, never an operational credential.

The public ESM/CJS entrypoints and real local workerd consumer must pass before
Unity updates its SDK pin. Durable SQLite/D1 nonce admission and atomic mutation
receipts, peer provisioning/scopes, full capability/operation schemas, endpoint
integration, publish/pull/fork listing and two-instance interoperability remain
application/protocol work. This primitive is not a claim of working federation
or a released stable public wire contract.
