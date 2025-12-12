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
  | 'radio'
  | 'slider'
  | 'color-picker'
  | 'tag-input';

/**
 * Props passed to custom widget components
 */
export interface FieldWidgetProps<T = unknown> {
  /** Current field value */
  value: T;

  /** Callback to update the value */
  onChange: (value: T) => void;

  /** Field name from schema */
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
}

/**
 * UI hints map for a schema.
 * Keys correspond to field names in the Zod object schema.
 */
export type UIHints<T extends Record<string, unknown>> = {
  [K in keyof T]?: FieldUIHint;
};
