/**
 * Validation Utilities
 *
 * Helper functions for Zod validation with Foundry error integration.
 */

import { z } from 'zod';

/**
 * Convert Zod error to human-readable message
 */
export function zodErrorToMessage(zodError: z.ZodError, context?: string): string {
  const messages = zodError.errors.map((err) => {
    const path = err.path.length > 0 ? `${err.path.join('.')}: ` : '';
    return `${path}${err.message}`;
  });

  const message = messages.join('; ');
  return context ? `${context} - ${message}` : message;
}

/**
 * Get the first error field from Zod error
 */
export function getFirstErrorField(zodError: z.ZodError): string | undefined {
  return zodError.errors[0]?.path[0]?.toString();
}

/**
 * Safe parse with detailed error information
 */
export function safeParse<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string; field?: string } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    error: zodErrorToMessage(result.error),
    field: getFirstErrorField(result.error),
  };
}
