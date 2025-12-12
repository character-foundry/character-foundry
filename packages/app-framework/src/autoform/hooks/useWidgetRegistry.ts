import { createContext, useContext } from 'react';
import { WidgetRegistry, widgetRegistry } from '../../registry/widget-registry';

/**
 * Context for providing a custom WidgetRegistry to AutoForm.
 */
export const WidgetRegistryContext = createContext<WidgetRegistry>(widgetRegistry);

/**
 * Hook to access the current WidgetRegistry.
 * Returns the default registry if not wrapped in a provider.
 */
export function useWidgetRegistry(): WidgetRegistry {
  return useContext(WidgetRegistryContext);
}
