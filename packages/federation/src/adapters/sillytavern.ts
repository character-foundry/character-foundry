/**
 * SillyTavern Platform Adapter
 *
 * Adapter for SillyTavern integration via plugin.
 * This provides the interface that a SillyTavern plugin would implement.
 */

import type { CCv3Data } from '@character-foundry/schemas';
import type { PlatformId } from '../types.js';
import { BasePlatformAdapter, type AdapterCard, type AdapterAsset } from './base.js';

/**
 * SillyTavern character format (simplified)
 */
export interface STCharacter {
  /** Character filename/ID */
  name: string;
  /** Avatar filename */
  avatar: string;
  /** Character data (TavernCard format) */
  data: {
    name: string;
    description: string;
    personality: string;
    scenario: string;
    first_mes: string;
    mes_example: string;
    creator_notes?: string;
    system_prompt?: string;
    post_history_instructions?: string;
    alternate_greetings?: string[];
    character_book?: {
      entries: Array<{
        keys: string[];
        content: string;
        enabled: boolean;
        [key: string]: unknown;
      }>;
      [key: string]: unknown;
    };
    tags?: string[];
    creator?: string;
    character_version?: string;
    extensions?: Record<string, unknown>;
  };
}

/**
 * Interface that SillyTavern plugin must implement
 */
export interface SillyTavernBridge {
  /** Get all characters */
  getCharacters(): Promise<STCharacter[]>;

  /** Get a character by name/ID */
  getCharacter(name: string): Promise<STCharacter | null>;

  /** Save a character */
  saveCharacter(character: STCharacter): Promise<string>;

  /** Delete a character */
  deleteCharacter(name: string): Promise<boolean>;

  /** Get character avatar */
  getAvatar(name: string): Promise<Uint8Array | null>;

  /** Check if SillyTavern is available */
  isConnected(): Promise<boolean>;
}

/**
 * Convert STCharacter to CCv3Data
 */
export function stCharacterToCCv3(st: STCharacter): CCv3Data {
  return {
    spec: 'chara_card_v3',
    spec_version: '3.0',
    data: {
      name: st.data.name,
      description: st.data.description,
      personality: st.data.personality,
      scenario: st.data.scenario,
      first_mes: st.data.first_mes,
      mes_example: st.data.mes_example,
      creator_notes: st.data.creator_notes || '',
      system_prompt: st.data.system_prompt || '',
      post_history_instructions: st.data.post_history_instructions || '',
      alternate_greetings: st.data.alternate_greetings || [],
      group_only_greetings: [],
      tags: st.data.tags || [],
      creator: st.data.creator || '',
      character_version: st.data.character_version || '',
      character_book: st.data.character_book as CCv3Data['data']['character_book'],
      extensions: st.data.extensions || {},
    },
  };
}

/**
 * Convert CCv3Data to STCharacter
 */
export function ccv3ToSTCharacter(card: CCv3Data, filename?: string): STCharacter {
  const data = card.data;
  const name = filename || data.name.replace(/[^a-zA-Z0-9]/g, '_');

  return {
    name,
    avatar: `${name}.png`,
    data: {
      name: data.name,
      description: data.description,
      personality: data.personality,
      scenario: data.scenario,
      first_mes: data.first_mes,
      mes_example: data.mes_example,
      creator_notes: data.creator_notes,
      system_prompt: data.system_prompt,
      post_history_instructions: data.post_history_instructions,
      alternate_greetings: data.alternate_greetings,
      character_book: data.character_book,
      tags: data.tags,
      creator: data.creator,
      character_version: data.character_version,
      extensions: data.extensions,
    },
  };
}

/**
 * SillyTavern adapter
 * Requires a bridge implementation from the SillyTavern plugin
 */
export class SillyTavernAdapter extends BasePlatformAdapter {
  readonly platform: PlatformId = 'sillytavern';
  readonly displayName = 'SillyTavern';

  private bridge: SillyTavernBridge;

  constructor(bridge: SillyTavernBridge) {
    super();
    this.bridge = bridge;
  }

  async isAvailable(): Promise<boolean> {
    return this.bridge.isConnected();
  }

  async getCard(localId: string): Promise<CCv3Data | null> {
    const st = await this.bridge.getCharacter(localId);
    if (!st) return null;
    return stCharacterToCCv3(st);
  }

  async listCards(options?: {
    limit?: number;
    offset?: number;
    since?: string;
  }): Promise<AdapterCard[]> {
    const characters = await this.bridge.getCharacters();

    let cards = characters.map((st) => ({
      id: st.name,
      card: stCharacterToCCv3(st),
      updatedAt: new Date().toISOString(), // ST doesn't track this
    }));

    // Apply pagination
    const offset = options?.offset || 0;
    const limit = options?.limit || cards.length;
    cards = cards.slice(offset, offset + limit);

    return cards;
  }

  async saveCard(card: CCv3Data, localId?: string): Promise<string> {
    const stChar = ccv3ToSTCharacter(card, localId);
    return this.bridge.saveCharacter(stChar);
  }

  async deleteCard(localId: string): Promise<boolean> {
    return this.bridge.deleteCharacter(localId);
  }

  async getAssets(localId: string): Promise<AdapterAsset[]> {
    const avatar = await this.bridge.getAvatar(localId);
    if (!avatar) return [];

    return [{
      name: 'avatar',
      type: 'icon',
      data: avatar,
      mimeType: 'image/png',
    }];
  }

  async getLastModified(localId: string): Promise<string | null> {
    // SillyTavern doesn't track modification times
    const char = await this.bridge.getCharacter(localId);
    return char ? new Date().toISOString() : null;
  }
}

/**
 * Create a mock SillyTavern bridge for testing
 */
export function createMockSTBridge(): SillyTavernBridge & {
  characters: Map<string, STCharacter>;
  avatars: Map<string, Uint8Array>;
} {
  const characters = new Map<string, STCharacter>();
  const avatars = new Map<string, Uint8Array>();

  return {
    characters,
    avatars,

    async getCharacters() {
      return Array.from(characters.values());
    },

    async getCharacter(name) {
      return characters.get(name) || null;
    },

    async saveCharacter(character) {
      characters.set(character.name, character);
      return character.name;
    },

    async deleteCharacter(name) {
      const existed = characters.has(name);
      characters.delete(name);
      avatars.delete(name);
      return existed;
    },

    async getAvatar(name) {
      return avatars.get(name) || null;
    },

    async isConnected() {
      return true;
    },
  };
}
