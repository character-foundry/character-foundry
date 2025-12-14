/**
 * ANSI Colors
 *
 * Simple ANSI color helpers without external dependencies.
 * Respects NO_COLOR environment variable.
 */

const isColorEnabled = (): boolean => {
  if (process.env.NO_COLOR !== undefined) return false;
  if (process.env.FORCE_COLOR !== undefined) return true;
  return process.stdout.isTTY === true;
};

const colorEnabled = isColorEnabled();

const wrap = (code: string, text: string): string => {
  if (!colorEnabled) return text;
  return `\x1b[${code}m${text}\x1b[0m`;
};

// Colors
export const red = (text: string): string => wrap('31', text);
export const green = (text: string): string => wrap('32', text);
export const yellow = (text: string): string => wrap('33', text);
export const blue = (text: string): string => wrap('34', text);
export const cyan = (text: string): string => wrap('36', text);
export const gray = (text: string): string => wrap('90', text);

// Styles
export const bold = (text: string): string => wrap('1', text);
export const dim = (text: string): string => wrap('2', text);
