/**
 * HTTP Platform Adapter
 *
 * Adapter for platforms accessible via HTTP API.
 */

import type { CCv3Data } from '@character-foundry/schemas';
import type { PlatformId } from '../types.js';
import { BasePlatformAdapter, type AdapterCard, type AdapterAsset } from './base.js';

/**
 * HTTP fetch function type
 */
export type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * HTTP adapter configuration
 */
export interface HttpAdapterConfig {
  /** Platform ID */
  platform: PlatformId;
  /** Display name */
  displayName: string;
  /** Base URL of the API */
  baseUrl: string;
  /** API endpoints */
  endpoints: {
    /** List cards: GET */
    list: string;
    /** Get card: GET (append /:id) */
    get: string;
    /** Create card: POST */
    create: string;
    /** Update card: PUT/PATCH (append /:id) */
    update: string;
    /** Delete card: DELETE (append /:id) */
    delete: string;
    /** Get assets: GET (append /:id) */
    assets?: string;
    /** Health check: GET */
    health?: string;
  };
  /** Authentication header */
  auth?: {
    type: 'bearer' | 'api-key' | 'basic';
    token: string;
    header?: string; // Custom header name for api-key
  };
  /** Custom fetch function (for Node.js or testing) */
  fetch?: FetchFn;
  /** Response transformers */
  transformers?: {
    /** Transform list response to AdapterCard[] */
    list?: (response: unknown) => AdapterCard[];
    /** Transform get response to CCv3Data */
    get?: (response: unknown) => CCv3Data;
    /** Transform card to create request body */
    create?: (card: CCv3Data) => unknown;
    /** Transform card to update request body */
    update?: (card: CCv3Data) => unknown;
    /** Extract ID from create response */
    extractId?: (response: unknown) => string;
  };
}

/**
 * HTTP-based platform adapter
 */
export class HttpPlatformAdapter extends BasePlatformAdapter {
  readonly platform: PlatformId;
  readonly displayName: string;

  private config: HttpAdapterConfig;
  private fetchFn: FetchFn;

  constructor(config: HttpAdapterConfig) {
    super();
    this.platform = config.platform;
    this.displayName = config.displayName;
    this.config = config;
    this.fetchFn = config.fetch || globalThis.fetch.bind(globalThis);
  }

  /**
   * Build headers for requests
   */
  private buildHeaders(contentType?: string): Record<string, string> {
    const headers: Record<string, string> = {};

    if (contentType) {
      headers['Content-Type'] = contentType;
    }

    if (this.config.auth) {
      switch (this.config.auth.type) {
        case 'bearer':
          headers['Authorization'] = `Bearer ${this.config.auth.token}`;
          break;
        case 'api-key':
          headers[this.config.auth.header || 'X-API-Key'] = this.config.auth.token;
          break;
        case 'basic':
          headers['Authorization'] = `Basic ${this.config.auth.token}`;
          break;
      }
    }

    return headers;
  }

