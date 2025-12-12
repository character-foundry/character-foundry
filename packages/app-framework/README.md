# @character-foundry/app-framework

Schema-driven UI framework for building extensible applications. Generates forms automatically from Zod schemas.

## Installation

```bash
pnpm add @character-foundry/app-framework
```

**Peer Dependencies:** React 18+ or 19+

## Features

### AutoForm - Schema-Driven Forms

Automatically generates form UI from Zod schemas:

```tsx
import { z } from 'zod';
import { AutoForm } from '@character-foundry/app-framework';

const settingsSchema = z.object({
  apiKey: z.string().describe('Your API Key'),
  model: z.enum(['gpt-4', 'gpt-3.5-turbo']),
  temperature: z.number().min(0).max(2).default(0.7),
  enabled: z.boolean().default(true),
  tags: z.array(z.string()),
});

function SettingsPanel() {
  return (
    <AutoForm
      schema={settingsSchema}
      defaultValues={{ model: 'gpt-4' }}
      onSubmit={(data) => console.log(data)}
      withSubmit
      submitText="Save Settings"
    />
  );
}
```

### Supported Zod Types

| Zod Type | Default Widget | Notes |
|----------|---------------|-------|
| `z.string()` | TextInput | |
| `z.string().describe('...key...')` | SecretInput | Auto-detects API key/password/token |
| `z.number()` | NumberInput | Respects `.min()` / `.max()` |
| `z.boolean()` | Switch | |
| `z.enum([...])` | Select (5+) / Radio (2-4) | Based on option count |
| `z.array(z.string())` | TagInput | Chip/tag input |

### UI Hints

Override default widget behavior:

```tsx
<AutoForm
  schema={schema}
  uiHints={{
    description: {
      widget: 'textarea',
      helperText: 'Markdown supported',
    },
    internalId: { hidden: true },
    role: {
      widget: 'radio',
      options: [
        { value: 'admin', label: 'Administrator' },
        { value: 'user', label: 'Regular User' },
      ],
    },
  }}
/>
```

### Available UI Hint Options

```typescript
interface FieldUIHint {
  widget?: BuiltinWidget | ComponentType<FieldWidgetProps>;
  label?: string;
  helperText?: string;
  placeholder?: string;
  className?: string;
  min?: number;
  max?: number;
  options?: Array<{ value: string; label: string }>;
  hidden?: boolean;
  readOnly?: boolean;
}
```

### Built-in Widget Names

- `text` - Single line text input
- `textarea` - Multi-line text (falls back to TextInput currently)
- `number` - Numeric input with constraints
- `switch` / `checkbox` - Boolean toggle
- `select` - Dropdown select
- `radio` - Radio button group
- `password` - Password input with show/hide toggle
- `tag-input` - Tag/chip input for string arrays
- `slider` - Range slider (falls back to NumberInput currently)
- `color-picker` - Color picker (falls back to TextInput currently)

### Custom Field Order

```tsx
<AutoForm
  schema={schema}
  fieldOrder={['name', 'email', 'role', 'bio']}
/>
```

### Custom Layout with Render Prop

```tsx
<AutoForm schema={schema} withSubmit>
  {({ fields, submit, formState }) => (
    <div className="my-layout">
      <div className="fields-container">{fields}</div>
      <div className="actions">
        {formState.isDirty && <span>Unsaved changes</span>}
        {submit}
      </div>
    </div>
  )}
</AutoForm>
```

### Custom Widgets

Register custom widgets globally:

```tsx
import { WidgetRegistry } from '@character-foundry/app-framework';

const registry = new WidgetRegistry();
registry.register('markdown-editor', MarkdownEditor);

<AutoForm
  schema={schema}
  widgetRegistry={registry}
  uiHints={{ content: { widget: 'markdown-editor' } }}
/>
```

Or pass a component directly:

```tsx
<AutoForm
  schema={schema}
  uiHints={{ content: { widget: MyCustomEditor } }}
/>
```

## Extension System

Define modular extensions with typed configuration:

```typescript
import { z } from 'zod';
import type { Extension } from '@character-foundry/app-framework';

const configSchema = z.object({
  apiKey: z.string(),
  baseUrl: z.string().url().optional(),
});

export const myExtension: Extension<typeof configSchema> = {
  id: 'my-extension',
  name: 'My Extension',
  version: '1.0.0',
  configSchema,
  defaultConfig: { apiKey: '' },

  onActivate(context) {
    console.log('Extension activated with config:', context.config);
  },

  onDeactivate() {
    console.log('Extension deactivated');
  },
};
```

