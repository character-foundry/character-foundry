# Dependency Upgrade Log

**Date:** 2026-09-10  |  **Project:** Character Foundry  |  **Scope:** security and maintenance refresh

## Summary

- Updated the ZIP/image runtime dependencies used by published packages.
- Updated the test/build toolchain to versions compatible with the current Node 24 CI runtime.
- Pinned each dependency changed by this refresh to the tested version.
- Deferred cross-major upgrades for pnpm, Changesets, ESLint, TypeScript, and Vite because they require a separate compatibility pass.

## Updates

### Runtime and test dependencies

| Dependency | Previous | Tested version | Reason |
|---|---:|---:|---|
| `fflate` | 0.8.0–0.8.2 | 0.8.3 | Fixes malformed ZIP64 extra-field handling and improves ZIP64 support. See the [0.8.3 release notes](https://github.com/101arrowz/fflate/releases/tag/v0.8.3). |
| `sharp` | 0.33.x | 0.35.4 | Includes the patched libheif dependency for the [current sharp advisory](https://github.com/advisories/GHSA-rgj7-g3m4-5g8c). This release requires Node >=20.9.0. |
| `vitest` | 1.x–2.x | 4.1.11 | Removes the known test-runner vulnerability paths and aligns all workspace tests. |
| `happy-dom` | 15.x | 20.14.3 | Updates the browser test environment required by Vitest 4. |
| `vite` | transitive | 6.4.3 | Provides the Vite peer required by Vitest 4. |
| `eslint` / `@eslint/js` | 9.39.2 | 9.39.5 | Refreshes the existing ESLint 9 line. |
| `typescript-eslint` | 8.50.0 | 8.70.0 | Refreshes the existing TypeScript-ESLint 8 line. |
| `turbo` | 2.6.3 resolved | 2.10.12 | Updates the existing Turbo 2 line. |

## Compatibility notes

- CI now runs on Node 24.19.0, matching the repository's publish workflow and the updated image dependency requirement. The workspace development runtime is Node >=20.9.0.
- `sharp` remains optional. Browser thumbnail generation is unaffected; Node thumbnail generation requires a compatible `sharp` installation.
- pnpm 10/11 migration, Changesets 3, ESLint 10, TypeScript 7, and broader developer-tool remediation are intentionally deferred to avoid mixing toolchain migrations into this patch.

## Validation

Final validation:

- `pnpm install --frozen-lockfile` passed.
- `pnpm lint` passed.
- `pnpm typecheck` passed (25/25 tasks).
- `pnpm test` passed (31/31 tasks).
- `pnpm build` passed (16/16 tasks).
- `pnpm verify-build` passed (26 ESM/CJS import checks).
- `sharp 0.35.4` Node smoke test passed by resizing a 1x1 PNG to WebP.
- `pnpm audit --prod` reports 0 vulnerabilities across 62 production/optional dependencies.
- Full audit still reports 8 moderate and 19 high advisories in development-tool transitive dependencies; these are documented for a separate toolchain remediation pass rather than forced through unbounded overrides.
