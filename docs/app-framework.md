# @character-foundry/app-framework

Schema-driven UI framework for building extensible applications. Generates forms automatically from Zod schemas with support for nested objects, conditional fields, and custom widget integration.

## Installation

```bash
pnpm add @character-foundry/app-framework
```

**Peer Dependencies:** React 18+ or 19+

## Quick Start

```tsx
import { z } from 'zod';
import { AutoForm } from '@character-foundry/app-framework';

const schema = z.object({
  name: z.string().describe('Your name'),
  email: z.string().email(),
  role: z.enum(['admin', 'user', 'guest']),
});

function MyForm() {
  return (
    <AutoForm
      schema={schema}
      onSubmit={(data) => console.log(data)}
      withSubmit
    />
  );
}
```

## Features

- **Schema-driven forms** - Generate UI from Zod schemas
- **Nested objects** - Automatic handling of `z.object({ nested: z.object({...}) })`
- **Conditional fields** - Show/hide fields based on other values
- **9 built-in widgets** - TextInput, Textarea, NumberInput, Switch, Select, SearchableSelect, TagInput, SecretInput, FileUpload
- **Custom widgets** - Integrate your own editors (Milkdown, CodeMirror, etc.)
- **Field groups** - Organize fields into collapsible sections
- **Full validation** - Zod validation with inline error display
- **Headless design** - Style with your own CSS/Tailwind

---

## Table of Contents

