# Code Review: Character Foundry Project
**Date:** December 9, 2025  
**Reviewer:** Gemini Agent  
**Context:** Comprehensive Monorepo Analysis (PM & User Perspective)

---

## 1. Executive Summary

**Overall Health Grade: B+**

The `character-foundry` codebase is structurally sound, leveraging modern TypeScript monorepo practices (pnpm workspaces, turbo) effectively. It enforces strict typing and separates concerns logically across packages (`loader`, `normalizer`, `exporter`).

However, from a Project Management and End-User perspective, the current build exhibits classic "growing pains." It relies on brittle manual implementations for standard tasks (file detection) and centralized "God Objects" (the Loader) that will increase maintenance costs as feature requests grow.

**Critical Risks:**
*   **Scalability:** The current in-memory processing model limits the application's ability to handle large archives (CharX/Voxta) on resource-constrained devices (mobile/browser).
*   **Maintainability:** Adding support for new card formats requires modifying core files, risking regression in existing features.
*   **Security:** The `federation` module contains unimplemented security stubs, posing a risk if accidentally enabled in production.

---

## 2. Strategic Recommendations (Architecture)

### A. Decouple the Loader (High Priority)
**Current State:** `packages/loader/src/loader.ts` acts as a central switch statement, hardcoding logic for every supported format.
**Risk:** High coupling. To add a new format, developers must modify the core orchestration logic, increasing the chance of breaking existing import flows.
**Recommendation:** Implement a **Strategy Pattern**.
*   Define a standard `CardLoaderStrategy` interface (e.g., `canHandle(file): boolean`, `parse(file): ParseResult`).
*   Refactor the Loader to iterate through a registry of strategies.
*   **Benefit:** New formats can be added as isolated plugins without touching the core loader code.

### B. Centralize Asset Management
**Current State:** Logic for handling assets (validation, base64 decoding, size checking) is duplicated across `loader`, `charx`, and `png`.
**Risk:** Inconsistent behavior. A user might successfully load an asset in a PNG that would be rejected by the CharX parser due to slightly different implementation of size limits.
**Recommendation:** Create a dedicated `AssetManager` service in `@character-foundry/core`.
*   Standardize the `Asset` interface.
*   Centralize security policies (max size, allowed mime types).
*   **Benefit:** Uniform security and validation across all import methods.

### C. Federation: Archive or Audit
**Current State:** The `@character-foundry/federation` package is a prototype with critical security features (HTTP signature validation) explicitly stubbed out to throw errors.
**Risk:** False sense of capability and potential security hole if enabled.
**Recommendation:** If resources are not allocated to complete ActivityPub security by Q1 2026, move this package to an `experimental` directory outside the main workspace build path. This improves CI/CD times and clarity.

---

## 3. Tactical Recommendations (Code Level)

### A. Adopt Standard Libraries for File Detection
**Current State:** `loader.ts` uses manual "magic number" byte inspection (e.g., `if (buffer[0] === 0x89...)`) to detect file types.
**Recommendation:** Replace custom logic with the industry-standard `file-type` library.
*   **Why:** The current manual implementation covers only basic happy-paths. It will likely fail on edge cases (e.g., newer WebP containers, different MP4 atoms) that established libraries already handle robustly.

### B. Automate Validation with Zod
**Current State:** TypeScript interfaces (e.g., `CCv3Data`) exist, but runtime validation likely relies on basic JSON parsing or manual checks.
**Recommendation:** Adopt **Zod** for schema definition.
*   Define schemas once: `const CCv3Schema = z.object({...})`.
*   Infer types: `type CCv3Data = z.infer<typeof CCv3Schema>`.
*   **Benefit:** Eliminates "silent failures" where invalid JSON structures crash the app deep in the normalization pipeline. Provides distinct, user-readable error messages for malformed cards.

### C. Declarative Normalization
**Current State:** `v2-to-v3.ts` is a procedural mapping script.
**Recommendation:** As the complexity of mappings grows, refactor to a configuration-based approach.
*   **Benefit:** Allows non-engineers (e.g., product owners) to adjust field mappings between format versions without writing code.

---

## 4. User Experience & Performance

### A. Memory Consumption (Streaming)
**Observation:** The application reads full files into memory buffers (`BinaryData`).
**User Impact:** Loading a 500MB+ `.charx` or `.voxta` archive on a mobile device or low-memory browser tab will likely cause a crash (OOM).
**Recommendation:** Investigate **Streaming APIs** for archive extraction.
*   Only extract `card.json` and necessary assets to memory.
*   Stream large assets (audio/video) directly to storage or blobs without holding the full archive in RAM.

### B. Error Messaging
**Observation:** The `FoundryError` hierarchy is excellent.
**Recommendation:** Ensure the UI layer consumes `FoundryError.code` to show localized, friendly messages.
*   *Bad:* "JSON Parse Error at line 1."
*   *Good:* "The card file is corrupted. (Error: INVALID_JSON)"

---

## 5. Summary of Action Items

1.  **Refactor:** Replace magic number detection in `loader.ts` with `file-type` package.
2.  **Refactor:** Define `CCv3` and `Asset` schemas using Zod in `@character-foundry/schemas`.
3.  **Architecture:** Create `AssetManager` in `core` to unify asset limits and handling.
4.  **Process:** Remove or mark `@character-foundry/federation` as strictly experimental/internal.

---

## 6. Addendum — Security & Robustness (Dec 9, 2025)

- **Zip bomb / memory DoS (Critical):** CharX and Voxta readers fully unzip archives before enforcing limits (`packages/charx/src/reader.ts`, `packages/voxta/src/reader.ts`). A small compressed / huge uncompressed file can OOM or hang the process. Mitigate by streaming unzip or preflighting central directory sizes, capping per-entry and total uncompressed bytes, and rejecting zip64 unless explicitly allowed.
- **PNG zTXt inflation (High):** `inflateSync` on zTXt chunks has no decompressed-size ceiling (`packages/png/src/parser.ts`). A tiny compressed payload can expand far beyond the 50 MB card ceiling. Add a hard cap (≤50 MB, ideally 8–16 MB for card JSON) and fail with `SizeLimitError` when exceeded.
- **Remote asset fetching policy (Medium):** `readCharXAsync` will fetch arbitrary http/https assets when `fetchRemoteAssets` is true, with no enforced byte/timeout/host limits (`packages/charx/src/reader.ts`). Keep default off; when enabled, require caller-supplied policy (max bytes, timeout, allowed hosts/schemes, concurrency) and enforce streaming size checks.
- **Federation enablement & IDs (Medium):** `validateActivitySignature` is stubbed; `FEDERATION_ENABLED=true` alone can turn on the package (`packages/federation/src/index.ts`). Require dual opt-in (env + `enableFederation()`), emit loud warnings while signatures are unimplemented, and switch `generateActivityId` from `Math.random()` to crypto-grade randomness to avoid predictable IDs in multi-instance tests.
- **Priorities vs. earlier report:** File-type detection refactor is less urgent than closing unzip/inflate DoS vectors. Asset-manager centralization is still useful, but immediate wins come from enforcing size caps during unzip/inflate/fetch.
