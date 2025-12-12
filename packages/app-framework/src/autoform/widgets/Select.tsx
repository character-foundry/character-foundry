import type { ChangeEvent } from 'react';
import type { FieldWidgetProps } from '../../types/ui-hints';

/**
 * Headless select dropdown widget.
 * Renders a native select element with options from hint or enum values.
 */
export function Select({
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

  const options = hint?.options ?? [];

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
      <select
        id={id}
        name={name}
        value={value ?? ''}
        onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)}
        disabled={disabled || hint?.readOnly}
        aria-invalid={hasError}
        aria-describedby={
          [hasError && errorId, hasHelper && helperId].filter(Boolean).join(' ') ||
          undefined
        }
        aria-required={required}
      >
        {!required && <option value="">-- Select --</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
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
