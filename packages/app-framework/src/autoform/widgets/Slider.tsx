import type { ChangeEvent } from 'react';
import type { FieldWidgetProps } from '../../types/ui-hints';

/**
 * Headless slider/range widget.
 * Renders a range input for numeric values with optional min/max/step.
 */
export function Slider({
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
  const valueId = `${id}-value`;
  const hasError = Boolean(error);
  const hasHelper = Boolean(hint?.helperText);

  // Extract constraints from hint
  const min = hint?.min ?? 0;
  const max = hint?.max ?? 100;
  const step = hint?.step ?? 1;

  // Current value or default to min
  const currentValue = value ?? min;

  return (
    <div className={hint?.className} data-field={name} data-error={hasError}>
      {label && (
        <label htmlFor={id} data-slider-label>
          {label}
          {required && (
            <span aria-hidden="true" data-required>
              *
            </span>
          )}
        </label>
      )}
      <div data-slider-container>
        <input
          id={id}
          type="range"
          name={name}
          value={currentValue}
          min={min}
          max={max}
          step={step}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(Number(e.target.value))}
          disabled={disabled || hint?.readOnly}
          aria-invalid={hasError}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={currentValue}
          aria-describedby={
            [valueId, hasError && errorId, hasHelper && helperId].filter(Boolean).join(' ') ||
            undefined
          }
          aria-required={required}
        />
        <output id={valueId} htmlFor={id} data-slider-value>
          {currentValue}
        </output>
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
