import type { ChangeEvent } from 'react';
import type { FieldWidgetProps } from '../../types/ui-hints';

/**
 * Headless radio button group widget.
 * Renders a group of radio buttons for single selection from options.
 */
export function RadioGroup({
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
      <fieldset data-radio-group>
        {label && (
          <legend data-radio-legend>
            {label}
            {required && (
              <span aria-hidden="true" data-required>
                *
              </span>
            )}
          </legend>
        )}
        {hasHelper && (
          <p id={helperId} data-helper>
            {hint?.helperText}
          </p>
        )}
        <div data-radio-options role="radiogroup" aria-required={required}>
          {options.map((opt, index) => {
            const optionId = `${id}-${index}`;
            const isChecked = value === opt.value;

            return (
              <label
                key={opt.value}
                htmlFor={optionId}
                data-radio-option
                data-checked={isChecked}
              >
                <input
                  id={optionId}
                  type="radio"
                  name={name}
                  value={opt.value}
                  checked={isChecked}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
                  disabled={disabled || hint?.readOnly}
                  aria-invalid={hasError}
                  aria-describedby={
                    [hasError && errorId, hasHelper && helperId].filter(Boolean).join(' ') ||
                    undefined
                  }
                />
                <span data-radio-label>{opt.label}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
      {hasError && (
        <p id={errorId} role="alert" data-error-message>
          {error}
        </p>
      )}
    </div>
  );
}
