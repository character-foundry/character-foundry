/**
 * Federation Tests
 */

import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import type { CCv3Data } from '@character-foundry/schemas';
import {
  cardToActivityPub,
  cardFromActivityPub,
  createCreateActivity,
  createUpdateActivity,
  createDeleteActivity,
  createActor,
  generateCardId,
  validateActivitySignature,
} from './activitypub.js';
import {
  enableFederation,
  SyncEngine,
  MemorySyncStateStore,
  MemoryPlatformAdapter,
} from './index.js';

// Enable federation for tests (dual opt-in: env var + code)
beforeAll(() => {
  process.env.FEDERATION_ENABLED = 'true';
  enableFederation();
});

// Test card data
const testCard: CCv3Data = {
  spec: 'chara_card_v3',
  spec_version: '3.0',
  data: {
    name: 'Test Character',
    description: 'A test character for federation',
    personality: 'Friendly',
    scenario: 'Testing',
    first_mes: 'Hello from federation!',
    mes_example: '{{user}}: Test\n{{char}}: Response',
    creator_notes: 'Created for testing',
    system_prompt: '',
    post_history_instructions: '',
    alternate_greetings: ['Hi!', 'Hey!'],
    group_only_greetings: [],
    tags: ['test', 'federation'],
    creator: 'Test Suite',
    character_version: '1.0',
    extensions: {},
  },
};

describe('ActivityPub', () => {
  const baseUrl = 'https://example.com';
  const actorId = 'https://example.com/users/test';

  describe('cardToActivityPub', () => {
    it('should convert card to ActivityPub format', () => {
      const cardId = generateCardId(baseUrl, 'card-123');
      const federated = cardToActivityPub(testCard, {
        id: cardId,
        actorId,
      });

      expect(federated.id).toBe(cardId);
      expect(federated.type).toBe('Note');
      expect(federated.name).toBe('Test Character');
      expect(federated.attributedTo).toBe(actorId);
      expect(federated.mediaType).toBe('application/json');
      expect(federated['character:version']).toBe('1.0');
    });

    it('should include tags as hashtags', () => {
      const federated = cardToActivityPub(testCard, {
        id: 'test:123',
        actorId,
      });

      expect(federated.tag).toBeDefined();
      expect(federated.tag!.length).toBe(2);
      expect(federated.tag![0]!.type).toBe('Hashtag');
      expect(federated.tag![0]!.name).toBe('#test');
    });

    it('should include source info', () => {
      const federated = cardToActivityPub(testCard, {
        id: 'test:123',
        actorId,
        sourcePlatform: 'archive',
        sourceId: 'arch-456',
        sourceUrl: 'https://archive.example.com/cards/456',
      });

      expect(federated.source).toBeDefined();
      expect(federated.source!.platform).toBe('archive');
      expect(federated.source!.id).toBe('arch-456');
    });
  });

  describe('cardFromActivityPub', () => {
    it('should extract card from ActivityPub object', () => {
      const federated = cardToActivityPub(testCard, {
        id: 'test:123',
        actorId,
      });

      const extracted = cardFromActivityPub(federated);

      expect(extracted.spec).toBe('chara_card_v3');
      expect(extracted.data.name).toBe('Test Character');
      expect(extracted.data.description).toBe('A test character for federation');
    });

    it('should throw on invalid content', () => {
      const invalid = {
        '@context': [],
        id: 'test:123',
        type: 'Note' as const,
        name: 'Test',
        content: 'not valid json',
        mediaType: 'application/json' as const,
        attributedTo: 'actor',
        published: new Date().toISOString(),
      };

      expect(() => cardFromActivityPub(invalid)).toThrow();
    });
  });

  describe('Activity creation', () => {
    const fedCard = cardToActivityPub(testCard, {
      id: 'test:123',
      actorId,
    });

    it('should create Create activity', () => {
      const activity = createCreateActivity(fedCard, actorId, baseUrl);

      expect(activity.type).toBe('Create');
      expect(activity.actor).toBe(actorId);
      expect(activity.object).toBe(fedCard);
      expect(activity.to).toContain('https://www.w3.org/ns/activitystreams#Public');
    });

    it('should create Update activity', () => {
      const activity = createUpdateActivity(fedCard, actorId, baseUrl);

      expect(activity.type).toBe('Update');
      expect(activity.actor).toBe(actorId);
    });

    it('should create Delete activity', () => {
      const activity = createDeleteActivity('test:123', actorId, baseUrl);

      expect(activity.type).toBe('Delete');
      expect(activity.object).toBe('test:123');
    });
  });

  describe('Actor creation', () => {
    it('should create actor with all fields', () => {
      const actor = createActor({
        id: actorId,
        username: 'test',
        displayName: 'Test User',
        summary: 'A test user',
        baseUrl,
        publicKeyPem: 'PUBLIC KEY HERE',
      });

      expect(actor.id).toBe(actorId);
      expect(actor.type).toBe('Person');
      expect(actor.name).toBe('Test User');
      expect(actor.preferredUsername).toBe('test');
      expect(actor.inbox).toBe(`${actorId}/inbox`);
      expect(actor.publicKey).toBeDefined();
      expect(actor.publicKey!.publicKeyPem).toBe('PUBLIC KEY HERE');
    });
  });

  describe('Signature validation', () => {
    it('should throw because signature verification is not implemented', () => {
      const fedCard = cardToActivityPub(testCard, { id: 'test:123', actorId });
      const activity = createCreateActivity(fedCard, actorId, baseUrl);

      expect(() => validateActivitySignature(activity, 'sig', 'key')).toThrow(
        'validateActivitySignature is not implemented'
      );
    });
  });
});

