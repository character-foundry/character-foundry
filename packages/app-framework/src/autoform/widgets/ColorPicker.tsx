import type { ChangeEvent } from 'react';
import type { FieldWidgetProps } from '../../types/ui-hints';

/**
 * Headless color picker widget.
 * Renders a native color input with optional text input for hex values.
 */
export function ColorPicker({
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
  const textId = `${id}-text`;
  const errorId = `${id}-error`;
  const helperId = `${id}-helper`;
  const hasError = Boolean(error);
  const hasHelper = Boolean(hint?.helperText);

  // Default to black if no value
  const currentValue = value || '#000000';

  // Normalize hex color (ensure 6 digits)
  const normalizeHex = (hex: string): string => {
    // Remove # if present
    let clean = hex.replace(/^#/, '');

    // Expand shorthand (e.g., "fff" -> "ffffff")
    if (clean.length === 3) {
      clean = clean.split('').map(c => c + c).join('');
    }

    // Validate hex
    if (/^[0-9a-fA-F]{6}$/.test(clean)) {
      return `#${clean.toLowerCase()}`;
    }

    return currentValue; // Return current if invalid
  };

  return (
    <div className={hint?.className} data-field={name} data-error={hasError}>
      {label && (
        <label htmlFor={id} data-color-label>
          {label}
          {required && (
            <span aria-hidden="true" data-required>
              *
            </span>
          )}
        </label>
      )}
      <div data-color-container>
        <input
          id={id}
          type="color"
          name={name}
          value={currentValue}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
          disabled={disabled || hint?.readOnly}
          aria-invalid={hasError}
          aria-describedby={
            [hasError && errorId, hasHelper && helperId].filter(Boolean).join(' ') ||
            undefined
          }
          aria-required={required}
        />
        <input
          id={textId}
          type="text"
          value={currentValue}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            const normalized = normalizeHex(e.target.value);
            onChange(normalized);
          }}
          onBlur={(e) => {
            // Normalize on blur
            const normalized = normalizeHex(e.target.value);
            if (normalized !== e.target.value) {
              onChange(normalized);
            }
          }}
          disabled={disabled || hint?.readOnly}
          placeholder="#000000"
          pattern="^#[0-9a-fA-F]{6}$"
          maxLength={7}
          data-color-text
          aria-label={`${label} hex value`}
        />
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
