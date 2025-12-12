import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { Registry } from '../registry/base-registry';
import { SettingsRegistry, type SettingsPanel } from '../registry/settings-registry';
import { ProviderRegistry, type Provider } from '../registry/provider-registry';
import { WidgetRegistry } from '../registry/widget-registry';

describe('Registry', () => {
  it('registers and retrieves items', () => {
    const registry = new Registry<string, { value: number }>();

    registry.register('test', { value: 42 });

    expect(registry.get('test')).toEqual({ value: 42 });
    expect(registry.has('test')).toBe(true);
    expect(registry.size).toBe(1);
  });

  it('unregisters items', () => {
    const registry = new Registry<string, string>();

    registry.register('test', 'value');
    expect(registry.has('test')).toBe(true);

    const removed = registry.unregister('test');
    expect(removed).toBe(true);
    expect(registry.has('test')).toBe(false);
  });

  it('returns false when unregistering non-existent item', () => {
    const registry = new Registry<string, string>();

    expect(registry.unregister('nonexistent')).toBe(false);
  });

  it('gets all items', () => {
    const registry = new Registry<string, number>();

    registry.register('a', 1);
    registry.register('b', 2);

    const all = registry.getAll();
    expect(all.size).toBe(2);
    expect(all.get('a')).toBe(1);
    expect(all.get('b')).toBe(2);
  });

  it('gets all IDs', () => {
    const registry = new Registry<string, number>();

    registry.register('a', 1);
    registry.register('b', 2);

    expect(registry.getAllIds()).toEqual(['a', 'b']);
  });

  it('notifies listeners on register', () => {
    const registry = new Registry<string, number>();
    const listener = vi.fn();

    registry.subscribe(listener);
    registry.register('test', 42);

    expect(listener).toHaveBeenCalledWith('test', 42, 'register');
  });

  it('notifies listeners on unregister', () => {
    const registry = new Registry<string, number>();
    const listener = vi.fn();

    registry.register('test', 42);
    registry.subscribe(listener);
    registry.unregister('test');

    expect(listener).toHaveBeenCalledWith('test', null, 'unregister');
  });

  it('unsubscribes listeners', () => {
    const registry = new Registry<string, number>();
    const listener = vi.fn();

    const unsubscribe = registry.subscribe(listener);
    unsubscribe();
    registry.register('test', 42);

    expect(listener).not.toHaveBeenCalled();
  });

  it('clears all items', () => {
    const registry = new Registry<string, number>();
    const listener = vi.fn();

    registry.register('a', 1);
    registry.register('b', 2);
    registry.subscribe(listener);
    registry.clear();

    expect(registry.size).toBe(0);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('filters items', () => {
    const registry = new Registry<string, number>();

    registry.register('a', 1);
    registry.register('b', 2);
    registry.register('c', 3);

    const filtered = registry.filter((item) => item > 1);
    expect(filtered).toEqual([2, 3]);
  });

  it('warns on overwrite', () => {
    const registry = new Registry<string, number>();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    registry.register('test', 1);
    registry.register('test', 2);

    expect(warnSpy).toHaveBeenCalledWith(
      'Registry: Overwriting existing item with id "test"'
    );
    expect(registry.get('test')).toBe(2);

    warnSpy.mockRestore();
  });
});

describe('SettingsRegistry', () => {
  it('registers settings panels', () => {
    const registry = new SettingsRegistry();
    const panel: SettingsPanel = {
      id: 'editor',
      title: 'Editor Settings',
      schema: z.object({ fontSize: z.number() }),
    };

    registry.registerPanel(panel);

    expect(registry.has('editor')).toBe(true);
    expect(registry.getPanel('editor')?.title).toBe('Editor Settings');
  });

  it('sorts panels by order', () => {
    const registry = new SettingsRegistry();

    registry.registerPanel({
      id: 'c',
      title: 'C',
      schema: z.object({}),
      order: 30,
    });
    registry.registerPanel({
      id: 'a',
      title: 'A',
      schema: z.object({}),
      order: 10,
    });
    registry.registerPanel({
      id: 'b',
      title: 'B',
      schema: z.object({}),
      order: 20,
    });

    const sorted = registry.getSortedPanels();
    expect(sorted.map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });

  it('excludes hidden panels from sorted list', () => {
    const registry = new SettingsRegistry();

    registry.registerPanel({
      id: 'visible',
      title: 'Visible',
      schema: z.object({}),
    });
    registry.registerPanel({
      id: 'hidden',
      title: 'Hidden',
      schema: z.object({}),
      hidden: true,
    });

    const sorted = registry.getSortedPanels();
    expect(sorted.length).toBe(1);
    expect(sorted[0].id).toBe('visible');
  });
});

describe('ProviderRegistry', () => {
  it('registers providers', () => {
    const registry = new ProviderRegistry<{ call: () => void }>();
    const provider: Provider<z.ZodObject<{ apiKey: z.ZodString }>, { call: () => void }> = {
      id: 'openai',
      name: 'OpenAI',
      configSchema: z.object({ apiKey: z.string() }),
      createClient: (config) => ({ call: () => console.log(config.apiKey) }),
    };

    registry.registerProvider(provider);

    expect(registry.has('openai')).toBe(true);
    expect(registry.getProvider('openai')?.name).toBe('OpenAI');
  });

  it('creates client with valid config', async () => {
    const registry = new ProviderRegistry<{ value: string }>();

    registry.registerProvider({
      id: 'test',
      name: 'Test',
      configSchema: z.object({ key: z.string() }),
      createClient: (config) => ({ value: config.key }),
    });

    const client = await registry.createClient('test', { key: 'secret' });
    expect(client.value).toBe('secret');
  });

  it('throws on invalid config', async () => {
    const registry = new ProviderRegistry();

    registry.registerProvider({
      id: 'test',
      name: 'Test',
      configSchema: z.object({ key: z.string().min(1) }),
      createClient: () => ({}),
    });

    await expect(registry.createClient('test', { key: '' })).rejects.toThrow(
      'Invalid provider config'
    );
  });

  it('throws on missing provider', async () => {
    const registry = new ProviderRegistry();

    await expect(registry.createClient('nonexistent', {})).rejects.toThrow(
      'Provider "nonexistent" not found'
    );
  });

  it('runs custom validation', async () => {
    const registry = new ProviderRegistry();

    registry.registerProvider({
      id: 'test',
      name: 'Test',
      configSchema: z.object({ key: z.string() }),
      createClient: () => ({}),
      validateConfig: async (config) => ({
        valid: config.key === 'valid',
        error: 'Invalid key',
      }),
    });

    await expect(registry.createClient('test', { key: 'invalid' })).rejects.toThrow(
      'Invalid key'
    );
  });

  it('gets all providers', () => {
    const registry = new ProviderRegistry();

    registry.registerProvider({
      id: 'a',
      name: 'A',
      configSchema: z.object({}),
      createClient: () => ({}),
    });
    registry.registerProvider({
      id: 'b',
      name: 'B',
      configSchema: z.object({}),
      createClient: () => ({}),
    });

    expect(registry.getAllProviders().length).toBe(2);
  });
});

describe('WidgetRegistry', () => {
  it('registers widget definitions', () => {
    const registry = new WidgetRegistry();
    const TestWidget = () => null;

    registry.registerWidget({
      id: 'test',
      name: 'Test Widget',
      component: TestWidget,
    });

    expect(registry.has('test')).toBe(true);
    expect(registry.getComponent('test')).toBe(TestWidget);
  });

  it('registers components directly', () => {
    const registry = new WidgetRegistry();
    const TestWidget = () => null;

    registry.registerComponent('test', TestWidget);

    expect(registry.getComponent('test')).toBe(TestWidget);
  });

  it('identifies builtin widgets', () => {
    const registry = new WidgetRegistry();

    expect(registry.isBuiltinWidget('text')).toBe(true);
    expect(registry.isBuiltinWidget('number')).toBe(true);
    expect(registry.isBuiltinWidget('switch')).toBe(true);
    expect(registry.isBuiltinWidget('custom')).toBe(false);
  });
});
