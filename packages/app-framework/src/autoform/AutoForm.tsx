import { useMemo, useEffect, type ReactNode } from 'react';
import { z } from 'zod';
import { useForm, Controller, FormProvider, type DefaultValues, type Path } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { analyzeSchema } from './introspection';
import { FieldRenderer } from './field-renderer';
import type { UIHints } from '../types/ui-hints';
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
    fields: ReactNode[];
    submit: ReactNode;
    formState: { isSubmitting: boolean; isValid: boolean; isDirty: boolean };
  }) => ReactNode;
}

/**
 * Schema-driven form component that automatically renders fields
 * based on a Zod object schema.
 *
 * @example
 * ```tsx
 * const schema = z.object({
 *   name: z.string().describe('Your name'),
 *   age: z.number().min(0).describe('Your age'),
 *   enabled: z.boolean().default(false),
 * });
 *
 * <AutoForm
 *   schema={schema}
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
  // Analyze schema once
  const fieldInfoMap = useMemo(() => analyzeSchema(schema), [schema]);

  // Extract default values from schema
  const schemaDefaults = useMemo(() => {
    const defaults: Record<string, unknown> = {};
    fieldInfoMap.forEach((info, key) => {
      if (info.defaultValue !== undefined) {
        defaults[key as string] = info.defaultValue;
      }
    });
    return defaults;
  }, [fieldInfoMap]);

  // Setup react-hook-form
  const methods = useForm<z.infer<T>>({
    resolver: zodResolver(schema),
    defaultValues: {
      ...schemaDefaults,
      ...defaultValues,
      ...values,
    } as DefaultValues<z.infer<T>>,
    mode: 'onChange',
  });

  const { control, handleSubmit, watch, formState, reset } = methods;

  // Sync external values in controlled mode
  useEffect(() => {
    if (values) {
      reset({ ...schemaDefaults, ...defaultValues, ...values } as z.infer<T>);
    }
  }, [values, reset, schemaDefaults, defaultValues]);

  // Watch for changes and call onChange
  const watchedValues = watch();
  useEffect(() => {
    if (onChange) {
      const result = schema.safeParse(watchedValues);
      if (result.success) {
        onChange(result.data);
      }
    }
  }, [watchedValues, onChange, schema]);

  // Determine field order (as string array for iteration)
  const orderedFields = useMemo(() => {
    if (fieldOrder) {
      return fieldOrder.map((f) => String(f));
    }
    return Array.from(fieldInfoMap.keys()).map((k) => String(k));
  }, [fieldOrder, fieldInfoMap]);

  // Handle form submission
  const onFormSubmit = handleSubmit(async (data) => {
    await onSubmit?.(data);
  });

  // Render fields
  const renderedFields = orderedFields.map((fieldName) => {
    // fieldName is a string key from the schema
    const fieldInfo = fieldInfoMap.get(fieldName as string & keyof z.infer<T>);
    const hint = uiHints[fieldName as keyof typeof uiHints];

    if (!fieldInfo || hint?.hidden) return null;

    return (
      <Controller
        key={fieldName}
        name={fieldName as Path<z.infer<T>>}
        control={control}
        render={({ field, fieldState }) => (
          <FieldRenderer
            fieldInfo={fieldInfo}
            hint={hint}
            value={field.value}
            onChange={field.onChange}
            error={fieldState.error?.message}
            disabled={disabled}
          />
        )}
      />
    );
  }).filter(Boolean) as ReactNode[];

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
