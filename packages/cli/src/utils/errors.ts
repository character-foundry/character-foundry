/**
 * Error Handling
 *
 * Format errors for CLI output and determine exit codes.
 */

import { isFoundryError } from '@character-foundry/core';
import * as output from './output.js';
import {
  EXIT_ERROR,
  EXIT_VALIDATION,
  EXIT_PARSE,
  EXIT_UNSUPPORTED,
} from './exit-codes.js';

/**
 * Get exit code from error
 */
export function getExitCode(err: unknown): number {
  if (!isFoundryError(err)) {
    return EXIT_ERROR;
  }

  switch (err.name) {
    case 'ValidationError':
      return EXIT_VALIDATION;
    case 'ParseError':
      return EXIT_PARSE;
    case 'FormatNotSupportedError':
      return EXIT_UNSUPPORTED;
    default:
      return EXIT_ERROR;
  }
}

/**
 * Format error for display
 */
export function formatError(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

/**
 * Handle error and exit
 */
export function handleError(err: unknown, opts: output.OutputOptions = {}): never {
  const code = getExitCode(err);
  const message = formatError(err);

  if (opts.json) {
    output.json({
      success: false,
      error: message,
      code,
    });
  } else {
    output.error(message);
  }

  process.exit(code);
}
