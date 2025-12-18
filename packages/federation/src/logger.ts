/**
 * Federation Logger
 *
 * Lightweight logger with configurable verbosity and a safe default (warn).
 * No external dependencies.
 */

export type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug';

export interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

const LEVELS: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

const noop = (): void => {};

export function createConsoleLogger(level: LogLevel = 'warn'): Logger {
  const severity = LEVELS[level] ?? LEVELS.warn;
  const hasConsole = typeof console !== 'undefined';
  const c = hasConsole ? console : undefined;

  const debugImpl = c?.debug ? c.debug.bind(c) : c?.log ? c.log.bind(c) : noop;
  const infoImpl = c?.info ? c.info.bind(c) : c?.log ? c.log.bind(c) : noop;
  const warnImpl = c?.warn ? c.warn.bind(c) : c?.log ? c.log.bind(c) : noop;
  const errorImpl = c?.error ? c.error.bind(c) : c?.log ? c.log.bind(c) : noop;

  return {
    debug: severity >= LEVELS.debug ? debugImpl : noop,
    info: severity >= LEVELS.info ? infoImpl : noop,
    warn: severity >= LEVELS.warn ? warnImpl : noop,
    error: severity >= LEVELS.error ? errorImpl : noop,
  };
}

let federationLogger: Logger = createConsoleLogger('warn');

export function getLogger(): Logger {
  return federationLogger;
}

export function setLogger(logger: Logger): void {
  federationLogger = logger;
}

export function setLogLevel(level: LogLevel): void {
  federationLogger = createConsoleLogger(level);
}

export function configureLogger(options?: { logger?: Logger; logLevel?: LogLevel }): void {
  if (!options) return;

  if (options.logger) {
    setLogger(options.logger);
    return;
  }

  if (options.logLevel) {
    setLogLevel(options.logLevel);
  }
}

