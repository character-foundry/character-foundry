/**
 * Error Classes
 *
 * Specific error types for character card operations.
 * All errors extend FoundryError for consistent handling.
 */

/** Symbol to identify FoundryError instances across ESM/CJS boundaries */
const FOUNDRY_ERROR_MARKER = Symbol.for('@character-foundry/core:FoundryError');

/**
 * Base error class for all Character Foundry errors
 */
export class FoundryError extends Error {
  /** @internal Marker for cross-module identification */
  readonly [FOUNDRY_ERROR_MARKER] = true;

  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'FoundryError';
    // Maintains proper stack trace in V8 environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Error during card parsing
 */
export class ParseError extends FoundryError {
  constructor(message: string, public readonly format?: string) {
    super(message, 'PARSE_ERROR');
    this.name = 'ParseError';
  }
}

/**
 * Error during card validation
 */
export class ValidationError extends FoundryError {
  constructor(message: string, public readonly field?: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

/**
 * Asset not found in card or archive
 */
export class AssetNotFoundError extends FoundryError {
  constructor(public readonly uri: string) {
    super(`Asset not found: ${uri}`, 'ASSET_NOT_FOUND');
    this.name = 'AssetNotFoundError';
  }
}

/**
 * Format not supported for operation
 */
export class FormatNotSupportedError extends FoundryError {
  constructor(public readonly format: string, operation?: string) {
    const msg = operation
      ? `Format '${format}' not supported for ${operation}`
      : `Format not supported: ${format}`;
    super(msg, 'FORMAT_NOT_SUPPORTED');
    this.name = 'FormatNotSupportedError';
  }
}

/**
 * File size exceeds limits
 */
export class SizeLimitError extends FoundryError {
  constructor(
    public readonly actualSize: number,
    public readonly maxSize: number,
    context?: string
  ) {
    const actualMB = (actualSize / 1024 / 1024).toFixed(2);
    const maxMB = (maxSize / 1024 / 1024).toFixed(2);
    const msg = context
      ? `${context}: Size ${actualMB}MB exceeds limit ${maxMB}MB`
      : `Size ${actualMB}MB exceeds limit ${maxMB}MB`;
    super(msg, 'SIZE_LIMIT_EXCEEDED');
    this.name = 'SizeLimitError';
  }
}

/**
 * Path traversal or unsafe path detected
 */
export class PathTraversalError extends FoundryError {
  constructor(public readonly path: string) {
    super(`Unsafe path detected: ${path}`, 'PATH_TRAVERSAL');
    this.name = 'PathTraversalError';
  }
}

/**
 * Export operation would lose data
 */
export class DataLossError extends FoundryError {
  constructor(
    public readonly lostFields: string[],
    public readonly targetFormat: string
  ) {
    const fields = lostFields.slice(0, 3).join(', ');
    const more = lostFields.length > 3 ? ` and ${lostFields.length - 3} more` : '';
    super(
      `Export to ${targetFormat} would lose: ${fields}${more}`,
      'DATA_LOSS'
    );
    this.name = 'DataLossError';
  }
}

/**
 * Check if an error is a FoundryError
 *
 * Uses Symbol.for() marker instead of instanceof to handle dual ESM/CJS package loading.
 * In dual-package environments, instanceof can fail if the error comes from a different
 * module instance (e.g., ESM vs CJS version of the same package). Symbol.for() creates
 * a global symbol shared across all module instances.
 */
export function isFoundryError(error: unknown): error is FoundryError {
  return (
    error instanceof Error &&
    FOUNDRY_ERROR_MARKER in error &&
    (error as Record<symbol, unknown>)[FOUNDRY_ERROR_MARKER] === true
  );
}

/**
 * Wrap unknown errors in a FoundryError
 */
export function wrapError(error: unknown, context?: string): FoundryError {
  if (isFoundryError(error)) {
    return error;
  }

  const message = error instanceof Error
    ? error.message
    : String(error);

  return new FoundryError(
    context ? `${context}: ${message}` : message,
    'UNKNOWN_ERROR'
  );
}
