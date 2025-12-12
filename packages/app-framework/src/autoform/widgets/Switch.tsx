import type { ChangeEvent } from 'react';
import type { FieldWidgetProps } from '../../types/ui-hints';

/**
 * Headless switch/toggle widget.
 * Renders a checkbox with switch semantics (role="switch").
 */
export function Switch({
  value,
  onChange,
  name,
  label,
  error,
  disabled,
  hint,
}: FieldWidgetProps<boolean>) {
  const id = `field-${name}`;
  const errorId = `${id}-error`;
  const helperId = `${id}-helper`;
  const hasError = Boolean(error);
  const hasHelper = Boolean(hint?.helperText);

  return (
    <div className={hint?.className} data-field={name} data-error={hasError}>
      <label htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          role="switch"
          name={name}
          checked={value ?? false}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.checked)}
          disabled={disabled || hint?.readOnly}
          aria-invalid={hasError}
          aria-describedby={
            [hasError && errorId, hasHelper && helperId].filter(Boolean).join(' ') ||
            undefined
          }
        />
        <span data-switch-label>{label}</span>
      </label>
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
