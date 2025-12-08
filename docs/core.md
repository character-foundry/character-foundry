# Core Package Documentation

The `@character-foundry/core` package provides foundational utilities used across all Character Foundry packages. It works in both Node.js and browser environments with zero dependencies.

## Table of Contents

- [Binary Utilities](#binary-utilities)
- [Base64 Utilities](#base64-utilities)
- [ZIP Utilities](#zip-utilities)
- [URI Utilities](#uri-utilities)
- [Error Classes](#error-classes)
- [Image Utilities](#image-utilities)

---

## Binary Utilities

Cross-platform binary data handling that works with both `Uint8Array` and Node.js `Buffer`.

### Type

```typescript
type BinaryData = Uint8Array | Buffer;
```

### Functions

#### Reading/Writing Integers

```typescript
import { readUInt32BE, writeUInt32BE, readUInt16BE, writeUInt16BE } from '@character-foundry/core';

// Read big-endian integers
const value32 = readUInt32BE(data, offset);
const value16 = readUInt16BE(data, offset);

// Write big-endian integers
writeUInt32BE(data, value, offset);
writeUInt16BE(data, value, offset);
```

#### Array Operations

```typescript
import { indexOf, concat, slice, copy, equals } from '@character-foundry/core';

// Find byte sequence
const pos = indexOf(haystack, needle, startOffset);

// Concatenate arrays
const combined = concat([array1, array2, array3]);

// Slice array
const portion = slice(data, start, end);

// Copy between arrays
copy(source, target, targetStart);

// Compare arrays
const same = equals(array1, array2);
```

#### String Conversion

```typescript
import { fromString, toString, fromLatin1, toLatin1 } from '@character-foundry/core';

// UTF-8 encoding/decoding
const bytes = fromString('Hello, World!');
const text = toString(bytes);

// Latin1 (ISO-8859-1) encoding/decoding
const latin1Bytes = fromLatin1('Hello');
const latin1Text = toLatin1(bytes);
```

#### Hex Conversion

```typescript
import { toHex, fromHex } from '@character-foundry/core';

const hex = toHex(bytes);        // 'deadbeef'
const data = fromHex('deadbeef'); // Uint8Array
```

#### Utility Functions

```typescript
import { alloc, from, isBinaryData, toUint8Array } from '@character-foundry/core';

// Allocate new array (filled with zeros)
const buffer = alloc(1024);

// Create from array of numbers
const data = from([0x89, 0x50, 0x4e, 0x47]);

// Type check
if (isBinaryData(value)) { ... }

// Ensure Uint8Array
const uint8 = toUint8Array(maybeBuffer);
```

---

## Base64 Utilities

Base64 encoding/decoding with support for standard and URL-safe variants.

```typescript
import {
  base64Encode,
  base64Decode,
  isBase64,
  base64EncodeUrlSafe,
  base64DecodeUrlSafe,
} from '@character-foundry/core';

// Standard Base64
const encoded = base64Encode(data);
const decoded = base64Decode(encoded);

// Check if string is valid Base64
if (isBase64(str)) { ... }

// URL-safe Base64 (uses - and _ instead of + and /)
const urlSafe = base64EncodeUrlSafe(data);
const fromUrlSafe = base64DecodeUrlSafe(urlSafe);
```

---

## ZIP Utilities

ZIP file detection, validation, and path safety checks.

### Constants

```typescript
import { ZIP_SIGNATURE, JPEG_SIGNATURE, DEFAULT_ZIP_LIMITS } from '@character-foundry/core';

// ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04] (PK..)
// JPEG_SIGNATURE = [0xff, 0xd8, 0xff]
// DEFAULT_ZIP_LIMITS = { maxTotalSize: 50MB, maxFileSize: 50MB, maxFiles: 1000 }
```

### Detection Functions

```typescript
import {
  isZipBuffer,
  startsWithZipSignature,
  isJPEG,
  isJpegCharX,
  findZipStart,
  getZipOffset,
  isValidZip,
} from '@character-foundry/core';

// Check if buffer is a ZIP file
if (isZipBuffer(data)) { ... }

// Check if buffer starts with ZIP signature
if (startsWithZipSignature(data)) { ... }

// Check if buffer is JPEG
if (isJPEG(data)) { ... }

// Check if JPEG+ZIP hybrid (CharX in JPEG container)
if (isJpegCharX(data)) { ... }

// Find where ZIP data starts in hybrid file
const zipStart = findZipStart(data); // -1 if not found

// Get ZIP offset (handles JPEG+ZIP hybrids)
const offset = getZipOffset(data);

// Validate ZIP structure
if (isValidZip(data)) { ... }
```

### Path Safety

```typescript
import { isPathSafe } from '@character-foundry/core';

// Prevent path traversal attacks
if (isPathSafe(filename)) {
  // Safe to use
} else {
  // Contains ../ or absolute paths
}
```

### Size Limits

```typescript
import { type ZipSizeLimits, DEFAULT_ZIP_LIMITS } from '@character-foundry/core';

interface ZipSizeLimits {
  maxTotalSize: number;  // Max total uncompressed size
  maxFileSize: number;   // Max single file size
  maxFiles: number;      // Max number of files
}

// DEFAULT_ZIP_LIMITS:
// - maxTotalSize: 52,428,800 (50 MB)
// - maxFileSize: 52,428,800 (50 MB)
// - maxFiles: 1000
```

---

## URI Utilities

Data URI handling and media type utilities.

### Types

```typescript
type URIScheme = 'data' | 'http' | 'https' | 'file' | 'embeded' | 'unknown';

interface ParsedURI {
  scheme: URIScheme;
  mimeType?: string;
  encoding?: string;  // 'base64' or undefined
  data?: string;      // Raw data portion
  path?: string;      // For file/http URIs
}
```

### Parsing and Building

```typescript
import { parseURI, normalizeURI, buildDataURI } from '@character-foundry/core';

// Parse any URI
const parsed = parseURI('data:image/png;base64,iVBOR...');
// { scheme: 'data', mimeType: 'image/png', encoding: 'base64', data: '...' }

const parsed2 = parseURI('embeded://assets/avatar.png');
// { scheme: 'embeded', path: 'assets/avatar.png' }

// Normalize URI (fix common issues)
const normalized = normalizeURI(uri);

// Build data URI from binary data
const dataUri = buildDataURI(pngBytes, 'image/png');
// 'data:image/png;base64,iVBOR...'
```

### Extension and MIME Type

```typescript
import {
  isImageExt,
  isAudioExt,
  isVideoExt,
  getExtensionFromURI,
  getMimeTypeFromExt,
  getExtFromMimeType,
} from '@character-foundry/core';

// Check extension type
isImageExt('png');  // true
isAudioExt('mp3');  // true
isVideoExt('mp4');  // true

// Get extension from URI
getExtensionFromURI('data:image/png;base64,...');  // 'png'

// Convert between extension and MIME type
getMimeTypeFromExt('png');        // 'image/png'
getExtFromMimeType('image/jpeg'); // 'jpg'
```

### Safety Check

```typescript
import { isURISafe } from '@character-foundry/core';

// Check if URI is safe (no javascript:, file://, etc.)
if (isURISafe(uri)) { ... }
```

---

## Error Classes

Structured error types for better error handling.

### Base Class

```typescript
import { FoundryError, isFoundryError } from '@character-foundry/core';

class FoundryError extends Error {
  code: string;
  context?: Record<string, unknown>;
}

// Type guard
if (isFoundryError(err)) {
  console.log(err.code, err.context);
}
```

### Specific Error Types

```typescript
import {
  ParseError,
  ValidationError,
  AssetNotFoundError,
  FormatNotSupportedError,
  SizeLimitError,
  PathTraversalError,
  DataLossError,
} from '@character-foundry/core';

// Parse errors - malformed data
throw new ParseError('Invalid JSON', 'json');

// Validation errors - data doesn't meet schema
throw new ValidationError('Missing required field: name');

// Asset not found
throw new AssetNotFoundError('avatar.png');

// Format not supported
throw new FormatNotSupportedError('bmp');

// Size limit exceeded
throw new SizeLimitError('File exceeds 50MB limit', 60000000, 52428800);

// Path traversal attempt
throw new PathTraversalError('../../../etc/passwd');

// Data loss during conversion
throw new DataLossError('group_only_greetings not supported in v2');
```

### Error Wrapping

```typescript
import { wrapError } from '@character-foundry/core';

try {
  // ...
} catch (err) {
  throw wrapError(err, 'Failed to parse card');
  // Wraps unknown errors as FoundryError, preserves FoundryError
}
```

---

## Image Utilities

Image format detection.

```typescript
import { isAnimatedImage } from '@character-foundry/core';

// Detect animated GIF/PNG/WebP
const animated = isAnimatedImage(imageBytes);
// Checks for:
// - GIF with NETSCAPE2.0 extension
// - APNG with acTL chunk
// - WebP with ANIM chunk
```

---

## Usage Examples

### Reading a PNG File Header

```typescript
import {
  readUInt32BE,
  slice,
  equals,
  from,
} from '@character-foundry/core';

const PNG_SIG = from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function isPNG(data: BinaryData): boolean {
  if (data.length < 8) return false;
  return equals(slice(data, 0, 8), PNG_SIG);
}

function getFirstChunkType(data: BinaryData): string {
  // Skip 8-byte signature, read 4-byte length, then 4-byte type
  const type = slice(data, 12, 16);
  return toString(type); // 'IHDR'
}
```

### Building a Data URI

```typescript
import { base64Encode, buildDataURI } from '@character-foundry/core';

const imageBytes = /* ... */;
const dataUri = buildDataURI(imageBytes, 'image/png');
// Use in HTML: <img src="${dataUri}" />
```

### Safe ZIP Extraction

```typescript
import { isPathSafe, SizeLimitError, PathTraversalError } from '@character-foundry/core';

function extractFile(zipEntry: { name: string; size: number; data: Uint8Array }) {
  if (!isPathSafe(zipEntry.name)) {
    throw new PathTraversalError(zipEntry.name);
  }

  if (zipEntry.size > 50 * 1024 * 1024) {
    throw new SizeLimitError('File too large', zipEntry.size, 50 * 1024 * 1024);
  }

  return zipEntry.data;
}
```
