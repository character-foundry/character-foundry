# @character-foundry/tokenizers

GPT-4 and LLaMA token counting for AI character cards.

## Installation

```bash
npm install @character-foundry/tokenizers
```

## Features

- **Multiple tokenizers** - GPT-4, GPT-3.5, LLaMA
- **Card field counting** - Count tokens per field
- **Registry system** - Extensible tokenizer support

## Quick Start

```typescript
import {
  countTokens,
  countCardTokens,
  registry,
} from '@character-foundry/tokenizers';

// Count tokens in text
const tokens = countTokens('Hello, world!', 'gpt-4');

// Count all fields in a card
const cardTokens = countCardTokens(card, 'gpt-4');
// {
//   description: 1234,
//   personality: 567,
//   firstMes: 890,
//   systemPrompt: 456,
//   total: 3147
// }

// Use tokenizer directly
const tokenizer = registry.get('gpt-4');
const count = tokenizer.count(card.data.description);
```

## Supported Tokenizers

- `gpt-4` / `gpt-4o` - cl100k_base encoding
- `gpt-3.5-turbo` - cl100k_base encoding
- `llama` - LLaMA tokenizer

## Documentation

See [docs/tokenizers.md](../../docs/tokenizers.md) for full API documentation.

## License

MIT
