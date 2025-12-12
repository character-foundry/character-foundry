import { useState, useCallback, useRef, useEffect, type ChangeEvent, type KeyboardEvent } from 'react';
import type { FieldWidgetProps } from '../../types/ui-hints';

interface Option {
  value: string;
  label: string;
}

/**
 * Headless searchable select widget.
 * Renders a select with search/filter functionality for large option lists.
 *
 * @example
 * ```tsx
 * // Via uiHints
 * <AutoForm
 *   schema={z.object({ country: z.enum([...countries]) })}
 *   uiHints={{
 *     country: {
 *       widget: 'searchable-select',
 *       searchPlaceholder: 'Search countries...',
 *       noResultsText: 'No countries found',
 *     }
 *   }}
 * />
 * ```
 */
export function SearchableSelect({
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
  const listboxId = `${id}-listbox`;
  const hasError = Boolean(error);
  const hasHelper = Boolean(hint?.helperText);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const options: Option[] = hint?.options ?? [];

  // Filter options based on search term
  const filteredOptions = searchTerm
    ? options.filter(
        (opt) =>
          opt.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
          opt.value.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : options;

  // Get display label for current value
  const selectedOption = options.find((opt) => opt.value === value);
  const displayValue = selectedOption?.label ?? value ?? '';

  // Handle click outside to close
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll highlighted option into view
  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && listRef.current) {
      const item = listRef.current.children[highlightedIndex] as HTMLElement | undefined;
      item?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex, isOpen]);

  const handleOpen = useCallback(() => {
    if (!disabled && !hint?.readOnly) {
      setIsOpen(true);
      setSearchTerm('');
      setHighlightedIndex(-1);
      // Focus search input after opening
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [disabled, hint?.readOnly]);

  const handleSelect = useCallback(
    (optionValue: string) => {
      onChange(optionValue);
      setIsOpen(false);
      setSearchTerm('');
    },
    [onChange]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (disabled || hint?.readOnly) return;

      switch (e.key) {
        case 'Enter':
          e.preventDefault();
          if (!isOpen) {
            handleOpen();
          } else if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
            handleSelect(filteredOptions[highlightedIndex].value);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          setSearchTerm('');
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (!isOpen) {
            handleOpen();
          } else {
            setHighlightedIndex((prev) =>
              prev < filteredOptions.length - 1 ? prev + 1 : 0
            );
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (isOpen) {
            setHighlightedIndex((prev) =>
              prev > 0 ? prev - 1 : filteredOptions.length - 1
            );
          }
          break;
        case 'Home':
          if (isOpen) {
            e.preventDefault();
            setHighlightedIndex(0);
          }
          break;
        case 'End':
          if (isOpen) {
            e.preventDefault();
            setHighlightedIndex(filteredOptions.length - 1);
          }
          break;
      }
    },
    [disabled, filteredOptions, handleOpen, handleSelect, highlightedIndex, hint?.readOnly, isOpen]
  );

  const handleSearchChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setHighlightedIndex(-1);
  }, []);

  const noResultsText = hint?.noResultsText ?? 'No results found';
  const searchPlaceholder = hint?.searchPlaceholder ?? 'Search...';

  return (
    <div
      ref={containerRef}
      className={hint?.className}
      data-field={name}
      data-error={hasError}
      onKeyDown={handleKeyDown}
    >
      {label && (
        <label id={`${id}-label`}>
          {label}
          {required && (
            <span aria-hidden="true" data-required>
              *
            </span>
          )}
        </label>
      )}

      <div data-searchable-select data-open={isOpen} data-disabled={disabled || hint?.readOnly}>
        {/* Trigger button */}
        <button
          type="button"
          id={id}
          onClick={handleOpen}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-labelledby={`${id}-label`}
          aria-describedby={
            [hasError && errorId, hasHelper && helperId].filter(Boolean).join(' ') || undefined
          }
          aria-invalid={hasError}
          data-searchable-select-trigger
        >
          <span data-searchable-select-value>
            {displayValue || hint?.placeholder || 'Select...'}
          </span>
          <span data-searchable-select-arrow aria-hidden="true">
            {isOpen ? '\u25B2' : '\u25BC'}
          </span>
        </button>

        {/* Dropdown */}
        {isOpen && (
          <div data-searchable-select-dropdown>
            {/* Search input */}
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder={searchPlaceholder}
              aria-label="Search options"
              data-searchable-select-input
            />

            {/* Options list */}
            <ul
              ref={listRef}
              id={listboxId}
              role="listbox"
              aria-labelledby={`${id}-label`}
              data-searchable-select-list
            >
              {filteredOptions.length === 0 ? (
                <li data-searchable-select-no-results>{noResultsText}</li>
              ) : (
                filteredOptions.map((option, index) => (
                  <li
                    key={option.value}
                    role="option"
                    aria-selected={option.value === value}
                    data-searchable-select-option
                    data-selected={option.value === value}
                    data-highlighted={index === highlightedIndex}
                    onClick={() => handleSelect(option.value)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                  >
                    {option.label}
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
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
