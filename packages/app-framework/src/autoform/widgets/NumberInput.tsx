import type { ChangeEvent } from 'react';
import type { FieldWidgetProps } from '../../types/ui-hints';

/**
 * Headless number input widget.
 * Renders a number input with min/max/step support.
 */
export function NumberInput({
  value,
  onChange,
  name,
  label,
  error,
  disabled,
  required,
  hint,
}: FieldWidgetProps<number>) {
  const id = `field-${name}`;
  const errorId = `${id}-error`;
  const helperId = `${id}-helper`;
  const hasError = Boolean(error);
  const hasHelper = Boolean(hint?.helperText);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '') {
      onChange(undefined as unknown as number);
    } else {
      const num = parseFloat(val);
      if (!isNaN(num)) {
        onChange(num);
      }
    }
  };

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
        type="number"
        name={name}
        value={value ?? ''}
        onChange={handleChange}
        disabled={disabled}
        placeholder={hint?.placeholder}
        aria-invalid={hasError}
        aria-describedby={
          [hasError && errorId, hasHelper && helperId].filter(Boolean).join(' ') ||
          undefined
        }
        aria-required={required}
        readOnly={hint?.readOnly}
        min={hint?.min}
        max={hint?.max}
        step={hint?.step}
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
