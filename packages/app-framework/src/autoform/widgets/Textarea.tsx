import type { ChangeEvent } from 'react';
import type { FieldWidgetProps } from '../../types/ui-hints';

/**
 * Headless multi-line text input widget.
 * Renders a textarea with configurable rows.
 *
 * @example
 * ```tsx
 * // Via uiHints
 * <AutoForm
 *   schema={schema}
 *   uiHints={{ bio: { widget: 'textarea', rows: 5 } }}
 * />
 * ```
 */
export function Textarea({
  value,
  onChange,
  name,
  label,
  error,
  disabled,
  required,
  hint,
}: FieldWidgetProps<string>) {
  const id = `field-${name}`;
  const errorId = `${id}-error`;
  const helperId = `${id}-helper`;
  const hasError = Boolean(error);
  const hasHelper = Boolean(hint?.helperText);

  const rows = hint?.rows ?? 4;

  return (
    <div className={hint?.className} data-field={name} data-error={hasError}>
      {label && (
        <label htmlFor={id}>
          {label}
          {required && (
            <span aria-hidden="true" data-required>
              *
            </span>
          )}
        </label>
      )}
      <textarea
        id={id}
        name={name}
        value={value ?? ''}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
        disabled={disabled}
        readOnly={hint?.readOnly}
        placeholder={hint?.placeholder}
        rows={rows}
        minLength={hint?.min}
        maxLength={hint?.max}
        aria-invalid={hasError}
        aria-describedby={
          [hasError && errorId, hasHelper && helperId].filter(Boolean).join(' ') ||
          undefined
        }
        aria-required={required}
        data-textarea
      />
      {hasHelper && (
        <p id={helperId} data-helper>
          {hint?.helperText}
        </p>
      )}
      {hasError && (
        <p id={errorId} role="alert" data-error-message>
          {error}
        </p>
      )}
    </div>
  );
}
