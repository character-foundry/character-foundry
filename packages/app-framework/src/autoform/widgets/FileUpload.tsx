import { useState, useCallback, useRef, type ChangeEvent, type DragEvent } from 'react';
import type { FieldWidgetProps } from '../../types/ui-hints';

/**
 * File or array of files depending on `multiple` hint.
 */
export type FileUploadValue = File | File[] | null;

/**
 * Headless file upload widget with drag-and-drop support.
 *
 * @example
 * ```tsx
 * // Single file
 * <AutoForm
 *   schema={z.object({ avatar: z.instanceof(File).optional() })}
 *   uiHints={{ avatar: { widget: 'file-upload', accept: 'image/*' } }}
 * />
 *
 * // Multiple files
 * <AutoForm
 *   schema={z.object({ attachments: z.array(z.instanceof(File)) })}
 *   uiHints={{ attachments: { widget: 'file-upload', multiple: true, accept: '.pdf,.doc' } }}
 * />
 * ```
 */
export function FileUpload({
  value,
  onChange,
  name,
  label,
  error,
  disabled,
  required,
  hint,
}: FieldWidgetProps<FileUploadValue>) {
  const id = `field-${name}`;
  const errorId = `${id}-error`;
  const helperId = `${id}-helper`;
  const _hasError = Boolean(error);
  const hasHelper = Boolean(hint?.helperText);

  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const accept = hint?.accept;
  const multiple = hint?.multiple ?? false;
  const maxSize = hint?.maxSize;

  const validateFiles = useCallback(
    (files: File[]): { valid: File[]; errors: string[] } => {
      const valid: File[] = [];
      const errors: string[] = [];

      for (const file of files) {
        // Check file size
        if (maxSize && file.size > maxSize) {
          const maxMB = (maxSize / 1024 / 1024).toFixed(1);
          errors.push(`${file.name} exceeds ${maxMB}MB limit`);
          continue;
        }

        // Check file type (basic validation)
        if (accept) {
          const acceptedTypes = accept.split(',').map((t) => t.trim());
          const fileExt = `.${file.name.split('.').pop()?.toLowerCase()}`;
          const fileMime = file.type;

          const isAccepted = acceptedTypes.some((type) => {
            if (type.startsWith('.')) {
              return fileExt === type.toLowerCase();
            }
            if (type.endsWith('/*')) {
              return fileMime.startsWith(type.replace('/*', '/'));
            }
            return fileMime === type;
          });

          if (!isAccepted) {
            errors.push(`${file.name} is not an accepted file type`);
            continue;
          }
        }

        valid.push(file);
      }

      return { valid, errors };
    },
    [accept, maxSize]
  );

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) {
        onChange(multiple ? [] : null);
        setLocalError(null);
        return;
      }

      const fileArray = Array.from(files);
      const { valid, errors } = validateFiles(fileArray);

      if (errors.length > 0) {
        setLocalError(errors.join(', '));
      } else {
        setLocalError(null);
      }

      if (valid.length === 0) {
        onChange(multiple ? [] : null);
        return;
      }

      if (multiple) {
        onChange(valid);
      } else {
        const firstFile = valid[0];
        onChange(firstFile ?? null);
      }
    },
    [multiple, onChange, validateFiles]
  );

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      handleFiles(e.target.files);
    },
    [handleFiles]
  );

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (disabled || hint?.readOnly) return;

      handleFiles(e.dataTransfer.files);
    },
    [disabled, handleFiles, hint?.readOnly]
  );

  const handleClick = useCallback(() => {
    if (!disabled && !hint?.readOnly) {
      inputRef.current?.click();
    }
  }, [disabled, hint?.readOnly]);

  const handleRemove = useCallback(
    (index?: number) => {
      if (multiple && Array.isArray(value)) {
        if (index !== undefined) {
          const newFiles = value.filter((_, i) => i !== index);
          onChange(newFiles);
        } else {
          onChange([]);
        }
      } else {
        onChange(null);
      }
      setLocalError(null);

      // Reset input
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    },
    [multiple, onChange, value]
  );

  const displayError = error ?? localError;

  // Get display value
  const files = multiple
    ? Array.isArray(value)
      ? value
      : []
    : value instanceof File
      ? [value]
      : [];

  return (
    <div className={hint?.className} data-field={name} data-error={Boolean(displayError)}>
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

      <div
        data-file-dropzone
        data-dragging={isDragging}
        data-disabled={disabled || hint?.readOnly}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-describedby={
          [Boolean(displayError) && errorId, hasHelper && helperId].filter(Boolean).join(' ') ||
          undefined
        }
      >
        <input
          ref={inputRef}
          id={id}
          type="file"
          name={name}
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          onChange={handleChange}
          aria-invalid={Boolean(displayError)}
          aria-required={required}
          data-file-input
        />

        {files.length === 0 ? (
          <p data-file-placeholder>
            {hint?.placeholder ?? (isDragging ? 'Drop files here...' : 'Click or drag files to upload')}
          </p>
        ) : (
          <ul data-file-list>
            {files.map((file, index) => (
              <li key={`${file.name}-${index}`} data-file-item>
                <span data-file-name>{file.name}</span>
                <span data-file-size>({formatFileSize(file.size)})</span>
                {!disabled && !hint?.readOnly && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(multiple ? index : undefined);
                    }}
                    aria-label={`Remove ${file.name}`}
                    data-file-remove
                  >
                    &times;
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {hasHelper && (
        <p id={helperId} data-helper>
          {hint?.helperText}
        </p>
      )}
      {displayError && (
        <p id={errorId} role="alert" data-error-message>
          {displayError}
        </p>
      )}
    </div>
  );
}

/**
 * Format file size in human-readable format.
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
