import type { z } from 'zod';
import { Registry } from './base-registry';
import type { UIHints } from '../types/ui-hints';

/**
 * A settings panel definition that can be registered.
 * Settings panels appear in the application settings UI.
 *
 * @template TSchema - Zod object schema type for the settings
 */
export interface SettingsPanel<
  TSchema extends z.ZodObject<z.ZodRawShape> = z.ZodObject<z.ZodRawShape>,
> {
  /** Unique identifier for the panel */
  id: string;

  /** Display title for the panel */
  title: string;

  /** Optional description */
  description?: string;

  /** Icon identifier or URL */
  icon?: string;

  /** Zod schema defining the settings shape */
  schema: TSchema;

  /** Default values for settings */
  defaultValues?: z.infer<TSchema>;

  /** UI hints for customizing field rendering */
  uiHints?: UIHints<z.infer<TSchema>>;

  /** Order priority (lower = earlier in list) */
  order?: number;

  /** Whether this panel is hidden from the UI */
  hidden?: boolean;
}

/**
 * Registry for settings panels.
 * Allows extensions to inject settings panels into the app settings UI.
 */
export class SettingsRegistry extends Registry<string, SettingsPanel> {
  /**
   * Register a settings panel.
   */
  registerPanel<T extends z.ZodObject<z.ZodRawShape>>(
    panel: SettingsPanel<T>
  ): void {
    super.register(panel.id, panel as SettingsPanel);
  }

  /**
   * Get all panels sorted by order (lower order = earlier).
   * Hidden panels are excluded.
   */
  getSortedPanels(): SettingsPanel[] {
    return Array.from(this.getAll().values())
      .filter((panel) => !panel.hidden)
      .sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
  }

  /**
   * Get a panel by ID with proper typing.
   */
  getPanel<T extends z.ZodObject<z.ZodRawShape>>(
    id: string
  ): SettingsPanel<T> | undefined {
    return this.get(id) as SettingsPanel<T> | undefined;
  }
}

/**
 * Default settings registry instance.
 * Can be used directly or replaced with a custom instance.
 */
export const settingsRegistry = new SettingsRegistry();
