# Work In Progress (WIP)

## Current Status: CI/CD Pipeline

We are establishing a CI/CD pipeline to make `@character-foundry` packages available for downstream applications like `cardshub` in Cloudflare CI.

### ✅ Completed
- **Tokenizers:** Created `@character-foundry/tokenizers` (GPT-4/LLaMA support).
- **Voxta:** Fixed Lorebook export (multi-asset package) and metadata preservation.
- **Loader:** Fixed asset extension detection (magic numbers).
- **Federation:** Implemented discovery routes (WebFinger, NodeInfo, Actor).
- **Documentation:** Cleaned up root, moved docs to `docs/internal/`, added `API_FEDERATION.md`.
- **CI Setup:** Added `.github/workflows/publish.yml` to publish packages to GitHub Packages registry.
- **Package Config:** Updated all `package.json` files to publish to `https://npm.pkg.github.com`.

### 🚧 Next Steps
1.  **Trigger Release:** Manually trigger the `Publish Packages` workflow in GitHub Actions to publish the first versions (0.0.1/0.1.0).
2.  **Configure Cardshub:**
    - Update `cardshub` (and `card_doctor`) to use an `.npmrc` file with `@character-foundry:registry=https://npm.pkg.github.com`.
    - Ensure Cloudflare pages/workers environment variables include `NPM_TOKEN` or `GITHUB_TOKEN` with package read permissions.
    - Update `package.json` dependencies in `cardshub` from `file:...` to version numbers (e.g., `^0.1.0`).
3.  **Refactor Apps:**
    - Migrate `card_doctor` to use `@character-foundry/loader` and `tokenizers`.
    - Migrate `cardshub` to use `@character-foundry/tokenizers`.

## 📝 Notes
- **Repo Visibility:** Ensure `character-foundry` is Public if we want free GitHub Packages access without auth complexity, otherwise `cardshub` needs a token.
- **Versioning:** We are currently on `0.0.1` / `0.1.0`. We should adopt `changesets` or semantic-release for automated version bumping in the future.