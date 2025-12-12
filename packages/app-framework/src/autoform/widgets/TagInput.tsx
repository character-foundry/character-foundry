import { useState, useCallback, type KeyboardEvent, type ChangeEvent } from 'react';
import type { FieldWidgetProps } from '../../types/ui-hints';

/**
 * Headless tag/chip input widget.
 * Renders an input that converts text into tags on Enter/comma.
 */
export function TagInput({
  value,
  onChange,
  name,
  label,
  error,
  disabled,
  required,
  hint,
}: FieldWidgetProps<string[]>) {
  const id = `field-${name}`;
  const errorId = `${id}-error`;
  const helperId = `${id}-helper`;
  const hasError = Boolean(error);
  const hasHelper = Boolean(hint?.helperText);

  const tags = value ?? [];
  const [inputValue, setInputValue] = useState('');

  const addTag = useCallback(
    (tag: string) => {
      const trimmed = tag.trim();
      if (trimmed && !tags.includes(trimmed)) {
        onChange([...tags, trimmed]);
      }
      setInputValue('');
    },
    [tags, onChange]
  );

  const removeTag = useCallback(
    (index: number) => {
      onChange(tags.filter((_, i) => i !== index));
    },
    [tags, onChange]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        addTag(inputValue);
      } else if (e.key === 'Backspace' && inputValue === '' && tags.length > 0) {
        removeTag(tags.length - 1);
      }
    },
    [inputValue, tags, addTag, removeTag]
  );

  const handleBlur = useCallback(() => {
    if (inputValue.trim()) {
      addTag(inputValue);
    }
  }, [inputValue, addTag]);

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
      <div data-tag-container>
        {tags.map((tag, index) => (
          <span key={`${tag}-${index}`} data-tag>
            {tag}
            {!disabled && !hint?.readOnly && (
              <button
                type="button"
                onClick={() => removeTag(index)}
                aria-label={`Remove ${tag}`}
                data-tag-remove
              >
                &times;
              </button>
            )}
          </span>
        ))}
        <input
          id={id}
          type="text"
          value={inputValue}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          disabled={disabled}
          readOnly={hint?.readOnly}
          placeholder={hint?.placeholder ?? 'Add tag...'}
          aria-invalid={hasError}
          aria-describedby={
            [hasError && errorId, hasHelper && helperId].filter(Boolean).join(' ') ||
            undefined
          }
          data-tag-input
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
