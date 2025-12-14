/**
 * Exit Codes
 *
 * Standard exit codes for CLI commands.
 */

/** Success - operation completed successfully */
export const EXIT_SUCCESS = 0;

/** General error - IO errors, unexpected failures */
export const EXIT_ERROR = 1;

/** Validation error - schema validation failed */
export const EXIT_VALIDATION = 2;

/** Parse error - could not parse file */
export const EXIT_PARSE = 3;

/** Unsupported format - format not supported for operation */
export const EXIT_UNSUPPORTED = 4;
