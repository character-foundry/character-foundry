# Card content and lineage v1

Unreleased additive SDK contract for Unity, 2026-10-11. Existing `computeContentHash`
and `computeContentHashV2` retain their meanings. Consumers must persist algorithm
identifiers; hashes from different algorithms are not interchangeable.

## Three identities

1. **Original hash**: lowercase SHA-256 of exact accepted file bytes. Opening,
   publishing or exporting an untouched original does not alter those bytes or
   add lineage. Keep source provenance alongside an untouched original.
2. **Content identity**: `foundry-card-v1-sha256` over UTF-8 canonical portable
   content below. It is independent of container bytes and lineage metadata.
3. **Revision hash**: `foundry-revision-v1-sha256` over the canonical lineage body
   below. Equal content can have distinct revisions. Internal database UUIDs do
   not appear in cross-instance parent references.

These are integrity/provenance claims, not signatures or proof of authorship.
Access control and peer/author authentication belong to the host.

## Canonical JSON values

Input is an already parsed, plain JSON value. Duplicate source keys cannot be
recovered from such a value; applications needing raw-source validation must do
that before parsing. Objects are ordered by UTF-16 code units, including numeric
property names, using an explicit serializer rather than object insertion order.
Arrays retain order. Numbers use ECMAScript JSON serialization (`-0` becomes `0`);
non-finite numbers, undefined, sparse/decorated arrays, accessors, hidden/symbol
properties, class instances, cycles and lone surrogates are rejected. Unicode
normalization is not applied. The implementation follows the serialization rules
of [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785.html), with depth 64, 100,000
nodes and 4 Mi UTF-16 code units of serialized output as resource limits. It does
not accept JSON source text or claim duplicate-key detection after parsing.

## Portable card payload

Only wrapped `chara_card_v2`/`2.0` and `chara_card_v3`/`3.0` documents are accepted.
No lossy schema parser is applied. The canonical object is:

```text
{
  algorithm: "foundry-card-v1-sha256",
  data: <preserved inner data after the rules below>,
  envelope: <all unknown outer properties other than spec, spec_version, data>,
  assets: <pointer → lowercase verified SHA-256 digest>,
  portrait: <verified SHA-256 digest or null>
}
```

Absent name, description, personality, scenario, first_mes, mes_example,
creator_notes, system_prompt, post_history_instructions, creator and
character_version become empty strings. Absent alternate_greetings,
group_only_greetings, tags and assets become empty arrays. Absent extensions
become an empty object. Explicit null remains distinct, except extensions must
be an object and assets an array. No other missing/null/default equivalence is
inferred. All unknown portable fields, lorebook details and meaningful array
orders survive. Creation/modification timestamps remain content when present;
an exporter that synthesizes or changes them changes identity.

Only `data.extensions.foundry.lineage`, `data.extensions.foundry.local` and
`data.extensions.charx_media` are excluded. Other Foundry/third-party fields
remain; the Foundry object is omitted only when those removals leave it empty.
The latter two fields are explicitly classified as local state in this policy.
The same removals (except lineage) define `foundry-publish-v1`; sanitization
returns a copy and the removed paths. This limited policy is not a general
secret detector or a guarantee that every unknown extension is safe to publish.

## Asset binding

Each declared `data.assets[i].uri` requires a binding at `/assets/i/uri`, with a
digest verified from the actual asset bytes. Bindings use RFC 6901 pointers
relative to `data`, may additionally target URI strings under `extensions`, and
cannot target excluded metadata or prompt fields. The URI is replaced in the
canonical copy by `urn:sha256:<digest>`. The pointer/digest map is also included,
so declaring a binding cannot collide with an ordinary authored URI. Duplicate,
missing and non-string targets fail. There are at most 256 bindings. External
declared assets also require a digest; a URL alone is not immutable content.

An implicit primary PNG image may additionally use `portraitHash`. It must be a
digest of the host's extracted portrait bytes, not the whole character PNG (which
contains the card and would create self-reference). Hosts must define and retain
that extraction consistently across formats. Descriptor type/name/ext and unknown
fields remain meaningful. Converting descriptor shape or dropping unknown fields
can therefore change content identity even when the image bytes remain the same.

## Lineage

`data.extensions.foundry.lineage` has exactly these fields:

```text
version: 1
originalHash: <SHA-256 of the root accepted file>
content: { algorithm: "foundry-card-v1-sha256", hash: <SHA-256> }
parents: [ { revisionHash: <SHA-256>, content: <content identity> } ]
operation: "edit" | "fork"
author: <HTTP(S) or URN actor URI; no credentials>
createdAt: <canonical ISO timestamp>
nonce: <16–128 ASCII letters/digits/underscore/hyphen>
revisionHash: <SHA-256>
```

