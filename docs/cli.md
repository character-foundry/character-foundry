# @character-foundry/cli

Command-line tool for inspecting, validating, and converting AI character cards.

## Installation

```bash
# Global install
npm install -g @character-foundry/cli

# Or use directly with npx
npx @character-foundry/cli detect card.png
```

## Commands

### `cf detect <file>`

Detect format and display basic info.

```bash
$ cf detect character.png
Format: png
Confidence: high
Spec: v3
Name: Alice
```

With JSON output:

```bash
$ cf detect character.png --json
{
  "success": true,
  "format": "png",
  "confidence": "high",
  "reason": "Valid PNG signature and structure",
  "spec": "v3",
  "name": "Alice"
}
```

### `cf info <file>`

Full metadata summary with token counts.

```bash
$ cf info character.png

Character Info
──────────────
Name: Alice
Creator: user123
Version: 1.0.0
Format: png (v3)

Token Counts
────────────
Description: 1,234 tokens
Personality: 567 tokens
System Prompt: 890 tokens
Total: 3,456 tokens

Assets
──────
Count: 2
Types: icon, background

Lorebook
────────
Entries: 15

Tags
────
female, fantasy, adventure
```

Options:
- `--tokenizer <id>` - Tokenizer to use (default: gpt-4)

### `cf validate <file>`

Schema validation with detailed errors.

```bash
$ cf validate character.png
✓ Valid v3 card: Alice

$ cf validate broken.png
✗ Validation failed:
  • data.name: Required field missing
  • data.first_mes: Must be a string
```

Options:
- `--strict` - Enable strict validation (validates original format too)

### `cf loss <file> --to <format>`

Preview data loss before conversion.

```bash
$ cf loss character.charx --to png
Loss Report: charx -> png
────────────────────────────────────────
✗ Fields that will be lost:
  • group_only_greetings (PNG v2 doesn't support this)

✗ Assets that will be lost:
  • background.webp (multi-asset not supported)
  • expressions/happy.png (multi-asset not supported)
```

Formats: `png`, `charx`, `voxta`

### `cf export <file> --to <format>`

Convert between formats.

```bash
$ cf export character.png --to charx
✓ Exported to character.charx (245KB)

$ cf export character.charx --to png --v2
✓ Exported to character.png (1.2MB)
```

Options:
- `--out <path>` - Output path (default: same directory with new extension)
- `--v2` - Export PNG as v2 format for maximum compatibility
- `-f, --force` - Overwrite existing file

### `cf extract-assets <file>`

Extract all assets with manifest.

```bash
$ cf extract-assets character.charx --dir ./assets
✓ Extracted 4 assets to ./assets/
  • icon.png (main) - 245.3KB
  • background.webp - 156.2KB
  • expressions/happy.png - 89.1KB
  • expressions/sad.png - 92.4KB

ℹ Created manifest: ./assets/manifest.json
```

Options:
- `--dir <path>` - Output directory (default: ./[card-name]-assets)
- `--no-manifest` - Skip creating manifest.json

## Global Options

All commands support:
- `--json` - Output as JSON for scripting
- `-q, --quiet` - Suppress non-essential output
- `-h, --help` - Show help

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error (IO, unexpected) |
| 2 | Validation error |
| 3 | Parse error |
| 4 | Unsupported format |

## Examples

### Batch validation

```bash
for f in *.png; do
  if ! cf validate "$f" --quiet; then
    echo "Invalid: $f"
  fi
done
```

### JSON pipeline

```bash
cf info character.png --json | jq '.tokens.total'
```

### Convert all PNGs to CharX

```bash
for f in *.png; do
  cf export "$f" --to charx
done
```

### Check loss before batch conversion

```bash
for f in *.charx; do
  echo "=== $f ==="
  cf loss "$f" --to png
done
```
