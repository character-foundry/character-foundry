import { useMemo, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { z } from 'zod';
import { useForm, Controller, FormProvider, type DefaultValues, type Path } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { analyzeSchema, flattenSchema, getValueAtPath, type FieldInfo } from './introspection';
import { FieldRenderer } from './field-renderer';
import type { UIHints, FieldUIHint, FieldCondition } from '../types/ui-hints';
import { WidgetRegistry } from '../registry/widget-registry';
import { WidgetRegistryContext } from './hooks/useWidgetRegistry';

/**
 * Props for the AutoForm component.
 *
 * @template T - Zod object schema type
 */
export interface AutoFormProps<T extends z.ZodObject<z.ZodRawShape>> {
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

  /**
   * Render prop for custom form layout.
   * If provided, you control how fields and submit button are rendered.
   */
  children?: (props: {
    /** Array of rendered field elements */
    fields: ReactNode[];
    /** Submit button element (null if withSubmit=false) */
    submit: ReactNode;
    /** Form state from react-hook-form */
    formState: { isSubmitting: boolean; isValid: boolean; isDirty: boolean };
    /**
     * Get a specific field by name.
     * Supports dot notation for nested fields: getField('profile.name')
     */
    getField: (name: string) => ReactNode | null;
    /**
     * Get fields belonging to a group (from uiHints.group).
     */
    getFieldsByGroup: (group: string) => ReactNode[];
  }) => ReactNode;
}

/**
 * Schema-driven form component that automatically renders fields
 * based on a Zod object schema.
 *
 * Features:
 * - Nested object support
 * - Conditional field visibility
 * - Custom widget integration
 * - Full react-hook-form integration
 *
 * @example
 * ```tsx
 * const schema = z.object({
 *   name: z.string().describe('Your name'),
 *   profile: z.object({
 *     bio: z.string(),
 *     website: z.string().url().optional(),
 *   }),
 *   kind: z.enum(['basic', 'advanced']),
 *   advancedOption: z.string().optional(),
 * });
 *
 * <AutoForm
 *   schema={schema}
 *   uiHints={{
 *     advancedOption: {
 *       condition: { field: 'kind', equals: 'advanced' }
 *     }
 *   }}
 *   onSubmit={(data) => console.log(data)}
 *   withSubmit
 * />
 * ```
 */
export function AutoForm<T extends z.ZodObject<z.ZodRawShape>>({
  schema,
  values,
  defaultValues,
  onChange,
  onSubmit,
  uiHints = {} as UIHints<z.infer<T>>,
  fieldOrder,
  disabled = false,
  withSubmit = false,
  submitText = 'Submit',
  className,
  widgetRegistry,
  children,
}: AutoFormProps<T>) {
  // Analyze schema - get top-level fields
  const fieldInfoMap = useMemo(() => analyzeSchema(schema), [schema]);

  // Also flatten for nested field access
  const flatFieldInfoMap = useMemo(() => flattenSchema(schema), [schema]);

  // Extract default values from schema (including nested)
  const schemaDefaults = useMemo(() => {
    const defaults: Record<string, unknown> = {};

    function extractDefaults(fields: Map<string, FieldInfo>, prefix = '') {
      fields.forEach((info, key) => {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (info.defaultValue !== undefined) {
          setNestedValue(defaults, fullKey, info.defaultValue);
        }
        if (info.nestedFields) {
          extractDefaults(info.nestedFields, fullKey);
        }
      });
    }

    extractDefaults(fieldInfoMap);
    return defaults;
  }, [fieldInfoMap]);

  // Setup react-hook-form
  // shouldUnregister ensures hidden/conditional fields don't leak stale values
  const methods = useForm<z.infer<T>>({
    resolver: zodResolver(schema),
    defaultValues: {
      ...schemaDefaults,
      ...defaultValues,
      ...values,
    } as DefaultValues<z.infer<T>>,
    mode: 'onChange',
    shouldUnregister: true,
  });

  const { control, handleSubmit, watch, formState, reset } = methods;

  // Watch all values for conditional field evaluation
  const watchedValues = watch();

  // Track previous values to avoid unnecessary resets in controlled mode
  const prevValuesRef = useRef<z.infer<T> | undefined>(values);

  // Sync external values in controlled mode (with deep comparison)
  useEffect(() => {
    if (values && !shallowEqual(values, prevValuesRef.current)) {
      prevValuesRef.current = values;
      reset({ ...schemaDefaults, ...defaultValues, ...values } as z.infer<T>);
    }
  }, [values, reset, schemaDefaults, defaultValues]);

  // Call onChange when values change
  useEffect(() => {
    if (onChange) {
      const result = schema.safeParse(watchedValues);
      if (result.success) {
        onChange(result.data);
      }
    }
  }, [watchedValues, onChange, schema]);

  // Known FieldUIHint keys for detection
  const HINT_KEYS = new Set([
    'widget', 'label', 'placeholder', 'helperText', 'hidden', 'readOnly',
    'className', 'condition', 'group', 'rows', 'accept', 'multiple', 'maxSize',
    'options', 'searchable', 'searchPlaceholder', 'noResultsText',
  ]);

  // Check if an object is a FieldUIHint (has at least one known hint property)
  const isFieldUIHint = useCallback((obj: unknown): obj is FieldUIHint => {
    if (!obj || typeof obj !== 'object') return false;
    return Object.keys(obj).some((key) => HINT_KEYS.has(key));
  }, []);

  // Get hint for a field (supports dot notation and nested syntax)
  const getHint = useCallback(
    (fieldName: string): FieldUIHint | undefined => {
      // First try direct dot-notation key (e.g., 'profile.name')
      if (fieldName in uiHints) {
        const hint = uiHints[fieldName];
        if (isFieldUIHint(hint)) return hint;
      }

      // Then try nested object access (e.g., uiHints.profile.name)
      const parts = fieldName.split('.');
      let current: unknown = uiHints;
      for (const part of parts) {
        if (current == null || typeof current !== 'object') return undefined;
        current = (current as Record<string, unknown>)[part];
      }

      // Check if we found a valid FieldUIHint
      if (isFieldUIHint(current)) {
        return current;
      }

      return undefined;
    },
    [uiHints, isFieldUIHint]
  );

  // Evaluate if a field's condition is met
  const isConditionMet = useCallback(
    (condition: FieldCondition | undefined): boolean => {
      if (!condition) return true;

      const fieldValue = getValueAtPath(watchedValues as Record<string, unknown>, condition.field);

      // Custom predicate
      if (condition.when) {
        return condition.when(fieldValue, watchedValues as Record<string, unknown>);
      }

      // Equals check
      if ('equals' in condition && condition.equals !== undefined) {
        return fieldValue === condition.equals;
      }

      // Not equals check
      if ('notEquals' in condition && condition.notEquals !== undefined) {
        return fieldValue !== condition.notEquals;
      }

      // One of check
      if (condition.oneOf) {
        return condition.oneOf.includes(fieldValue);
      }

      // Not one of check
      if (condition.notOneOf) {
        return !condition.notOneOf.includes(fieldValue);
      }

      return true;
    },
    [watchedValues]
  );

  // Determine field order (top-level only)
  const orderedFields = useMemo(() => {
    if (fieldOrder) {
      return fieldOrder.map((f) => String(f));
    }
    return Array.from(fieldInfoMap.keys());
  }, [fieldOrder, fieldInfoMap]);

  // Handle form submission
  const onFormSubmit = handleSubmit(async (data) => {
    await onSubmit?.(data);
  });

  // Recursive field renderer
  const renderField = useCallback(
    (fieldInfo: FieldInfo): ReactNode => {
      const hint = getHint(fieldInfo.name);

      // Check hidden hint
      if (hint?.hidden) return null;

      // Check condition
      if (!isConditionMet(hint?.condition)) return null;

      return (
        <Controller
          key={fieldInfo.name}
          name={fieldInfo.name as Path<z.infer<T>>}
          control={control}
          render={({ field, fieldState }) => (
            <FieldRenderer
              fieldInfo={fieldInfo}
              hint={hint}
              value={field.value}
              onChange={field.onChange}
              error={fieldState.error?.message}
              disabled={disabled}
              renderNestedField={renderField}
            />
          )}
        />
      );
    },
    [control, disabled, getHint, isConditionMet]
  );

  // Render all top-level fields
  const renderedFields = orderedFields
    .map((fieldName) => {
      const fieldInfo = fieldInfoMap.get(fieldName);
      if (!fieldInfo) return null;
      return renderField(fieldInfo);
    })
    .filter(Boolean) as ReactNode[];

  // Get a specific field by name (including nested)
  const getField = useCallback(
    (name: string): ReactNode | null => {
      const fieldInfo = flatFieldInfoMap.get(name);
      if (!fieldInfo) return null;
      return renderField(fieldInfo);
    },
    [flatFieldInfoMap, renderField]
  );

  // Get fields by group
  const getFieldsByGroup = useCallback(
    (group: string): ReactNode[] => {
      const fields: ReactNode[] = [];
      for (const [name] of flatFieldInfoMap) {
        const hint = getHint(name);
        if (hint?.group === group) {
          const rendered = getField(name);
          if (rendered) fields.push(rendered);
        }
      }
      return fields;
    },
    [flatFieldInfoMap, getField, getHint]
  );

  // Submit button
  const submitButton = withSubmit ? (
    <button
      type="submit"
      disabled={disabled || formState.isSubmitting}
      data-autoform-submit
    >
      {formState.isSubmitting ? 'Submitting...' : submitText}
    </button>
  ) : null;

  // Wrap with widget registry context if provided
  const formContent = (
    <FormProvider {...methods}>
      <form onSubmit={onFormSubmit} className={className} data-autoform>
        {children ? (
          children({
            fields: renderedFields,
            submit: submitButton,
            formState: {
              isSubmitting: formState.isSubmitting,
              isValid: formState.isValid,
              isDirty: formState.isDirty,
            },
            getField,
            getFieldsByGroup,
          })
        ) : (
          <>
            {renderedFields}
            {submitButton}
          </>
        )}
      </form>
    </FormProvider>
  );

  if (widgetRegistry) {
    return (
      <WidgetRegistryContext.Provider value={widgetRegistry}>
        {formContent}
      </WidgetRegistryContext.Provider>
    );
  }

  return formContent;
}

/**
 * Helper to set a value at a nested path in an object (mutating).
 */
function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (part === undefined) continue;
    if (!(part in current) || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }

  const lastPart = parts[parts.length - 1];
  if (lastPart !== undefined) {
    current[lastPart] = value;
  }
}

/**
 * Shallow equality check for objects.
 * Prevents unnecessary reset() calls in controlled mode.
 */
function shallowEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return a === b;

  const keysA = Object.keys(a as object);
  const keysB = Object.keys(b as object);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    const valA = (a as Record<string, unknown>)[key];
    const valB = (b as Record<string, unknown>)[key];

    // For nested objects, do recursive shallow check (one level deep)
    if (typeof valA === 'object' && typeof valB === 'object' && valA !== null && valB !== null) {
      if (!shallowEqual(valA, valB)) return false;
    } else if (valA !== valB) {
      return false;
    }
  }

  return true;
}
