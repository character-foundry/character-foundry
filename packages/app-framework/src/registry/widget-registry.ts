import type { ComponentType } from 'react';
import { Registry } from './base-registry';
import type { BuiltinWidget, FieldWidgetProps } from '../types/ui-hints';

/**
 * Widget component type for the registry.
 */
export type WidgetComponent = ComponentType<FieldWidgetProps<unknown>>;

/**
 * Widget definition for registration.
 */
export interface WidgetDefinition {
  /** Unique identifier for the widget */
  id: string;

  /** Display name */
  name?: string;

  /** The React component to render */
  component: WidgetComponent;

  /** Description of when to use this widget */
  description?: string;
}

/**
 * Registry for custom form widgets.
 * Allows extensions to add custom field rendering components.
 */
export class WidgetRegistry extends Registry<string, WidgetDefinition> {
  /**
   * Register a custom widget.
   */
  registerWidget(definition: WidgetDefinition): void {
    super.register(definition.id, definition);
  }

  /**
   * Register a widget component directly with just an ID.
   */
  registerComponent(id: string, component: WidgetComponent): void {
    super.register(id, { id, component });
  }

  /**
   * Get a widget component by ID.
   * Returns the component directly, not the definition.
   */
  getComponent(id: string): WidgetComponent | undefined {
    return this.get(id)?.component;
  }

  /**
   * Check if a widget ID is a built-in widget type.
   */
  isBuiltinWidget(id: string): id is BuiltinWidget {
    const builtins: string[] = [
      'text',
      'number',
      'password',
      'textarea',
      'switch',
      'checkbox',
      'select',
      'radio',
      'slider',
      'color-picker',
      'tag-input',
    ];
    return builtins.includes(id);
  }
}

/**
 * Default widget registry instance.
 */
export const widgetRegistry = new WidgetRegistry();