describe('SyncEngine', () => {
  let engine: SyncEngine;
  let stateStore: MemorySyncStateStore;
  let platform1: MemoryPlatformAdapter;
  let platform2: MemoryPlatformAdapter;

  beforeEach(() => {
    stateStore = new MemorySyncStateStore();
    platform1 = new MemoryPlatformAdapter('archive', 'Archive');
    platform2 = new MemoryPlatformAdapter('hub', 'Hub');

    engine = new SyncEngine({
      baseUrl: 'https://example.com',
      actorId: 'https://example.com/users/test',
      stateStore,
    });

    engine.registerPlatform(platform1);
    engine.registerPlatform(platform2);
  });

  describe('Platform registration', () => {
    it('should register platforms', () => {
      const platforms = engine.getPlatforms();

      expect(platforms).toContain('archive');
      expect(platforms).toContain('hub');
    });

    it('should unregister platforms', () => {
      engine.unregisterPlatform('hub');
      const platforms = engine.getPlatforms();

      expect(platforms).toContain('archive');
      expect(platforms).not.toContain('hub');
    });
  });

  describe('Push sync', () => {
    it('should push card from one platform to another', async () => {
      // Add card to platform1
      const cardId = await platform1.saveCard(testCard);

      // Push to platform2
      const result = await engine.pushCard('archive', cardId, 'hub');

      expect(result.success).toBe(true);
      expect(result.newState).toBeDefined();
      expect(result.newState!.platformIds.archive).toBe(cardId);
      expect(result.newState!.platformIds.hub).toBeDefined();

      // Verify card exists in platform2
      const pushed = await platform2.getCard(result.newState!.platformIds.hub!);
      expect(pushed).not.toBeNull();
      expect(pushed!.data.name).toBe('Test Character');
    });

    it('should update sync state', async () => {
      const cardId = await platform1.saveCard(testCard);
      const result = await engine.pushCard('archive', cardId, 'hub');

      expect(result.newState!.status).toBe('synced');
      expect(result.newState!.lastSync.archive).toBeDefined();
      expect(result.newState!.lastSync.hub).toBeDefined();
    });

    it('should fail for unregistered platform', async () => {
      const cardId = await platform1.saveCard(testCard);
      const result = await engine.pushCard('archive', cardId, 'risu');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not registered');
    });
  });

  describe('Sync all', () => {
    it('should sync card to all platforms', async () => {
      const cardId = await platform1.saveCard(testCard);
      const results = await engine.syncCardToAll('archive', cardId);

      expect(results.length).toBe(1); // Only hub (not archive itself)
      expect(results[0]!.success).toBe(true);

      expect(platform2.count()).toBe(1);
    });

    it('should sync all cards between platforms', async () => {
      // Add cards to platform1
      await platform1.saveCard(testCard);
      await platform1.saveCard({
        ...testCard,
        data: { ...testCard.data, name: 'Second Character' },
      });

      const results = await engine.syncPlatform('archive', 'hub');

      expect(results.length).toBe(2);
      expect(results.filter((r) => r.success).length).toBe(2);
      expect(platform2.count()).toBe(2);
    });
  });

  describe('Events', () => {
    it('should emit sync events', async () => {
      const events: string[] = [];

      engine.on('card:synced', () => events.push('synced'));
      engine.on('sync:started', () => events.push('started'));
      engine.on('sync:completed', () => events.push('completed'));

      const cardId = await platform1.saveCard(testCard);
      await engine.syncPlatform('archive', 'hub');

      expect(events).toContain('started');
      expect(events).toContain('synced');
      expect(events).toContain('completed');
    });
  });

  describe('State queries', () => {
    it('should find sync state by platform ID', async () => {
      const cardId = await platform1.saveCard(testCard);
      await engine.pushCard('archive', cardId, 'hub');

      const state = await engine.findSyncState('archive', cardId);

      expect(state).not.toBeNull();
      expect(state!.platformIds.archive).toBe(cardId);
    });
  });
});