1. [AutoForm Props](#autoform-props)
2. [Zod Type to Widget Mapping](#zod-type-to-widget-mapping)
3. [UI Hints](#ui-hints)
4. [Nested Objects](#nested-objects)
5. [Conditional Fields](#conditional-fields)
6. [Field Groups](#field-groups)
7. [Custom Widgets](#custom-widgets)
8. [Integrating External Editors](#integrating-external-editors)
9. [Render Props for Custom Layout](#render-props-for-custom-layout)
10. [Extension System](#extension-system)
11. [Registry System](#registry-system)
12. [Styling Guide](#styling-guide)
13. [API Reference](#api-reference)

---

## AutoForm Props

```tsx
interface AutoFormProps<T extends z.ZodObject<any>> {
  /** Zod object schema defining the form shape */
  schema: T;

  /** Current values (for controlled mode) */
  values?: z.infer<T>;

  /** Default values for the form */
  defaultValues?: Partial<z.infer<T>>;

  /** Called when values change (controlled mode) */
  onChange?: (values: z.infer<T>) => void;

  /** Called on form submit with validated data */
  onSubmit?: (values: z.infer<T>) => void | Promise<void>;

  /** UI hints for customizing field rendering */
  uiHints?: UIHints<z.infer<T>>;

  /** Custom field order (array of field names) */
  fieldOrder?: Array<keyof z.infer<T>>;

  /** Disable all fields */
  disabled?: boolean;

  /** Show submit button */
  withSubmit?: boolean;

  /** Submit button text */
  submitText?: string;

  /** Custom className for form container */
  className?: string;

  /** Custom widget registry */
  widgetRegistry?: WidgetRegistry;

  /** Render prop for custom layout */
  children?: (props: RenderProps) => ReactNode;
}
```

---

## Zod Type to Widget Mapping

| Zod Type | Default Widget | Notes |
|----------|---------------|-------|
| `z.string()` | TextInput | |
| `z.string()` + `rows > 1` hint | Textarea | Multi-line |
| `z.string().describe('...api key...')` | SecretInput | Auto-detects secrets |
| `z.number()` | NumberInput | Respects `.min()` / `.max()` |
| `z.boolean()` | Switch | |
| `z.enum([...])` (2-4 options) | Select | Could be radio group |
| `z.enum([...])` (5-10 options) | Select | Standard dropdown |
| `z.enum([...])` (10+ options) | SearchableSelect | Filterable |
| `z.array(z.string())` | TagInput | Chip/tag input |
| `z.object({...})` | Nested rendering | Recursive field group |
| `z.union([...])` | First option type | Picks first union member |
| `z.set(z.string())` | TagInput | Like array |
| `z.record(...)` | TextInput | Custom widget recommended |

---

## UI Hints

Override default widget behavior per field:

```tsx
<AutoForm
  schema={schema}
  uiHints={{
    // Use textarea with 5 rows
    description: {
      widget: 'textarea',
      rows: 5,
      helperText: 'Markdown supported',
    },

    // Hide internal field
    internalId: { hidden: true },

    // Custom label and placeholder
    apiKey: {
      label: 'OpenAI API Key',
      placeholder: 'sk-...',
    },

    // Explicit options for enum
    role: {
      options: [
        { value: 'admin', label: 'Administrator' },
        { value: 'user', label: 'Regular User' },
      ],
    },
  }}
/>
```

### All UI Hint Options

```typescript
interface FieldUIHint {
  // Widget selection
  widget?: BuiltinWidget | ComponentType<FieldWidgetProps>;

  // Labels and text
  label?: string;
  helperText?: string;
  placeholder?: string;
  validationMessage?: string;

  // Constraints
  min?: number;
  max?: number;
  step?: number;

  // Visibility
  hidden?: boolean;
  readOnly?: boolean;
  condition?: FieldCondition;

  // Select options
  options?: Array<{ value: string; label: string }>;
  searchable?: boolean;
  searchPlaceholder?: string;
  noResultsText?: string;

  // Textarea
  rows?: number;

  // File upload
  accept?: string;
  multiple?: boolean;
  maxSize?: number;

  // Organization
  group?: string;
  className?: string;
}
```

### Built-in Widget Names

- `text` - Single line text input
- `textarea` - Multi-line text
- `number` - Numeric input
- `switch` / `checkbox` - Boolean toggle
- `select` - Dropdown select
- `searchable-select` - Filterable dropdown
- `radio` - Radio button group
- `password` - Password with show/hide toggle
- `tag-input` - Tag/chip input for string arrays
- `file-upload` - File input with drag-drop

---

## Nested Objects

AutoForm automatically handles nested object schemas:

```tsx
const schema = z.object({
  name: z.string(),
  profile: z.object({
    bio: z.string().describe('Biography'),
    website: z.string().url().optional(),
    settings: z.object({
      notifications: z.boolean().default(true),
    }),
  }),
});

// Renders nested fieldsets automatically
<AutoForm schema={schema} onSubmit={handleSubmit} />
```

### UI Hints for Nested Fields

Use dot notation or nested objects:

```tsx
uiHints={{
  // Dot notation
  'profile.bio': { widget: 'textarea', rows: 4 },

  // Or nested object
  profile: {
    website: { placeholder: 'https://...' },
  },
}}
```

### Accessing Nested Fields with getField

```tsx
<AutoForm schema={schema}>
  {({ getField }) => (
    <>
      {getField('name')}
      {getField('profile.bio')}
      {getField('profile.settings.notifications')}
    </>
  )}
</AutoForm>
```

---

## Conditional Fields

Show/hide fields based on other field values:

```tsx
const schema = z.object({
  kind: z.enum(['openai', 'anthropic', 'local']),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  anthropicVersion: z.string().optional(),
});

<AutoForm
  schema={schema}
  uiHints={{
    // Show API key for cloud providers
    apiKey: {
      condition: { field: 'kind', oneOf: ['openai', 'anthropic'] },
    },

    // Show anthropicVersion only for Anthropic
    anthropicVersion: {
      condition: { field: 'kind', equals: 'anthropic' },
    },

    // Hide baseUrl for local
    baseUrl: {
      condition: { field: 'kind', notEquals: 'local' },
    },
  }}
/>
```

**Important:** Hidden conditional fields are automatically unregistered from form state, preventing stale/sensitive data from leaking into submissions.

### Condition Types

```typescript
interface FieldCondition {
  field: string;  // Field to check (supports dot notation)

  // Simple comparisons
  equals?: unknown;
  notEquals?: unknown;

  // Multiple values
  oneOf?: unknown[];
  notOneOf?: unknown[];

  // Custom predicate
  when?: (value: unknown, allValues: Record<string, unknown>) => boolean;
}
```

### Complex Conditions with `when`

```tsx
uiHints={{
  premiumFeature: {
    condition: {
      field: 'subscription',
      when: (value, allValues) => {
        // Show only for premium users with >100 credits
        return value === 'premium' &&
               (allValues.credits as number) > 100;
      },
    },
  },
}}
```

---

## Field Groups

Organize fields into collapsible sections:

```tsx
import { AutoForm, FieldGroup } from '@character-foundry/app-framework';

<AutoForm schema={schema}>
  {({ getField, submit }) => (
    <>
      <FieldGroup title="Basic Settings">
        {getField('name')}
        {getField('email')}
      </FieldGroup>

      <FieldGroup title="Advanced" collapsible defaultCollapsed>
        {getField('maxTokens')}
        {getField('temperature')}
      </FieldGroup>

      <FieldGroup title="Danger Zone" description="Destructive actions">
        {getField('deleteOnExit')}
      </FieldGroup>

      {submit}
    </>
  )}
</AutoForm>
```

### FieldGroup Props

```typescript
interface FieldGroupProps {
  title: string;
  description?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  className?: string;
  children: ReactNode;
}
```

---

## Custom Widgets

### Registering Globally

```tsx
import { WidgetRegistry, AutoForm } from '@character-foundry/app-framework';

const registry = new WidgetRegistry();
registry.register('color-picker', ColorPickerWidget);
registry.register('date-picker', DatePickerWidget);

<AutoForm
  schema={schema}
  widgetRegistry={registry}
  uiHints={{
    themeColor: { widget: 'color-picker' },
    birthDate: { widget: 'date-picker' },
  }}
/>
```

### Passing Component Directly

```tsx
<AutoForm
  schema={schema}
  uiHints={{
    themeColor: { widget: MyColorPicker },
  }}
/>
```

### Widget Props Interface

Your custom widget receives these props:

```typescript
interface FieldWidgetProps<T = unknown> {
  /** Current field value */
  value: T;

  /** Callback to update the value */
  onChange: (value: T) => void;

  /** Field name (supports dot notation: "profile.name") */
  name: string;

  /** Label text */
  label?: string;

  /** Validation error message */
  error?: string;

  /** Whether the field is disabled */
  disabled?: boolean;

  /** Whether the field is required */
  required?: boolean;

  /** Additional UI hints */
  hint?: FieldUIHint;
}
```

---

## Integrating External Editors

### Milkdown (Markdown Editor)

```tsx
import { Editor, rootCtx } from '@milkdown/core';
import { commonmark } from '@milkdown/preset-commonmark';
import type { FieldWidgetProps } from '@character-foundry/app-framework';

function MilkdownEditor({ value, onChange, label, error }: FieldWidgetProps<string>) {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editorRef.current) return;

    Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, editorRef.current);
      })
      .use(commonmark)
      .create();
  }, []);

  return (
    <div data-field="milkdown">
      {label && <label>{label}</label>}
      <div ref={editorRef} />
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

// Usage
<AutoForm
  schema={z.object({
    personality: z.string(),
  })}
  uiHints={{
    personality: {
      widget: MilkdownEditor,
      label: 'Character Personality',
      helperText: 'Markdown supported',
    },
  }}
/>
```

### CodeMirror (Code Editor)

```tsx
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import type { FieldWidgetProps } from '@character-foundry/app-framework';

function JsonEditor({ value, onChange, label, error, disabled }: FieldWidgetProps<string>) {
  return (
    <div data-field="json-editor">
      {label && <label>{label}</label>}
      <CodeMirror
        value={value ?? ''}
        extensions={[json()]}
        onChange={(val) => onChange(val)}
        editable={!disabled}
        theme="dark"
      />
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

// Usage
<AutoForm
  schema={z.object({
    config: z.string(),
  })}
  uiHints={{
    config: {
      widget: JsonEditor,
      label: 'JSON Configuration',
    },
  }}
/>
```

**Important**: Don't implement Milkdown/CodeMirror in this library - they're complex and app-specific. Instead, wrap your existing implementations in the `FieldWidgetProps` interface.

---

## Render Props for Custom Layout

Full control over form structure:

```tsx
<AutoForm schema={schema} withSubmit>
  {({ fields, submit, formState, getField, getFieldsByGroup }) => (
    <div className="my-form-layout">
      {/* Status bar */}
      <div className="status">
        {formState.isDirty && <span>Unsaved changes</span>}
        {!formState.isValid && <span>Form has errors</span>}
      </div>

      {/* Two column layout */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          {getField('name')}
          {getField('email')}
        </div>
        <div>
          {getField('phone')}
          {getField('address')}
        </div>
      </div>

      {/* Or render all fields */}
      {fields}

      {/* Custom submit area */}
      <div className="actions">
        <button type="button">Cancel</button>
        {submit}
      </div>
    </div>
  )}
</AutoForm>
```

### Render Props API

```typescript
interface RenderProps {
  /** All rendered field elements */
  fields: ReactNode[];

  /** Submit button element */
  submit: ReactNode;

  /** Form state */
  formState: {
    isSubmitting: boolean;
    isValid: boolean;
    isDirty: boolean;
  };

  /** Get a specific field by name (supports dot notation) */
  getField: (name: string) => ReactNode | null;

  /** Get fields by group (from uiHints.group) */
  getFieldsByGroup: (group: string) => ReactNode[];
}
```

---

## Extension System

Define modular extensions with typed configuration:

```typescript
import { z } from 'zod';
import type { Extension } from '@character-foundry/app-framework';

const configSchema = z.object({
  apiKey: z.string().describe('API Key'),
  model: z.enum(['gpt-4', 'gpt-3.5-turbo']),
  temperature: z.number().min(0).max(2).default(0.7),
});

export const openAIExtension: Extension<typeof configSchema> = {
  id: 'openai-provider',
  name: 'OpenAI Provider',
  version: '1.0.0',
  configSchema,
  defaultConfig: {
    apiKey: '',
    model: 'gpt-4',
    temperature: 0.7,
  },

  onActivate(context) {
    // context.config is fully typed
    console.log('Activated with model:', context.config.model);

    // Access services
    context.services.toast('OpenAI provider activated');
  },

  onDeactivate() {
    console.log('OpenAI provider deactivated');
  },
};
```

---

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
```

### ProviderRegistry

Register service providers:

```typescript
import { ProviderRegistry } from '@character-foundry/app-framework';

const providers = new ProviderRegistry();

providers.register({
  id: 'openai',
  name: 'OpenAI',
  configSchema,
  createClient(config) {
    return new OpenAIClient(config.apiKey, config.model);
  },
});

// Create client instance
const client = providers.createClient('openai', userConfig);
```

---

## Styling Guide

All widgets are headless (unstyled). Use data attributes for styling:

```css
/* Field container */
[data-field] {
  margin-bottom: 1rem;
}

/* Labels */
[data-field] label {
  display: block;
  font-weight: 500;
  margin-bottom: 0.25rem;
}

/* Required indicator */
[data-required] {
  color: red;
  margin-left: 0.25rem;
}

/* Error state */
[data-field][data-error="true"] input,
[data-field][data-error="true"] textarea,
[data-field][data-error="true"] select {
  border-color: red;
}

/* Error message */
[data-error-message] {
  color: red;
  font-size: 0.875rem;
  margin-top: 0.25rem;
}

/* Helper text */
[data-helper] {
  color: #6b7280;
  font-size: 0.875rem;
}

/* Tag input */
[data-tag-container] {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
}

[data-tag] {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.5rem;
  background: #e5e7eb;
  border-radius: 4px;
}

/* Nested objects */
[data-nested-fieldset] {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 1rem;
  margin-top: 1rem;
}

[data-nested-legend] {
  font-weight: 600;
  padding: 0 0.5rem;
}

/* Field groups */
[data-fieldgroup] {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
}

[data-fieldgroup-toggle] {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
}

/* Searchable select */
[data-searchable-select-dropdown] {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  z-index: 50;
}

[data-searchable-select-option][data-highlighted="true"] {
  background: #e5e7eb;
}

/* File upload */
[data-file-dropzone] {
  border: 2px dashed #e5e7eb;
  border-radius: 8px;
  padding: 2rem;
  text-align: center;
  cursor: pointer;
}

[data-file-dropzone][data-dragging="true"] {
  border-color: #3b82f6;
  background: #eff6ff;
}
```

### Data Attributes Reference

| Attribute | Element | Description |
|-----------|---------|-------------|
| `data-field` | Container | Field name |
| `data-error` | Container | "true" if has error |
| `data-required` | Span | Required indicator |
| `data-helper` | P | Helper text |
| `data-error-message` | P | Error message |
| `data-textarea` | Textarea | Textarea element |
| `data-tag-container` | Div | Tag input container |
| `data-tag` | Span | Individual tag |
| `data-tag-remove` | Button | Remove tag button |
| `data-secret-input` | Input | Password input |
| `data-secret-toggle` | Button | Show/hide toggle |
| `data-searchable-select` | Div | Select container |
| `data-searchable-select-trigger` | Button | Dropdown trigger |
| `data-searchable-select-dropdown` | Div | Dropdown panel |
| `data-searchable-select-option` | Li | Option item |
| `data-file-dropzone` | Div | Drop zone |
| `data-file-input` | Input | Hidden file input |
| `data-file-list` | Ul | File list |
| `data-file-item` | Li | File item |
| `data-nested-object` | Div | Nested container |
| `data-nested-fieldset` | Fieldset | Nested fieldset |
| `data-nested-legend` | Legend | Nested title |
| `data-fieldgroup` | Fieldset | Group container |
| `data-fieldgroup-toggle` | Button | Collapse toggle |
| `data-fieldgroup-content` | Div | Group content |
| `data-autoform` | Form | Form container |
| `data-autoform-submit` | Button | Submit button |

---

## API Reference

### Exports

```typescript
// Types
export type {
  Extension,
  ExtensionContext,
  ExtensionServices,
  FieldUIHint,
  FieldCondition,
  FieldGroupProps,
  UIHints,
  FieldWidgetProps,
  BuiltinWidget,
};

// Registries
export {
  Registry,
  SettingsRegistry,
  ProviderRegistry,
  WidgetRegistry,
};

// AutoForm
export {
  AutoForm,
  FieldRenderer,
  FieldGroup,
  FieldSection,
};

// Introspection
export {
  analyzeSchema,
  analyzeField,
  flattenSchema,
  getDefaultWidgetType,
  isSecretField,
  isNestedObject,
  getValueAtPath,
  setValueAtPath,
};

// Widgets
export {
  TextInput,
  Textarea,
  NumberInput,
  Switch,
  Select,
  SearchableSelect,
  TagInput,
  SecretInput,
  FileUpload,
};
```

---

## Version

0.2.1

### Changelog

**0.2.1**
- Fix: Hidden/conditional fields now properly unregister (no stale data leaks)
- Fix: Nested uiHints detection for label/hidden/placeholder without widget key
- Fix: isBuiltinWidget includes searchable-select and file-upload
- Add: ZodUnion, ZodDiscriminatedUnion, ZodRecord, ZodSet type support
- Add: Controlled mode reset thrashing prevention via shallowEqual
- Add: 22 regression tests

**0.2.0**
- Nested object support
- Conditional fields with `condition` prop
- Textarea widget
- FileUpload widget with drag-drop
- SearchableSelect widget
- FieldGroup component
- `getField()` and `getFieldsByGroup()` render props
- `flattenSchema()` for nested field access
- 103 tests passing

**0.1.0**
- Initial release
- Extension interface
- Registry system
- AutoForm with basic widgets
- 63 tests passing