Hash the canonical object `{ algorithm: "foundry-revision-v1-sha256", lineage:
<all fields above except revisionHash> }`. The caller supplies timestamp and nonce
to make retries deterministic. Different nonces produce distinct revisions even
for the same content and author. Parent order is retained; at most 16 unique
parent revision hashes are accepted. Supplied parent records must have matching
revision digests and root original hashes. Existing input lineage must remain a
parent; removing a parent/root is not an incidental save operation. An initial
edit/fork from an untouched original may have no revision parent and keeps the
original hash as its root.

`readCardLineage` checks structure, while `verifyCardLineage` additionally checks
the current content and revision digests. Neither authenticates the author or
recursively fetches ancestors. `createCardRevision` copies inputs and writes a new
lineage only on explicit save/fork. Reads, hashing and sanitization never invent it.

## Preservation and limitations

The minimal card `{spec:"chara_card_v3",spec_version:"3.0",data:{name:"Aster"}}`
has content digest `c77f25b32b63189951ca162e4781166974d6f9aa14b87cc3cb89f09520a81f98`.
With original hash consisting of 64 `a` characters, no parents, operation `edit`,
author `urn:unity:user:aster`, timestamp `2026-10-11T12:00:00.000Z` and nonce
`0000000000000001`, its revision digest is
`0f41042272aa6491f7b777d1aef5c2e9b568d27d77f8647b19630eaf5ef5fe12`.
These vectors were independently generated with Python SHA-256/sorted-key JSON
and are asserted by the tests, alongside explicit canonical-string vectors.

Wrapped JSON, PNG and CharX can carry the namespace. The SDK integration tests
exercise those actual container primitives with opaque extension/lorebook fields
and an asset. Voxta and unlisted formats fail the lineage export guard. This is
not a blanket assertion that every exporter preserves every content field:
the default CharX descriptor generation discards unknown descriptor metadata,
and verification detects the stale lineage after that round trip. Use the additive
`preserveDescriptors: true` writer/exporter option to retain authored metadata
while relocating URI bindings; input assets must match descriptors positionally.
Hosts must reject such loss, preserve it through an improved exporter, or explicitly
create a transformed derivative with a new identity. Do not silently retain the
old identity after changing the payload. Actual SillyTavern interoperability and
full editor integration remain separate acceptance gates.

## Explicit SillyTavern transport profile

`prepareSillyTavernTransport` and `restoreSillyTavernTransport` are additive
helpers. They do **not** change `foundry-card-v1-sha256`, the lineage schema, or
existing hash APIs. An ordinary SillyTavern export with added envelope fields
still fails ordinary lineage verification.

The prepare helper first applies publication sanitization, verifies any existing
lineage and computes the existing content identity using the caller's verified
asset bindings. It writes a bounded `foundry-sillytavern-json-v1` marker at
`data.extensions.foundry.local.sillyTavernTransport`. This machine-local marker
contains the original content identity, existing revision hash (or null), and
which documented transport fields were absent. It contains no private original
metadata, saved prompt snapshot, asset bytes, or executable transformation.

Restoration is opt-in by the marker. It can remove only absent-at-export fields:
top-level `name`, `description`, `personality`, `scenario`, `first_mes`,
`mes_example`, `tags`, `talkativeness`, `fav`, `create_date`, and
`data.extensions.fav`. A returned mirror must exactly equal its current inner
data field; an added favorite flag must be false; an added date must be a canonical
ISO timestamp. Preexisting equal mirrors and false flags remain content. Other
fields are untouched. After removing additions and local metadata, the helper
requires the original content digest, exact revision hash and valid lineage.
It returns null for unmarked cards and rejects malformed markers or changed
content. It never creates, repairs or rewrites lineage. Markers/digests are
integrity metadata, not authenticated signatures.

Export rejects preexisting `chat`, `json_data`, or `create_date`, independent
outer mirror values and non-false favorite fields, since the observed application
would overwrite them. It does not normalize unknown timestamps or discard unknown
fields generally. Lost markers, meaningful edits, name sanitization, lost assets
and image recompression are not recovered. The caller must still verify actual
asset bytes and supported containers. A transport marker is not permission to
ignore asset identity or accept an external edit as its prior revision.

The observed field behavior comes from an actual JSON import/export against
SillyTavern `ad29cbda62e92f145e44d7a10398a38af22ca986`; future application changes
must pass the same final identity checks or fail explicitly. External application
and Unity flow evidence is tracked separately from the SDK's synthetic cases.

## Detached lineage records

`parseCardLineageRecord` returns an owned structural record.
`verifyCardLineageRecord` checks its revision digest. Neither validates historical
content/assets, ancestry or author authenticity; those require an enclosing
protocol such as [remote fork submission](sync-fork-v1.md).
