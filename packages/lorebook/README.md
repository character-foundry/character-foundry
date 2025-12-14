# @character-foundry/lorebook

Lorebook parsing, extraction, and format conversion for AI character cards.

## Installation

```bash
npm install @character-foundry/lorebook
```

## Features

- **Multi-format support** - SillyTavern, Agnai, Risu, Wyvern
- **Extraction** - Get lorebooks from cards (embedded and linked)
- **Insertion** - Add lorebooks to cards
- **Format conversion** - Convert between lorebook formats

## Quick Start

```typescript
import {
  parseLorebook,
  getLorebookCollection,
  extractLorebookRefs,
  createLinkedLorebook,
  addLinkedLorebookToCard,
  serializeLorebook,
} from '@character-foundry/lorebook';

// Parse standalone lorebook (auto-detects format)
const { book, originalFormat } = parseLorebook(jsonBuffer);

// Extract from card
const collection = getLorebookCollection(card);
// collection.embedded: CCv3CharacterBook[]
// collection.linked: LinkedLorebook[]

// Find linked references
const refs = extractLorebookRefs(card);
// [{ url, platform, id, name }, ...]

// Add linked lorebook
const linked = createLinkedLorebook(fetchedBook, sourceUrl, 'chub');
const updatedCard = addLinkedLorebookToCard(card, linked);

// Convert format
const json = serializeLorebook(book, 'sillytavern');
```

## Documentation

See [docs/lorebook.md](../../docs/lorebook.md) for full API documentation.

## License

MIT
