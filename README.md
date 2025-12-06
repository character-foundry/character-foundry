# Character Foundry

A universal TypeScript library for reading, writing, and converting AI character card formats.

## Packages

- **@character-foundry/core**: Foundation utilities (binary, zip, base64, uri).
- **@character-foundry/schemas**: Zod schemas and TypeScript types for CCv2, CCv3, and Voxta.
- **@character-foundry/loader**: Universal `parseCard()` API.
- **@character-foundry/exporter**: Universal `exportCard()` API with loss reporting.
- **@character-foundry/png**: PNG chunk handling (tEXt/zTXt).
- **@character-foundry/charx**: CharX (ZIP) format support.
- **@character-foundry/voxta**: Voxta package support.
- **@character-foundry/normalizer**: Data normalization logic.
- **@character-foundry/federation**: (Planned) ActivityPub sync.

## Installation

This project is a monorepo using [pnpm](https://pnpm.io/) and [TurboRepo](https://turbo.build/).

```bash
pnpm install
pnpm build
```

## Testing

```bash
pnpm test
```
