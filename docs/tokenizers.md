# Tokenizers Package Documentation

**Package:** `@character-foundry/tokenizers`
**Version:** 0.1.1
**Environment:** Node.js and Browser

The `@character-foundry/tokenizers` package provides token counting for character cards using GPT-4 and other tokenizer implementations.

## Features

- **`countCardTokens()`** - Count tokens across all card fields
- **`countText()`** - Simple text token counting
- **GPT-4 tokenizer** - Accurate OpenAI token counting via tiktoken
- **Simple word-based tokenizer** - Fast approximation for UI feedback
- LLaMA tokenizer support (approximate)

## Table of Contents

- [Overview](#overview)
- [Tokenizer Interface](#tokenizer-interface)
- [Built-in Tokenizers](#built-in-tokenizers)
- [Registry](#registry)
- [Usage Examples](#usage-examples)

---

## Overview

Token counting is essential for:
- Estimating context usage
- Staying within model limits
- Optimizing character definitions

This package provides tokenizers that match popular LLM tokenization schemes.

---

## Tokenizer Interface

All tokenizers implement this interface:

```typescript
interface TokenizerAdapter {
  /** Unique identifier */
  id: string;

  /** Display name */
  name: string;

  /** Count tokens in text */
  count(text: string): number;

  /** Count tokens in multiple texts */
  countMany(texts: string[]): number[];

  /** Encode text to token IDs (optional) */
  encode?(text: string): number[];

  /** Decode token IDs to text (optional) */
  decode?(tokens: number[]): string;
}
```

---

## Built-in Tokenizers

### GPT-4 Tokenizer

Uses `tiktoken` for accurate GPT-4/GPT-3.5 token counting.

```typescript
import { GptTokenizer } from '@character-foundry/tokenizers';

const tokenizer = new GptTokenizer();
// id: 'gpt-4'
// name: 'GPT-4 (cl100k_base)'

const count = tokenizer.count('Hello, world!');
// Accurate GPT-4 token count

// Full encode/decode support
const tokens = tokenizer.encode('Hello, world!');
const text = tokenizer.decode(tokens);
```

### LLaMA Tokenizer

Approximate LLaMA/Llama 2 token counting.

```typescript
import { LlamaTokenizer } from '@character-foundry/tokenizers';

const tokenizer = new LlamaTokenizer();
// id: 'llama'
// name: 'LLaMA (approximate)'

const count = tokenizer.count('Hello, world!');
// Approximate LLaMA token count
```

### Simple Tokenizer

Fast approximation based on word/character splitting.

```typescript
import { SimpleTokenizer } from '@character-foundry/tokenizers';

const tokenizer = new SimpleTokenizer();
// id: 'simple'
// name: 'Simple (word-based)'

const count = tokenizer.count('Hello, world!');
// Fast but less accurate
```

---

## Registry

The registry manages available tokenizers.

```typescript
import { TokenizerRegistry, registry, countTokens } from '@character-foundry/tokenizers';

// Get tokenizer by ID
const gpt4 = registry.get('gpt-4');
const llama = registry.get('llama');
const simple = registry.get('simple');

// Default (GPT-4)
const defaultTokenizer = registry.get();

// List all tokenizers
const all = registry.list();
// [GptTokenizer, LlamaTokenizer, SimpleTokenizer]

// Quick count function
const count = countTokens('Hello, world!', 'gpt-4');
```

### Custom Tokenizers

Register your own tokenizer:

```typescript
import { TokenizerRegistry } from '@character-foundry/tokenizers';

class MyTokenizer implements TokenizerAdapter {
  id = 'my-tokenizer';
  name = 'My Custom Tokenizer';

  count(text: string): number {
    // Your implementation
    return text.length / 4; // Rough estimate
  }

  countMany(texts: string[]): number[] {
    return texts.map(t => this.count(t));
  }
}

const registry = new TokenizerRegistry();
registry.register(new MyTokenizer());

const count = registry.get('my-tokenizer').count('Hello');
```

---

## Usage Examples

### Count Card Tokens

```typescript
import { registry } from '@character-foundry/tokenizers';
import type { CCv3Data } from '@character-foundry/schemas';

function countCardTokens(card: CCv3Data, tokenizerId = 'gpt-4') {
  const tokenizer = registry.get(tokenizerId);
  const data = card.data;

  const counts = {
    name: tokenizer.count(data.name),
    description: tokenizer.count(data.description),
    personality: tokenizer.count(data.personality),
    scenario: tokenizer.count(data.scenario),
    firstMessage: tokenizer.count(data.first_mes),
    exampleMessages: tokenizer.count(data.mes_example),
    systemPrompt: tokenizer.count(data.system_prompt),
    postHistory: tokenizer.count(data.post_history_instructions),
    creatorNotes: tokenizer.count(data.creator_notes),
  };

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return { ...counts, total };
}
```

### Compare Tokenizers

```typescript
import { registry } from '@character-foundry/tokenizers';

function compareTokenizers(text: string) {
  const results: Record<string, number> = {};

  for (const tokenizer of registry.list()) {
    results[tokenizer.id] = tokenizer.count(text);
  }

  return results;
}

const comparison = compareTokenizers('Hello, how are you doing today?');
// { 'gpt-4': 8, 'llama': 9, 'simple': 6 }
```

### Estimate Context Usage

```typescript
import { countTokens } from '@character-foundry/tokenizers';

interface ContextEstimate {
  permanent: number;    // Always in context
  perMessage: number;   // Average per message
  available: number;    // Remaining for conversation
}

function estimateContext(
  card: CCv3Data,
  contextLimit = 8192,
  tokenizerId = 'gpt-4'
): ContextEstimate {
  const data = card.data;

  // Permanent context (always included)
  const permanent =
    countTokens(data.description, tokenizerId) +
    countTokens(data.personality, tokenizerId) +
    countTokens(data.scenario, tokenizerId) +
    countTokens(data.system_prompt, tokenizerId);

  // Per-message estimate (first message as baseline)
  const perMessage = countTokens(data.first_mes, tokenizerId);

  // Available for conversation
  const available = contextLimit - permanent;

  return { permanent, perMessage, available };
}
```

### Batch Processing

```typescript
import { registry } from '@character-foundry/tokenizers';

function batchCount(texts: string[], tokenizerId = 'gpt-4'): number[] {
  const tokenizer = registry.get(tokenizerId);
  return tokenizer.countMany(texts);
}

// More efficient than calling count() in a loop
const counts = batchCount([
  'First message',
  'Second message',
  'Third message',
]);
```

### Token Budget Check

```typescript
import { countTokens } from '@character-foundry/tokenizers';

interface BudgetCheck {
  withinBudget: boolean;
  used: number;
  remaining: number;
  overBy?: number;
}

function checkTokenBudget(
  text: string,
  budget: number,
  tokenizerId = 'gpt-4'
): BudgetCheck {
  const used = countTokens(text, tokenizerId);
  const remaining = budget - used;
  const withinBudget = remaining >= 0;

  return {
    withinBudget,
    used,
    remaining: Math.max(0, remaining),
    overBy: withinBudget ? undefined : Math.abs(remaining),
  };
}

const check = checkTokenBudget(card.data.description, 500);
if (!check.withinBudget) {
  console.warn(`Description is ${check.overBy} tokens over budget!`);
}
```

### Lorebook Token Analysis

```typescript
import { countTokens } from '@character-foundry/tokenizers';
import type { CCv3CharacterBook } from '@character-foundry/schemas';

interface LorebookAnalysis {
  totalEntries: number;
  totalTokens: number;
  averagePerEntry: number;
  largestEntry: { name: string; tokens: number };
  entries: { name: string; tokens: number }[];
}

function analyzeLorebookTokens(
  book: CCv3CharacterBook,
  tokenizerId = 'gpt-4'
): LorebookAnalysis {
  const entries = book.entries.map(entry => ({
    name: entry.name || `Entry ${entry.id}`,
    tokens: countTokens(entry.content, tokenizerId),
  }));

  const totalTokens = entries.reduce((sum, e) => sum + e.tokens, 0);
  const largestEntry = entries.reduce((max, e) =>
    e.tokens > max.tokens ? e : max,
    { name: '', tokens: 0 }
  );

  return {
    totalEntries: entries.length,
    totalTokens,
    averagePerEntry: Math.round(totalTokens / entries.length),
    largestEntry,
    entries: entries.sort((a, b) => b.tokens - a.tokens),
  };
}
```

---

## Tokenizer Accuracy

| Tokenizer | Accuracy | Speed | Use Case |
|-----------|----------|-------|----------|
| `gpt-4` | Exact | Medium | OpenAI models |
| `llama` | Approximate | Fast | LLaMA models |
| `simple` | Rough | Very Fast | Quick estimates |

### When to Use Each

- **gpt-4**: When targeting OpenAI models and accuracy matters
- **llama**: When targeting LLaMA/Llama 2 and approximation is acceptable
- **simple**: For quick UI feedback, large batch processing

---

## Card Token Counting

Built-in utilities for counting tokens across all card fields.

```typescript
import { countCardTokens, countText } from '@character-foundry/tokenizers';

// Count all card fields
const counts = countCardTokens(card);
// {
//   description: 150,
//   personality: 80,
//   scenario: 45,
//   firstMes: 200,
//   mesExample: 300,
//   systemPrompt: 50,
//   postHistoryInstructions: 30,
//   creatorNotes: 25,
//   alternateGreetings: 180,
//   lorebook: 500,
//   total: 1560
// }

// With options
const counts = countCardTokens(card, {
  tokenizer: 'llama',           // Tokenizer ID (default: 'gpt-4')
  onlyEnabledLorebook: true,    // Only count enabled entries (default: true)
});

// Simple text counting
const tokens = countText('Hello, world!'); // Uses default (gpt-4)
const llamaTokens = countText('Hello, world!', 'llama');
```

### TokenCountOptions

```typescript
interface TokenCountOptions {
  /** Tokenizer ID to use. Default: 'gpt-4' */
  tokenizer?: string;
  /** Only count enabled lorebook entries. Default: true */
  onlyEnabledLorebook?: boolean;
}
```

### Supported Card Formats

`countCardTokens()` accepts both wrapped and unwrapped card formats:

```typescript
// Wrapped (CCv2/CCv3)
const wrapped = {
  spec: 'chara_card_v3',
  data: { name: 'Character', description: '...' }
};
countCardTokens(wrapped);

// Unwrapped (just the data)
const unwrapped = { name: 'Character', description: '...' };
countCardTokens(unwrapped);
```

### CardTokenCounts Interface

```typescript
interface CardTokenCounts {
  description: number;
  personality: number;
  scenario: number;
  firstMes: number;
  mesExample: number;
  systemPrompt: number;
  postHistoryInstructions: number;
  creatorNotes: number;
  alternateGreetings: number;
  lorebook: number;
  total: number;
}
```

---

## Performance Tips

1. **Use `countMany()`** for batches - more efficient than looping
2. **Cache tokenizer instances** - avoid repeated `registry.get()`
3. **Use simple tokenizer** for real-time UI updates
4. **Use GPT-4 tokenizer** for final validation
5. **Use `countCardTokens()`** for full card analysis
