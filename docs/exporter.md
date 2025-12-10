# Exporter Package Documentation

**Package:** `@character-foundry/exporter`
**Version:** 0.1.1
**Environment:** Node.js and Browser

The `@character-foundry/exporter` package provides universal character card exporting with format conversion and loss detection.

## Features

- **Universal export** - `exportCard()` to PNG, CharX, or Voxta
- **Loss detection** - `checkExportLoss()` before format conversion
- Format-specific exporters for fine-grained control
- Async and sync variants for all operations

## Table of Contents

- [Overview](#overview)
- [Export Formats](#export-formats)
- [Loss Detection](#loss-detection)
- [Format-Specific Exporters](#format-specific-exporters)
- [Usage Examples](#usage-examples)

---

## Overview

The exporter converts CCv3 cards to any supported output format:

```typescript
import { exportCard } from '@character-foundry/exporter';

const buffer = exportCard(card, assets, { format: 'png' });
```

Key features:
- **Format conversion**: CCv3 → PNG, CharX, Voxta
- **Loss detection**: Know what data will be lost before exporting
- **Asset handling**: Embed or reference assets appropriately

---

## Export Formats

### Types

```typescript
type ExportFormat = 'png' | 'charx' | 'voxta';

interface ExportAsset {
  type: 'icon' | 'background' | 'emotion' | 'audio' | 'video' | 'other';
  name: string;
  ext: string;
  data: Uint8Array;
}

interface ExportResult {
  buffer: Uint8Array;
  format: ExportFormat;
  mimeType: string;
  extension: string;
}
```

### Format Comparison

| Feature | PNG | CharX | Voxta |
|---------|-----|-------|-------|
| Single file | ✅ | ✅ | ✅ |
| Multiple assets | ❌ | ✅ | ✅ |
| Multiple characters | ❌ | ❌ | ✅ |
| Image preview | ✅ | Optional | ❌ |
| Max size | ~10MB | Unlimited | Unlimited |

### Utility Functions

```typescript
import {
  getSupportedFormats,
  getFormatExtension,
  getFormatMimeType,
} from '@character-foundry/exporter';

getSupportedFormats();      // ['png', 'charx', 'voxta']
getFormatExtension('png');  // 'png'
getFormatExtension('charx'); // 'charx'
getFormatExtension('voxta'); // 'voxpkg'
getFormatMimeType('png');   // 'image/png'
getFormatMimeType('charx'); // 'application/zip'
```

---

## Loss Detection

Check what data will be lost when exporting to a specific format.

### Types

```typescript
interface ExportLossReport {
  format: ExportFormat;
  lostFields: string[];        // Fields that will be completely lost
  warnings: string[];          // Non-fatal issues
  preservedInExtensions: string[]; // Saved in extensions (recoverable)
}

interface PreExportCheck {
  canExport: boolean;
  loss: ExportLossReport;
  suggestions: string[];
}
```

### Check Before Export

```typescript
import { checkExportLoss, preExportCheck, formatLossReport } from '@character-foundry/exporter';

// Quick loss check
const loss = checkExportLoss(card, 'png');
if (loss.lostFields.length > 0) {
  console.warn('Fields that will be lost:', loss.lostFields);
}

// Full pre-export check
const check = preExportCheck(card, assets, 'png');
if (!check.canExport) {
  console.error('Cannot export:', check.suggestions);
}

// Human-readable report
console.log(formatLossReport(loss));
// "Exporting to PNG will lose: group_only_greetings, ..."
```

### Loss by Format

#### PNG Loss

| Field | Status |
|-------|--------|
| Multiple assets | Lost (only avatar supported) |
| `group_only_greetings` | Supported |
| All CCv3 fields | Supported |

#### CharX Loss

| Field | Status |
|-------|--------|
| All CCv3 fields | Supported |
| All assets | Supported |
| Voxta-specific | Preserved in extensions |

#### Voxta Loss

| Field | Status |
|-------|--------|
| `group_only_greetings` | Lost |
| `nickname` | Lost |
| `source` | Preserved in extensions |
| Risu scripts | Lost |
| Depth prompts | Lost |

---

## Format-Specific Exporters

For more control, use format-specific exporters directly.

### PNG Export

```typescript
import { exportToPng, exportToPngAsync } from '@character-foundry/exporter';

interface PngExportOptions {
  image?: Uint8Array;      // Base image (required if no icon asset)
  compress?: boolean;      // Use zTXt chunk
  keyword?: string;        // Chunk keyword (default: 'chara')
  stripMetadata?: boolean; // Remove existing text chunks
}

// Sync export
const result = exportToPng(card, assets, {
  compress: false,
  stripMetadata: true,
});

// Async export
const result = await exportToPngAsync(card, assets, options);
```

### CharX Export

```typescript
import { exportToCharx, exportToCharxAsync } from '@character-foundry/exporter';

interface CharxExportOptions {
  compressionLevel?: 0-9;  // ZIP compression
  cover?: Uint8Array;      // Cover image for preview
  preserveStructure?: boolean;
}

const result = exportToCharx(card, assets, {
  compressionLevel: 6,
});
```

### Voxta Export

```typescript
import { exportToVoxta, exportToVoxtaAsync } from '@character-foundry/exporter';

interface VoxtaExportOptions {
  compressionLevel?: 0-9;
  packageName?: string;
  packageId?: string;
}

const result = exportToVoxta(card, assets, {
  packageName: 'My Character Pack',
});
```

---

## Usage Examples

### Basic Export

```typescript
import { exportCard } from '@character-foundry/exporter';
import { writeFile } from 'fs/promises';

async function saveCharacter(
  card: CCv3Data,
  assets: ExportAsset[],
  format: 'png' | 'charx' | 'voxta',
  outputPath: string
) {
  const result = exportCard(card, assets, { format });
  await writeFile(outputPath, result.buffer);

  console.log(`Saved ${result.format} (${result.buffer.length} bytes)`);
}
```

### Export with Loss Check

```typescript
import { exportCard, checkExportLoss, formatLossReport } from '@character-foundry/exporter';

function exportWithWarnings(
  card: CCv3Data,
  assets: ExportAsset[],
  format: ExportFormat
) {
  // Check for loss first
  const loss = checkExportLoss(card, format);

  if (loss.lostFields.length > 0) {
    console.warn('⚠️  Data will be lost:');
    console.warn(formatLossReport(loss));

    // Optionally prompt user to confirm
  }

  if (loss.warnings.length > 0) {
    console.warn('⚠️  Warnings:');
    for (const warning of loss.warnings) {
      console.warn(`  - ${warning}`);
    }
  }

  return exportCard(card, assets, { format });
}
```

### Convert Between Formats

```typescript
import { parseCard } from '@character-foundry/loader';
import { exportCard, checkExportLoss } from '@character-foundry/exporter';

async function convertCard(
  inputBuffer: Uint8Array,
  outputFormat: ExportFormat
): Promise<{ buffer: Uint8Array; loss: ExportLossReport }> {
  // Load any format
  const { card, assets } = parseCard(inputBuffer);

  // Check loss
  const loss = checkExportLoss(card, outputFormat);

  // Export
  const result = exportCard(card, assets, { format: outputFormat });

  return { buffer: result.buffer, loss };
}
```

### Export to Multiple Formats

```typescript
import { exportCard, getSupportedFormats, getFormatExtension } from '@character-foundry/exporter';
import { writeFile } from 'fs/promises';

async function exportAll(
  card: CCv3Data,
  assets: ExportAsset[],
  baseName: string
) {
  const results = [];

  for (const format of getSupportedFormats()) {
    try {
      const result = exportCard(card, assets, { format });
      const ext = getFormatExtension(format);
      const path = `${baseName}.${ext}`;

      await writeFile(path, result.buffer);
      results.push({ format, path, size: result.buffer.length });
    } catch (err) {
      results.push({ format, error: err.message });
    }
  }

  return results;
}
```

### PNG with Custom Image

```typescript
import { exportToPng } from '@character-foundry/exporter';
import { readFile } from 'fs/promises';

async function exportWithCustomImage(
  card: CCv3Data,
  imagePath: string
) {
  // Load custom image
  const imageBuffer = await readFile(imagePath);

  // Export (image used as base, card embedded)
  const result = exportToPng(card, [], {
    image: imageBuffer,
    compress: false,
    stripMetadata: true,
  });

  return result.buffer;
}
```

### CharX with Cover

```typescript
import { exportToCharx } from '@character-foundry/exporter';

function exportCharxWithCover(
  card: CCv3Data,
  assets: ExportAsset[],
  coverImage: Uint8Array
) {
  return exportToCharx(card, assets, {
    cover: coverImage,
    compressionLevel: 6,
  });
}
```

### Voxta with Package Metadata

```typescript
import { exportToVoxta } from '@character-foundry/exporter';
import { v4 as uuid } from 'uuid';

function exportVoxtaPackage(
  card: CCv3Data,
  assets: ExportAsset[]
) {
  return exportToVoxta(card, assets, {
    packageId: uuid(),
    packageName: `${card.data.name} Package`,
    compressionLevel: 6,
  });
}
```

---

## Error Handling

```typescript
import { exportCard } from '@character-foundry/exporter';
import { FormatNotSupportedError, ValidationError } from '@character-foundry/core';

function safeExport(
  card: CCv3Data,
  assets: ExportAsset[],
  format: string
) {
  try {
    return exportCard(card, assets, { format: format as ExportFormat });
  } catch (err) {
    if (err instanceof FormatNotSupportedError) {
      console.error(`Format not supported: ${format}`);
    } else if (err instanceof ValidationError) {
      console.error(`Invalid card data: ${err.message}`);
    } else {
      throw err;
    }
    return null;
  }
}
```

---

## Async vs Sync

Both sync and async versions are available:

```typescript
// Sync - simpler, blocks
const result = exportCard(card, assets, { format: 'png' });

// Async - better for large files, non-blocking
const result = await exportCardAsync(card, assets, { format: 'charx' });
```

Use async for:
- Large CharX/Voxta files
- Web environments
- When you need to show progress
