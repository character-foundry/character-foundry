import type { z } from 'zod';
import { Registry } from './base-registry';
import type { UIHints } from '../types/ui-hints';

/**
 * A provider definition that can be registered.
 * Providers are services like LLM backends, storage adapters, etc.
 *
 * @template TConfig - Zod object schema type for the provider config
 * @template TClient - Type of the client/service instance created by the provider
 */
export interface Provider<
  TConfig extends z.ZodObject<z.ZodRawShape> = z.ZodObject<z.ZodRawShape>,
  TClient = unknown,
> {
  /** Unique identifier for the provider */
  id: string;

  /** Display name for the provider */
  name: string;

  /** Optional description */
  description?: string;

  /** Icon identifier or URL */
  icon?: string;

  /** Zod schema defining the configuration shape */
  configSchema: TConfig;

  /** Default configuration values */
  defaultConfig?: z.infer<TConfig>;

  /** UI hints for customizing config form rendering */
  uiHints?: UIHints<z.infer<TConfig>>;

  /** Factory function to create the client/service instance */
  createClient: (config: z.infer<TConfig>) => TClient | Promise<TClient>;

  /** Optional validation beyond Zod schema (e.g., API key verification) */
  validateConfig?: (
    config: z.infer<TConfig>
  ) => Promise<{ valid: boolean; error?: string }>;
}

/**
 * Registry for providers of a specific type.
 * Use separate instances for different provider types (LLM, Storage, etc.).
 *
 * @template TClient - Common client interface type for this registry
 */
export class ProviderRegistry<TClient = unknown> extends Registry<
  string,
  Provider<z.ZodObject<z.ZodRawShape>, TClient>
> {
  constructor(private readonly providerType?: string) {
    super();
  }

  /**
   * Register a provider.
   */
  registerProvider<T extends z.ZodObject<z.ZodRawShape>>(
    provider: Provider<T, TClient>
  ): void {
    // Cast through unknown to handle generic type variance
    super.register(
      provider.id,
      provider as unknown as Provider<z.ZodObject<z.ZodRawShape>, TClient>
    );
  }

  /**
   * Get a provider by ID with proper typing.
   */
  getProvider<T extends z.ZodObject<z.ZodRawShape>>(
    id: string
  ): Provider<T, TClient> | undefined {
    return this.get(id) as Provider<T, TClient> | undefined;
  }

  /**
   * Create a client instance for a provider.
   * Validates config against schema and runs custom validation if provided.
   *
   * @throws Error if provider not found, config invalid, or custom validation fails
   */
  async createClient<T extends z.ZodObject<z.ZodRawShape>>(
    providerId: string,
    config: z.infer<T>
  ): Promise<TClient> {
    const provider = this.get(providerId);
    if (!provider) {
      throw new Error(
        `Provider "${providerId}" not found${this.providerType ? ` in ${this.providerType} registry` : ''}`
      );
    }

    // Validate config against schema
    const result = provider.configSchema.safeParse(config);
    if (!result.success) {
      throw new Error(`Invalid provider config: ${result.error.message}`);
    }

    // Run custom validation if provided
    if (provider.validateConfig) {
      const validation = await provider.validateConfig(result.data);
      if (!validation.valid) {
        throw new Error(validation.error ?? 'Provider config validation failed');
      }
    }

    return provider.createClient(result.data);
  }

  /**
   * Get all providers as an array.
   */
  getAllProviders(): Provider<z.ZodObject<z.ZodRawShape>, TClient>[] {
    return Array.from(this.getAll().values());
  }
}

/**
 * Create a typed provider registry for a specific client type.
 */
export function createProviderRegistry<TClient>(
  providerType?: string
): ProviderRegistry<TClient> {
  return new ProviderRegistry<TClient>(providerType);
}
