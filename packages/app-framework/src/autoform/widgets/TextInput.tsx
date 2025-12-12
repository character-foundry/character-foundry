import type { ChangeEvent } from 'react';
import type { FieldWidgetProps } from '../../types/ui-hints';

/**
 * Headless text input widget.
 * Renders a basic text input with label, error display, and helper text.
 */
export function TextInput({
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
      <input
        id={id}
        type="text"
        name={name}
        value={value ?? ''}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={hint?.placeholder}
        aria-invalid={hasError}
        aria-describedby={
          [hasError && errorId, hasHelper && helperId].filter(Boolean).join(' ') ||
          undefined
        }
        aria-required={required}
        readOnly={hint?.readOnly}
        minLength={hint?.min}
        maxLength={hint?.max}
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
