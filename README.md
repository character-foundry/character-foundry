# Character Foundry

A universal TypeScript library for reading, writing, and converting AI character card formats.

## Packages

- **@character-foundry/core**: Foundation utilities (binary, zip, base64, uri, detection).
- **@character-foundry/schemas**: Zod schemas and TypeScript types for CCv2, CCv3, and Voxta.
- **@character-foundry/loader**: Universal `parseCard()` API with format detection.
- **@character-foundry/exporter**: Universal `exportCard()` API with loss reporting.
- **@character-foundry/tokenizers**: Unified token counting (GPT-4/LLaMA) for cards.
- **@character-foundry/png**: PNG chunk handling (tEXt/zTXt) and embedding.
- **@character-foundry/charx**: CharX (ZIP) format reader/writer.
- **@character-foundry/voxta**: Voxta package (.voxpkg) support with Lorebook linking.
- **@character-foundry/normalizer**: Data normalization logic (v2 -> v3).
- **@character-foundry/federation**: ActivityPub federation routes and adapters.

## Installation (Consumer)

These packages are published to the **GitHub Packages** registry. To install them in your project (e.g., `cardshub`, `card_doctor`), you must configure your package manager to look at the GitHub registry for the `@character-foundry` scope.

1.  Create or update your `.npmrc` file in your project root:

    ```ini
    @character-foundry:registry=https://npm.pkg.github.com
    //npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
    ```

2.  Ensure you have a `GITHUB_TOKEN` environment variable set (or replace `${GITHUB_TOKEN}` with a classic personal access token with `read:packages` scope).

3.  Install the packages:

    ```bash
    npm install @character-foundry/loader @character-foundry/tokenizers
    # or
    pnpm add @character-foundry/loader @character-foundry/tokenizers
    ```

## Development

This project is a monorepo using [pnpm](https://pnpm.io/) and [TurboRepo](https://turbo.build/).

### Setup

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build
```

### Testing

```bash
# Run all tests
pnpm test

# Run tests for a specific package
pnpm test --filter @character-foundry/loader
```

## Documentation

- [Federation API](./docs/API_FEDERATION.md)