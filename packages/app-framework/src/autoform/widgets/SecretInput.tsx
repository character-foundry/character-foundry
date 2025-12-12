import { useState, useCallback, type ChangeEvent } from 'react';
import type { FieldWidgetProps } from '../../types/ui-hints';

/**
 * Headless password/secret input widget.
 * Renders a password input with toggle visibility button.
 */
export function SecretInput({
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

  const [showValue, setShowValue] = useState(false);

  const toggleVisibility = useCallback(() => {
    setShowValue((prev) => !prev);
  }, []);

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
      <div data-secret-container>
        <input
          id={id}
          type={showValue ? 'text' : 'password'}
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
          autoComplete="off"
          data-secret-input
        />
        <button
          type="button"
          onClick={toggleVisibility}
          disabled={disabled}
          aria-label={showValue ? 'Hide value' : 'Show value'}
          data-secret-toggle
        >
          {showValue ? 'Hide' : 'Show'}
        </button>
      </div>
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
