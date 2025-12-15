# @character-foundry/core

Binary utilities, base64, ZIP handling, URI parsing, UUID generation, and security features for AI character card processing.

## Installation

```bash
npm install @character-foundry/core
```

## Breaking Changes

### v0.1.0: ZIP utilities moved to subpath

ZIP utilities are now in `@character-foundry/core/zip` to keep `fflate` out of the main bundle:

```typescript
// Before (v0.0.x)
import { isZipBuffer, preflightZipSizes, isPathSafe } from '@character-foundry/core';

// After (v0.1.0+)
import { isZipBuffer, preflightZipSizes, isPathSafe } from '@character-foundry/core/zip';
```

## Features

- **ZIP bomb protection** - Preflight validation and streaming size limits
- **Path traversal prevention** - Safe file path validation
- **Secure UUID** - crypto.randomUUID() with fallback
- **Base64 utilities** - Encode/decode with size validation
- **Data URL parsing** - Safe parsing with size limits
- **Binary utilities** - UTF-8, concatenation, comparison

## Quick Start

```typescript
import {
  preflightZipSizes,
  isPathSafe,
  generateUUID,
  base64Encode,
  base64Decode,
  parseDataUrl,
} from '@character-foundry/core';

// Validate ZIP before extraction
const result = preflightZipSizes(zipData, {
  maxFileSize: 50 * 1024 * 1024,
  maxTotalSize: 200 * 1024 * 1024,
});

// Check path safety
if (isPathSafe(filePath)) {
  // Safe to use
}

// Generate secure UUID
const id = generateUUID();

// Base64 operations
const encoded = base64Encode(data);
const decoded = base64Decode(encoded);
```

## Documentation

See [docs/core.md](../../docs/core.md) for full API documentation.

## License

MIT
