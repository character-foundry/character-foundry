---
"@character-foundry/character-foundry": minor
---

Add `onValidationError` and `onRawChange` callbacks to AutoForm

- `onValidationError`: Called when Zod validation fails during onChange, providing the ZodError
- `onRawChange`: Called on every value change regardless of validation status, useful for tracking raw user input
