import type { RegistryListener } from '../types/registry';

/**
 * Generic registry pattern for managing registered items.
 * Provides registration, lookup, and subscription capabilities.
 *
 * @template TId - Type of the item identifier (usually string)
 * @template TItem - Type of the registered item
 */
export class Registry<TId extends string = string, TItem = unknown> {
  private items = new Map<TId, TItem>();
  private listeners = new Set<RegistryListener<TId, TItem>>();

  /**
   * Register an item with the given ID.
   * Overwrites existing item with same ID (with warning).
   */
  register(id: TId, item: TItem): void {
    if (this.items.has(id)) {
      console.warn(`Registry: Overwriting existing item with id "${id}"`);
    }
    this.items.set(id, item);
    this.notify(id, item, 'register');
  }

  /**
   * Unregister an item by ID.
   * @returns true if item existed and was removed
   */
  unregister(id: TId): boolean {
    const existed = this.items.delete(id);
    if (existed) {
      this.notify(id, null, 'unregister');
    }
    return existed;
  }

  /**
   * Get an item by ID.
   * @returns The item or undefined if not found
   */
  get(id: TId): TItem | undefined {
    return this.items.get(id);
  }

  /**
   * Check if an item with the given ID exists.
   */
  has(id: TId): boolean {
    return this.items.has(id);
  }

  /**
   * Get all registered items as a Map.
   * Returns a copy to prevent external modification.
   */
  getAll(): Map<TId, TItem> {
    return new Map(this.items);
  }

  /**
   * Get all registered item IDs.
   */
  getAllIds(): TId[] {
    return Array.from(this.items.keys());
  }

  /**
   * Get the number of registered items.
   */
  get size(): number {
    return this.items.size;
  }

  /**
   * Subscribe to registry changes.
   * @returns Unsubscribe function
   */
  subscribe(listener: RegistryListener<TId, TItem>): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Clear all registered items.
   * Notifies listeners for each removed item.
   */
  clear(): void {
    const ids = this.getAllIds();
    this.items.clear();
    ids.forEach((id) => this.notify(id, null, 'unregister'));
  }

  /**
   * Iterate over all items.
   */
  forEach(callback: (item: TItem, id: TId) => void): void {
    this.items.forEach((item, id) => callback(item, id));
  }

  /**
   * Find items matching a predicate.
   */
  filter(predicate: (item: TItem, id: TId) => boolean): TItem[] {
    const results: TItem[] = [];
    this.items.forEach((item, id) => {
      if (predicate(item, id)) {
        results.push(item);
      }
    });
    return results;
  }

  private notify(
    id: TId,
    item: TItem | null,
    action: 'register' | 'unregister'
  ): void {
    this.listeners.forEach((listener) => listener(id, item, action));
  }
}