  /**
   * Build full URL
   */
  private buildUrl(endpoint: string, id?: string): string {
    let url = `${this.config.baseUrl}${endpoint}`;
    if (id) {
      url = `${url}/${id}`;
    }
    return url;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const endpoint = this.config.endpoints.health || this.config.endpoints.list;
      const response = await this.fetchFn(
        this.buildUrl(endpoint),
        {
          method: 'GET',
          headers: this.buildHeaders(),
        }
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  async getCard(localId: string): Promise<CCv3Data | null> {
    try {
      const response = await this.fetchFn(
        this.buildUrl(this.config.endpoints.get, localId),
        {
          method: 'GET',
          headers: this.buildHeaders(),
        }
      );

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return this.config.transformers?.get
        ? this.config.transformers.get(data)
        : data as CCv3Data;
    } catch (err) {
      console.error(`Failed to get card ${localId}:`, err);
      return null;
    }
  }

  async listCards(options?: {
    limit?: number;
    offset?: number;
    since?: string;
  }): Promise<AdapterCard[]> {
    const url = new URL(this.buildUrl(this.config.endpoints.list));

    if (options?.limit) {
      url.searchParams.set('limit', String(options.limit));
    }
    if (options?.offset) {
      url.searchParams.set('offset', String(options.offset));
    }
    if (options?.since) {
      url.searchParams.set('since', options.since);
    }

    const response = await this.fetchFn(
      url.toString(),
      {
        method: 'GET',
        headers: this.buildHeaders(),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return this.config.transformers?.list
      ? this.config.transformers.list(data)
      : data as AdapterCard[];
  }

  async saveCard(card: CCv3Data, localId?: string): Promise<string> {
    if (localId) {
      // Update existing
      const body = this.config.transformers?.update
        ? this.config.transformers.update(card)
        : card;

      const response = await this.fetchFn(
        this.buildUrl(this.config.endpoints.update, localId),
        {
          method: 'PUT',
          headers: this.buildHeaders('application/json'),
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return localId;
    } else {
      // Create new
      const body = this.config.transformers?.create
        ? this.config.transformers.create(card)
        : card;

      const response = await this.fetchFn(
        this.buildUrl(this.config.endpoints.create),
        {
          method: 'POST',
          headers: this.buildHeaders('application/json'),
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return this.config.transformers?.extractId
        ? this.config.transformers.extractId(data)
        : (data as { id: string }).id;
    }
  }

  async deleteCard(localId: string): Promise<boolean> {
    const response = await this.fetchFn(
      this.buildUrl(this.config.endpoints.delete, localId),
      {
        method: 'DELETE',
        headers: this.buildHeaders(),
      }
    );

    return response.ok;
  }

  async getAssets(localId: string): Promise<AdapterAsset[]> {
    if (!this.config.endpoints.assets) {
      return [];
    }

    try {
      const response = await this.fetchFn(
        this.buildUrl(this.config.endpoints.assets, localId),
        {
          method: 'GET',
          headers: this.buildHeaders(),
        }
      );

      if (!response.ok) {
        return [];
      }

      return (await response.json()) as AdapterAsset[];
    } catch {
      return [];
    }
  }

  async getLastModified(localId: string): Promise<string | null> {
    try {
      const response = await this.fetchFn(
        this.buildUrl(this.config.endpoints.get, localId),
        {
          method: 'HEAD',
          headers: this.buildHeaders(),
        }
      );

      if (!response.ok) {
        return null;
      }

      return response.headers.get('Last-Modified');
    } catch {
      return null;
    }
  }
}

/**
 * Create an HTTP adapter for Character Archive API
 */
export function createArchiveAdapter(
  baseUrl: string,
  apiKey?: string
): HttpPlatformAdapter {
  return new HttpPlatformAdapter({
    platform: 'archive',
    displayName: 'Character Archive',
    baseUrl,
    endpoints: {
      list: '/api/characters',
      get: '/api/characters',
      create: '/api/characters',
      update: '/api/characters',
      delete: '/api/characters',
      assets: '/api/characters/assets',
      health: '/api/health',
    },
    auth: apiKey ? { type: 'api-key', token: apiKey } : undefined,
    transformers: {
      list: (data) => {
        const response = data as { characters: Array<{ id: string; data: CCv3Data; updatedAt: string }> };
        return response.characters.map((c) => ({
          id: c.id,
          card: c.data,
          updatedAt: c.updatedAt,
        }));
      },
      get: (data) => (data as { data: CCv3Data }).data,
      extractId: (data) => (data as { id: string }).id,
    },
  });
}

/**
 * Create an HTTP adapter for CardsHub API
 */
export function createHubAdapter(
  baseUrl: string,
  apiKey?: string
): HttpPlatformAdapter {
  return new HttpPlatformAdapter({
    platform: 'hub',
    displayName: 'CardsHub',
    baseUrl,
    endpoints: {
      list: '/api/cards',
      get: '/api/cards',
      create: '/api/cards',
      update: '/api/cards',
      delete: '/api/cards',
      assets: '/api/cards/assets',
      health: '/api/health',
    },
    auth: apiKey ? { type: 'bearer', token: apiKey } : undefined,
  });
}