describe('MemorySyncStateStore', () => {
  let store: MemorySyncStateStore;

  beforeEach(() => {
    store = new MemorySyncStateStore();
  });

  it('should store and retrieve state', async () => {
    const state = {
      localId: 'local-1',
      federatedId: 'fed:123',
      platformIds: { archive: 'arch-1' },
      lastSync: { archive: '2024-01-01T00:00:00Z' },
      versionHash: 'abc123',
      status: 'synced' as const,
    };

    await store.set(state);
    const retrieved = await store.get('fed:123');

    expect(retrieved).toEqual(state);
  });

  it('should list all states', async () => {
    await store.set({
      localId: '1',
      federatedId: 'fed:1',
      platformIds: {},
      lastSync: {},
      versionHash: 'a',
      status: 'synced',
    });
    await store.set({
      localId: '2',
      federatedId: 'fed:2',
      platformIds: {},
      lastSync: {},
      versionHash: 'b',
      status: 'synced',
    });

    const all = await store.list();

    expect(all.length).toBe(2);
  });

  it('should find by platform ID', async () => {
    await store.set({
      localId: '1',
      federatedId: 'fed:1',
      platformIds: { archive: 'arch-99' },
      lastSync: {},
      versionHash: 'a',
      status: 'synced',
    });

    const found = await store.findByPlatformId('archive', 'arch-99');

    expect(found).not.toBeNull();
    expect(found!.federatedId).toBe('fed:1');
  });

  it('should delete state', async () => {
    await store.set({
      localId: '1',
      federatedId: 'fed:1',
      platformIds: {},
      lastSync: {},
      versionHash: 'a',
      status: 'synced',
    });

    await store.delete('fed:1');
    const retrieved = await store.get('fed:1');

    expect(retrieved).toBeNull();
  });
});

describe('MemoryPlatformAdapter', () => {
  let adapter: MemoryPlatformAdapter;

  beforeEach(() => {
    adapter = new MemoryPlatformAdapter('custom', 'Test');
  });

  it('should save and retrieve cards', async () => {
    const id = await adapter.saveCard(testCard);
    const retrieved = await adapter.getCard(id);

    expect(retrieved).not.toBeNull();
    expect(retrieved!.data.name).toBe('Test Character');
  });

  it('should list cards with pagination', async () => {
    await adapter.saveCard(testCard);
    await adapter.saveCard({
      ...testCard,
      data: { ...testCard.data, name: 'Card 2' },
    });
    await adapter.saveCard({
      ...testCard,
      data: { ...testCard.data, name: 'Card 3' },
    });

    const page1 = await adapter.listCards({ limit: 2 });
    const page2 = await adapter.listCards({ limit: 2, offset: 2 });

    expect(page1.length).toBe(2);
    expect(page2.length).toBe(1);
  });

  it('should delete cards', async () => {
    const id = await adapter.saveCard(testCard);
    const deleted = await adapter.deleteCard(id);
    const retrieved = await adapter.getCard(id);

    expect(deleted).toBe(true);
    expect(retrieved).toBeNull();
  });

  it('should track last modified time', async () => {
    const id = await adapter.saveCard(testCard);
    const lastMod = await adapter.getLastModified(id);

    expect(lastMod).not.toBeNull();
  });
});
