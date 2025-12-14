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
cf detect character.png
# Format: png
# Spec: v3
# Name: Alice
```

### `cf info <file>`
Full metadata summary with token counts.

```bash
cf info character.png --tokenizer gpt-4
```

### `cf validate <file>`
Schema validation with detailed errors.

```bash
cf validate character.png
# ✓ Valid v3 card: Alice

cf validate broken.png
# ✗ Validation failed:
#   • data.name: Required field missing
```

### `cf loss <file> --to <format>`
Preview data loss before conversion.

```bash
cf loss character.charx --to png
```

### `cf export <file> --to <format>`
Convert between formats.

```bash
cf export character.png --to charx
cf export character.charx --to png --v2
```

### `cf extract-assets <file>`
Extract all assets with manifest.

```bash
cf extract-assets character.charx --dir ./assets
```

## Options

- `--json` - Output as JSON for scripting
- `-q, --quiet` - Suppress non-essential output
- `--tokenizer <id>` - Tokenizer for info command (default: gpt-4)

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Validation error |
| 3 | Parse error |
| 4 | Unsupported format |

## Documentation

See [docs/cli.md](../../docs/cli.md) for full documentation.

## License

MIT
