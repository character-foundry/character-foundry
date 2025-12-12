import type { z } from 'zod';
import type { ExtensionContext } from './context';

/**
 * Base extension interface - all modular pieces implement this.
 * Extensions are the building blocks of the plugin system.
 *
 * @template TConfig - Zod schema type for the configuration
 */
export interface Extension<TConfig extends z.ZodType = z.ZodType> {
  /** Unique identifier, e.g., "com.foundry.openai" */
  id: string;

  /** Human-readable name, e.g., "OpenAI Provider" */
  name: string;

  /** SemVer version string */
  version: string;

  /** Zod schema defining the configuration shape (source of truth) */
  configSchema: TConfig;

  /** Default configuration values */
  defaultConfig?: z.infer<TConfig>;

  /** Called when extension is activated */
  onActivate?: (
    context: ExtensionContext<z.infer<TConfig>>
  ) => void | Promise<void>;

  /** Called when extension is deactivated */
  onDeactivate?: () => void | Promise<void>;
}

/**
 * Extension state during runtime
 */
export interface ExtensionState<TConfig = unknown> {
  /** The extension definition */
  extension: Extension<z.ZodType<TConfig>>;

  /** Whether the extension is currently active */
  active: boolean;

  /** Current validated configuration */
  config: TConfig;

  /** Error message if extension failed to activate */
  error?: string;
}
