/**
 * Output Formatting
 *
 * Helpers for JSON and human-readable output.
 */

import * as colors from './colors.js';

export interface OutputOptions {
  json?: boolean;
  quiet?: boolean;
}

/**
 * Print to stdout
 */
export function print(message: string): void {
  console.log(message);
}

/**
 * Print to stderr
 */
export function printError(message: string): void {
  console.error(message);
}

/**
 * Print success message
 */
export function success(message: string, opts: OutputOptions = {}): void {
  if (opts.quiet) return;
  if (opts.json) return;
  print(colors.green('✓') + ' ' + message);
}

/**
 * Print error message
 */
export function error(message: string, opts: OutputOptions = {}): void {
  if (opts.json) return;
  printError(colors.red('✗') + ' ' + message);
}

/**
 * Print warning message
 */
export function warn(message: string, opts: OutputOptions = {}): void {
  if (opts.quiet) return;
  if (opts.json) return;
  print(colors.yellow('⚠') + ' ' + message);
}

/**
 * Print info message
 */
export function info(message: string, opts: OutputOptions = {}): void {
  if (opts.quiet) return;
  if (opts.json) return;
  print(colors.cyan('ℹ') + ' ' + message);
}

/**
 * Print JSON output
 */
export function json(data: unknown): void {
  print(JSON.stringify(data, null, 2));
}

/**
 * Print a labeled value
 */
export function field(label: string, value: string | number | undefined, opts: OutputOptions = {}): void {
  if (opts.quiet) return;
  if (opts.json) return;
  if (value === undefined) return;
  print(`${colors.bold(label)}: ${value}`);
}

/**
 * Print a divider line
 */
export function divider(char = '─', length = 40, opts: OutputOptions = {}): void {
  if (opts.quiet) return;
  if (opts.json) return;
  print(colors.dim(char.repeat(length)));
}

/**
 * Print a section header
 */
export function header(title: string, opts: OutputOptions = {}): void {
  if (opts.quiet) return;
  if (opts.json) return;
  print('');
  print(colors.bold(title));
  divider('─', title.length, opts);
}

/**
 * Print a bullet point
 */
export function bullet(message: string, indent = 2, opts: OutputOptions = {}): void {
  if (opts.quiet) return;
  if (opts.json) return;
  print(' '.repeat(indent) + colors.dim('•') + ' ' + message);
}

/**
 * Format file size
 */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
