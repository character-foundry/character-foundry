# @character-foundry/schemas

TypeScript types and Zod schemas for CCv2, CCv3, Voxta, and other AI character card formats.

## Installation

```bash
npm install @character-foundry/schemas
```

## Features

- **Full TypeScript types** - CCv2Data, CCv3Data, VoxtaCharacter, and more
- **Zod runtime validation** - Validate data at runtime with detailed errors
- **Format detection** - Detect card format from raw data
- **Type guards** - isV2Card(), isV3Card(), etc.

## Quick Start

```typescript
import {
  CCv3DataSchema,
  parseV3Card,
  isV3Card,
  safeParse,
  detectFormat,
} from '@character-foundry/schemas';

// Type guard with runtime validation
if (isV3Card(unknownData)) {
  console.log(unknownData.data.name);
}

// Parse with validation (throws on invalid)
const card = parseV3Card(jsonData);

// Safe parse with error details
const result = safeParse(CCv3DataSchema, data);
if (result.success) {
  console.log(result.data);
} else {
  console.error(result.error, result.field);
}

// Detect format
const detection = detectFormat(buffer);
// { format: 'png', confidence: 'high', reason: '...' }
```

## Available Schemas

- `CCv3DataSchema` - Full v3 card structure
- `CCv2DataSchema` / `CCv2WrappedSchema` - v2 card formats
- `AssetDescriptorSchema` - Asset metadata
- `SpecSchema`, `SourceFormatSchema`, `AssetTypeSchema` - Enums

## Documentation

See [docs/schemas.md](../../docs/schemas.md) for full API documentation.

## License

MIT
