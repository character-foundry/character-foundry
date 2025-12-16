import type { ChangeEvent } from 'react';
import type { FieldWidgetProps } from '../../types/ui-hints';

/**
 * Props for NumberInput - allows number | undefined since empty inputs are undefined
 */
export type NumberInputProps = Omit<FieldWidgetProps<number | undefined>, 'onChange'> & {
  /** Value can be number or undefined (empty) */
  value: number | undefined;
  /** onChange receives number or undefined (empty) */
  onChange: (value: number | undefined) => void;
};

/**
 * Headless number input widget.
 * Renders a number input with min/max/step support.
 *
 * Note: This widget properly handles empty inputs as `undefined`,
 * not as a type-cast lie. The form resolver handles validation
 * for required fields.
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
}: NumberInputProps) {
  const id = `field-${name}`;
  const errorId = `${id}-error`;
  const helperId = `${id}-helper`;
  const hasError = Boolean(error);
  const hasHelper = Boolean(hint?.helperText);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '') {
      // Empty input is properly typed as undefined
      onChange(undefined);
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