## Registry System

### SettingsRegistry

Register settings panels:

```typescript
import { SettingsRegistry } from '@character-foundry/app-framework';

const settings = new SettingsRegistry();

settings.register({
  id: 'openai',
  name: 'OpenAI Settings',
  category: 'providers',
  schema: openaiConfigSchema,
  defaultValues: { model: 'gpt-4' },
});

// Iterate registered panels
for (const panel of settings.getAll()) {
  console.log(panel.name);
}
```

### ProviderRegistry

Register service providers with client factories:

```typescript
import { ProviderRegistry } from '@character-foundry/app-framework';

const providers = new ProviderRegistry();

providers.register({
  id: 'openai',
  name: 'OpenAI',
  configSchema: openaiConfigSchema,
  createClient(config) {
    return new OpenAIClient(config);
  },
});

// Create a client instance
const client = providers.createClient('openai', { apiKey: 'sk-...' });
```

### WidgetRegistry

Register custom form widgets:

```typescript
import { WidgetRegistry } from '@character-foundry/app-framework';

const widgets = new WidgetRegistry();

widgets.register('color-picker', ColorPickerWidget);
widgets.register('file-upload', FileUploadWidget);

// Use in AutoForm
<AutoForm widgetRegistry={widgets} ... />
```

## Schema Introspection

Analyze Zod schemas programmatically:

```typescript
import { analyzeSchema, analyzeField, getDefaultWidgetType } from '@character-foundry/app-framework';

const schema = z.object({
  name: z.string().min(1).max(100).describe('Your name'),
  age: z.number().optional(),
});

const fields = analyzeSchema(schema);

for (const [name, info] of fields) {
  console.log(name, {
    type: info.typeName,        // 'ZodString', 'ZodNumber', etc.
    isOptional: info.isOptional,
    isNullable: info.isNullable,
    defaultValue: info.defaultValue,
    description: info.description,
    constraints: info.constraints, // { minLength, maxLength, min, max }
  });
}
```

## Headless Widgets

All built-in widgets are headless (unstyled). They use semantic HTML and data attributes for styling:

```css
/* Example styling */
[data-field] {
  margin-bottom: 1rem;
}

[data-field] label {
  display: block;
  font-weight: 500;
}

[data-field][data-error="true"] input {
  border-color: red;
}

[data-error-message] {
  color: red;
  font-size: 0.875rem;
}

[data-tag] {
  display: inline-flex;
  padding: 0.25rem 0.5rem;
  background: #e0e0e0;
  border-radius: 4px;
}
```

### Data Attributes

| Attribute | Element | Description |
|-----------|---------|-------------|
| `data-field` | Container | Field name |
| `data-error` | Container | `"true"` if has error |
| `data-required` | Span | Required indicator (*) |
| `data-helper` | P | Helper text |
| `data-error-message` | P | Error message |
| `data-tag` | Span | Tag chip |
| `data-tag-remove` | Button | Remove tag button |
| `data-tag-input` | Input | Tag text input |
| `data-secret-input` | Input | Password input |
| `data-secret-toggle` | Button | Show/hide toggle |
| `data-autoform` | Form | AutoForm container |
| `data-autoform-submit` | Button | Submit button |

## Current Limitations

These features are NOT yet implemented:

- **Nested objects** - `z.object({ profile: z.object({...}) })` won't render nested fields
- **Array of objects** - `z.array(z.object({...}))` not supported
- **Discriminated unions** - `z.discriminatedUnion()` not handled
- **Field sections/groups** - No collapsible sections
- **Conditional fields** - No show/hide based on other field values
- **Async validation** - Only synchronous Zod validation

## API Reference

### Exports

```typescript
// Types
export type { Extension, ExtensionContext, ExtensionServices };
export type { FieldUIHint, UIHints, BuiltinWidget, FieldWidgetProps };

// Registries
export { Registry } from './registry/base-registry';
export { SettingsRegistry } from './registry/settings-registry';
export { ProviderRegistry } from './registry/provider-registry';
export { WidgetRegistry } from './registry/widget-registry';

// AutoForm
export { AutoForm } from './autoform/AutoForm';
export { FieldRenderer } from './autoform/field-renderer';
export { analyzeSchema, analyzeField, getDefaultWidgetType, isSecretField } from './autoform/introspection';

// Widgets
export { TextInput, NumberInput, Switch, Select, TagInput, SecretInput } from './autoform/widgets';
```

## Version

0.1.0
