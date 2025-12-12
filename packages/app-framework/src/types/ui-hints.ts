import type { ComponentType } from 'react';

/**
 * Built-in widget types that AutoForm understands
 */
export type BuiltinWidget =
  | 'text'
  | 'number'
  | 'password'
  | 'textarea'
  | 'switch'
  | 'checkbox'
  | 'select'
  | 'searchable-select'
  | 'radio'
  | 'slider'
  | 'color-picker'
  | 'tag-input'
  | 'file-upload';

/**
 * Props passed to custom widget components.
 *
 * This interface is designed to be compatible with external editors
 * like Milkdown, CodeMirror, or any custom component. The minimum
 * required props are `value` and `onChange`.
 *
 * @example
 * ```tsx
 * // Wrapping an external editor
 * function MilkdownWrapper({ value, onChange }: FieldWidgetProps<string>) {
 *   return <Milkdown value={value} onChange={onChange} />;
 * }
 *
 * // Usage
 * <AutoForm
 *   schema={schema}
 *   uiHints={{ content: { widget: MilkdownWrapper } }}
 * />
 * ```
 */
export interface FieldWidgetProps<T = unknown> {
  /** Current field value */
  value: T;

  /** Callback to update the value */
  onChange: (value: T) => void;

  /** Field name from schema (supports dot notation for nested: "parent.child") */
  name: string;

  /** Label text (from hint or schema .describe()) */
  label?: string;

  /** Validation error message */
  error?: string;

  /** Whether the field is disabled */
  disabled?: boolean;

  /** Whether the field is required */
  required?: boolean;

  /** Additional UI hints for the field */
  hint?: FieldUIHint;
}

/**
 * Condition for showing/hiding a field based on another field's value.
 *
 * @example
 * ```tsx
 * // Show only when advancedMode is true
 * { field: 'advancedMode', equals: true }
 *
 * // Show only when kind is one of these values
 * { field: 'kind', oneOf: ['openai', 'openai-compatible'] }
 *
 * // Show only when kind is NOT 'disabled'
 * { field: 'kind', notEquals: 'disabled' }
 * ```
 */
export interface FieldCondition {
  /** The field name to check (supports dot notation for nested fields) */
  field: string;

  /** Show when field equals this exact value */
  equals?: unknown;

  /** Show when field does NOT equal this value */
  notEquals?: unknown;

  /** Show when field value is one of these values */
  oneOf?: unknown[];

  /** Show when field value is NOT one of these values */
  notOneOf?: unknown[];

  /** Custom predicate function for complex conditions */
  when?: (value: unknown, allValues: Record<string, unknown>) => boolean;
}

/**
 * Field-level UI configuration
 */
export interface FieldUIHint {
  /** Override the rendered widget */
  widget?: BuiltinWidget | ComponentType<FieldWidgetProps<unknown>>;

  /** Custom label (overrides schema .describe()) */
  label?: string;

  /** Helper text shown below field */
  helperText?: string;

  /** Placeholder text */
  placeholder?: string;

  /** For sliders/numbers: min value */
  min?: number;

  /** For sliders/numbers: max value */
  max?: number;

  /** For sliders/numbers: step increment */
  step?: number;

  /** For select/radio: explicit options (overrides z.enum) */
  options?: Array<{ value: string; label: string }>;

  /** Hide this field from the form */
  hidden?: boolean;

  /** Make this field read-only */
  readOnly?: boolean;

  /** CSS class name to apply */
  className?: string;

  /** For textarea: number of rows */
  rows?: number;

  /** Custom validation message */
  validationMessage?: string;

  // === Conditional Fields ===

  /**
   * Condition for showing this field.
   * If not met, the field is hidden (not just visually - removed from DOM).
   */
  condition?: FieldCondition;

  // === File Upload ===

  /** For file-upload: accepted file types (e.g., "image/*", ".pdf,.doc") */
  accept?: string;

  /** For file-upload: allow multiple files */
  multiple?: boolean;

  /** For file-upload: max file size in bytes */
  maxSize?: number;

  // === Searchable Select ===

  /** For select: enable search/filter functionality */
  searchable?: boolean;

  /** For searchable-select: placeholder for search input */
  searchPlaceholder?: string;

  /** For searchable-select: "no results" message */
  noResultsText?: string;

  // === Field Groups (used by FieldGroup component) ===

  /** Group this field belongs to (for organization) */
  group?: string;
}

/**
 * Props for the FieldGroup component
 */
export interface FieldGroupProps {
  /** Group title */
  title: string;

  /** Group description/subtitle */
  description?: string;

  /** Allow collapsing the group */
  collapsible?: boolean;

  /** Start collapsed (requires collapsible=true) */
  defaultCollapsed?: boolean;

  /** CSS class name */
  className?: string;

  /** Children (field elements) */
  children: React.ReactNode;
}

/**
 * UI hints map for a schema.
 * Keys correspond to field names in the Zod object schema.
 * Supports nested objects via dot notation or nested hint objects.
 *
 * @example
 * ```tsx
 * // Flat schema
 * uiHints={{ name: { label: 'Full Name' } }}
 *
 * // Nested schema - both syntaxes work
 * uiHints={{
 *   'profile.name': { label: 'Profile Name' },  // dot notation
 *   profile: { name: { label: 'Profile Name' } } // nested object
 * }}
 * ```
 */
export type UIHints<T extends Record<string, unknown>> = {
  [K in keyof T]?: T[K] extends Record<string, unknown>
    ? FieldUIHint | UIHints<T[K]>
    : FieldUIHint;
} & {
  // Allow dot-notation keys like "profile.name"
  [key: string]: FieldUIHint | undefined;
};
