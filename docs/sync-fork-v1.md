# Remote fork submission v1 (unreleased draft)

The public `/sync` export adds `encodeSyncForkSubmission`,
`decodeSyncForkSubmission`, `verifySyncForkSubmission` and
`createSyncCommandClient().submitFork(bytes, requestId, signal?)`.
This extends command v1 with `forks.submit`; JSON publish/fork commands retain their
existing schema. The receiver requires explicit write opt-in and `fork` scope.

## Frame and bounds

`POST BASE/commands/submit-fork/PUBLICATION_ID` carries a signed
`application/octet-stream` body. It consists of, in order:

1. The literal ASCII bytes `foundry.sync.fork.v1` followed by LF.
2. One unsigned 32-bit big-endian metadata-byte length.
3. Exactly that many UTF-8 bytes containing canonical JSON metadata.
4. Raw asset bytes concatenated in metadata array order, with no padding/trailer.

The complete frame is at most 8 MiB; metadata at most 512 KiB. The card document
retains the read profile's 256 KiB limit and 64-asset limit. Metadata has exactly
these fields:

- `version`: `foundry.sync.fork.v1`.
- `publicationId`: the selected parent, matching the route ID.
- `baseIdentity`: the selected parent's algorithm/hash.
- `originalHash`: that publication's accepted-original root claim.
- `document` and `identity`: the returned final card and its verified content identity.
- `ancestry`: at most 32 complete lineage records, oldest first, excluding the
  selected parent's record and the final record embedded in `document`.
- `assets`: read-profile asset manifests with portable bindings. Each has a hash,
  length, media type and logical path. All bytes must be present in the frame.

Unknown fields, noncanonical metadata, mismatched lengths/hashes, truncation,
trailing bytes and unavailable asset references fail. There are no remotely fetched
asset URLs. Encoders/decoders own their input snapshots; callers cannot change
pending verification through a reused buffer. The in-memory bundle limit is
intentional; larger transfers require a future staged/streamed upload profile,
not dropped assets or unbounded buffering.

## Parent, content and attribution checks

The receiver retrieves the current permitted parent locally, verifies its identity,
and compares its ID, root and content identity to the submission. It verifies the
final card's identity and embedded lineage with all incoming asset bindings, and
hashes every asset's actual bytes. A receiver must reject machine-local state from
the portable document rather than publishing it by accident.

The ancestry plus final record must be one connected linear chain. The first new
record must be a `fork`; every subsequent record is an explicit edit/fork. Every
new record's author must exactly equal the authenticated, operator-pinned HTTPS
peer actor. Each record has the same original root and exactly one preceding
revision/content parent, or no parent only for the first fork of an unlineaged
publication. Repeated records, invented parent links, merges without proof and
records attributed to a different actor fail. The selected original's existing
author is not relabelled as the sender.

For an unlineaged original, the explicit publication ID and base identity bind the
fork to the selected source; the original remains unmodified. The original-root
claim is inherited from that authorized source. Record digest checks prove chain
consistency; they do not prove historical intermediate asset bytes or events.
The sender's signature attests its submitted chain, not other authors' claims.

Identity additionally exports `parseCardLineageRecord` and
`verifyCardLineageRecord`. These verify owned structure/revision digests only;
callers must separately verify content, ancestry and author authorization.

## Acceptance and retries

The receiver creates a **private workspace draft**, preserving its complete final
lineage and recording the mapped local account as the responsible store account.
It must not rewrite the remote lineage author to that account. It preserves the
exact accepted frame separately from the inherited original-root hash. Unity maps
portable bindings into its own revision-asset paths; logical transport paths are
not database or filesystem paths.

All assets must finish and verify before a guarded atomic fork commit. The same
transaction checks current peer/key/account/workspace/scope and current parent
fork policy and commits card/revision/asset references plus the immutable receipt.
Publication remains a separate explicit `publications.publish` selection.

The HTTP 200 receipt uses command v1 with operation `forks.submit`, the signed
request ID, card ID and revision ID. Retry with the same persisted frame and ID,
a fresh signature and an active key. A committed retry returns the same references
without new staging; changed bytes/kind reusing an ID conflict. Current permission
is required for receipt recovery. Interrupted precommit staging may leave unlinked
objects for operator cleanup; no successful receipt exists until commit.

Clients do not automatically retry, infer a parent, repair lineage, or sign on
behalf of another author. Accounts created with local-only URNs need an explicit
public actor strategy before their edits can be returned under an HTTPS peer key.
Remote pull UI, account public-actor provisioning, multipart/resumable staging and
a complete independent-instance editing rehearsal remain application work.
