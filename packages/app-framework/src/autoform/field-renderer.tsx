import type { ComponentType } from 'react';
import type { FieldInfo } from './introspection';
import { getDefaultWidgetType, isSecretField } from './introspection';
import type { FieldUIHint, FieldWidgetProps } from '../types/ui-hints';
import { useWidgetRegistry } from './hooks/useWidgetRegistry';
import {
  TextInput,
  NumberInput,
  Switch,
  Select,
  TagInput,
  SecretInput,
} from './widgets';

/**
 * Props for the FieldRenderer component.
 */
export interface FieldRendererProps {
  /** Analyzed field information from Zod schema */
  fieldInfo: FieldInfo;

  /** UI hints for this field */
  hint?: FieldUIHint;

  /** Current field value */
  value: unknown;

  /** Callback to update the value */
  onChange: (value: unknown) => void;

  /** Validation error message */
  error?: string;

  /** Whether the field is disabled */
  disabled?: boolean;
}

/**
 * Map of built-in widget names to their components.
 */
const BUILTIN_WIDGETS: Record<string, ComponentType<FieldWidgetProps<unknown>>> = {
  text: TextInput as ComponentType<FieldWidgetProps<unknown>>,
  number: NumberInput as ComponentType<FieldWidgetProps<unknown>>,
  switch: Switch as ComponentType<FieldWidgetProps<unknown>>,
  checkbox: Switch as ComponentType<FieldWidgetProps<unknown>>,
  select: Select as ComponentType<FieldWidgetProps<unknown>>,
  radio: Select as ComponentType<FieldWidgetProps<unknown>>, // Could be RadioGroup
  password: SecretInput as ComponentType<FieldWidgetProps<unknown>>,
  'tag-input': TagInput as ComponentType<FieldWidgetProps<unknown>>,
  textarea: TextInput as ComponentType<FieldWidgetProps<unknown>>, // Could be Textarea widget
  slider: NumberInput as ComponentType<FieldWidgetProps<unknown>>, // Could be Slider widget
  'color-picker': TextInput as ComponentType<FieldWidgetProps<unknown>>, // Could be ColorPicker widget
};

/**
 * Map Zod type names to default widget components.
 */
const TYPE_TO_WIDGET: Record<string, ComponentType<FieldWidgetProps<unknown>>> = {
  ZodString: TextInput as ComponentType<FieldWidgetProps<unknown>>,
  ZodNumber: NumberInput as ComponentType<FieldWidgetProps<unknown>>,
  ZodBoolean: Switch as ComponentType<FieldWidgetProps<unknown>>,
  ZodEnum: Select as ComponentType<FieldWidgetProps<unknown>>,
  ZodNativeEnum: Select as ComponentType<FieldWidgetProps<unknown>>,
  ZodArray: TagInput as ComponentType<FieldWidgetProps<unknown>>,
};

/**
 * Renders a single field based on its Zod type and UI hints.
 * Automatically selects the appropriate widget component.
 */
export function FieldRenderer({
  fieldInfo,
  hint,
  value,
  onChange,
  error,
  disabled,
}: FieldRendererProps) {
  const widgetRegistry = useWidgetRegistry();

  // Determine which widget to use
  let Widget: ComponentType<FieldWidgetProps<unknown>>;

  if (hint?.widget) {
    if (typeof hint.widget === 'string') {
      // Built-in widget name or custom registered widget
      Widget =
        BUILTIN_WIDGETS[hint.widget] ??
        widgetRegistry.getComponent(hint.widget) ??
        (TextInput as ComponentType<FieldWidgetProps<unknown>>);
    } else {
      // Custom component passed directly
      Widget = hint.widget;
    }
  } else {
    // Auto-detect from Zod type
    const defaultType = getDefaultWidgetType(fieldInfo);
    Widget =
      BUILTIN_WIDGETS[defaultType] ??
      TYPE_TO_WIDGET[fieldInfo.typeName] ??
      (TextInput as ComponentType<FieldWidgetProps<unknown>>);

    // Override to SecretInput if field looks like a secret
    if (fieldInfo.typeName === 'ZodString' && isSecretField(fieldInfo)) {
      Widget = SecretInput as ComponentType<FieldWidgetProps<unknown>>;
    }
  }

  // Build options from enum values if not provided in hints
  const options =
    hint?.options ??
    (fieldInfo.enumValues
      ? fieldInfo.enumValues.map((v) => ({ value: v, label: v }))
      : undefined);

  // Build the props for the widget
  const props: FieldWidgetProps<unknown> = {
    value,
    onChange,
    name: fieldInfo.name,
    label: hint?.label ?? fieldInfo.description ?? formatLabel(fieldInfo.name),
    error,
    disabled: disabled || hint?.readOnly,
    required: !fieldInfo.isOptional,
    hint: {
      ...hint,
      options,
      min: hint?.min ?? fieldInfo.constraints?.min ?? fieldInfo.constraints?.minLength,
      max: hint?.max ?? fieldInfo.constraints?.max ?? fieldInfo.constraints?.maxLength,
    },
  };

  return <Widget {...props} />;
}

/**
 * Convert a camelCase or snake_case field name to a human-readable label.
 */
function formatLabel(name: string): string {
  return name
    .replace(/([A-Z])/g, ' $1') // camelCase -> Camel Case
    .replace(/_/g, ' ') // snake_case -> snake case
    .replace(/^\w/, (c) => c.toUpperCase()) // Capitalize first letter
    .trim();
}
