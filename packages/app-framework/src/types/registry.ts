/**
 * Listener function type for registry changes
 */
export type RegistryListener<TId, TItem> = (
  id: TId,
  item: TItem | null,
  action: 'register' | 'unregister'
) => void;

/**
 * Base options for registry items
 */
export interface RegistryItemBase {
  /** Unique identifier */
  id: string;

  /** Human-readable name */
  name?: string;

  /** Description */
  description?: string;

  /** Icon identifier or URL */
  icon?: string;

  /** Order priority (lower = earlier) */
  order?: number;
}
