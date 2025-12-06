# AGENTS.md — @character-foundry/schemas

## Purpose

Type definitions and Zod schemas for all card formats. Pure types, no runtime logic beyond validation.

---

## Schema Files

| File | Content |
|------|---------|
| `ccv2.ts` | Character Card v2 spec types |
| `ccv3.ts` | Character Card v3 spec types |
| `voxta.ts` | Voxta character/package types |
| `risu.ts` | RisuAI extension types (opaque blobs) |
| `common.ts` | Shared types (Lorebook, Asset, etc.) |

---

## Key Types

```typescript
// Unified card view (not stored, computed)
interface NormalizedCard {
  name: string;
  description: string;
  personality: string;
  scenario: string;
  firstMes: string;
  mesExample: string;
  systemPrompt?: string;
  postHistoryInstructions?: string;
  alternateGreetings: string[];
  tags: string[];
  creator?: string;
  creatorNotes?: string;
  characterVersion?: string;
  characterBook?: CharacterBook;
  extensions: Record<string, unknown>;
}

// Source format tracking
type SourceFormat =
  | 'png_v2' | 'png_v3'
  | 'json_v2' | 'json_v3'
  | 'charx' | 'charx_risu' | 'charx_jpeg'
  | 'voxta';

type OriginalShape = 'wrapped' | 'unwrapped' | 'legacy';
```

---

## Validation Philosophy

- **Permissive on read:** Accept malformed cards, fill missing with defaults
- **Strict on write:** Validate before export, reject invalid cards
- **Preserve unknowns:** Don't strip unrecognized fields

---

## Dependencies

**None.** Pure type definitions.

---

## Testing Focus

- Zod schema validation (valid/invalid cards)
- Type inference correctness
- Unknown field preservation
