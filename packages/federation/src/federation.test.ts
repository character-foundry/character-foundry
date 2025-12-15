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
  createForkActivity,
  parseForkActivity,
  createInstallActivity,
  parseInstallActivity,
  createActor,
  generateCardId,
  validateActivitySignature,
  FORK_ACTIVITY_CONTEXT,
  INSTALL_ACTIVITY_CONTEXT,
} from './activitypub.js';
import {
  enableFederation,
  SyncEngine,
  MemorySyncStateStore,
  MemoryPlatformAdapter,
  handleInbox,
  validateForkActivity,
  validateInstallActivity,
  calculateDigest,
} from './index.js';
import type { ForkActivity, InstallActivity, FederatedCard, ForkNotification } from './types.js';

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
    it('should throw deprecation error for legacy validateActivitySignature', () => {
      const fedCard = cardToActivityPub(testCard, { id: 'test:123', actorId });
      const activity = createCreateActivity(fedCard, actorId, baseUrl);

      expect(() => validateActivitySignature(activity, 'sig', 'key')).toThrow(
        'validateActivitySignature is deprecated'
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

describe('Fork Support', () => {
  const baseUrl = 'https://example.com';
  const actorId = 'https://example.com/users/test';

  describe('Fork Activity', () => {
    it('should create fork activity', () => {
      const sourceCardId = 'https://original.com/cards/source-123';
      const forkedCard = cardToActivityPub(testCard, {
        id: 'https://example.com/cards/fork-456',
        actorId,
      });

      const activity = createForkActivity(sourceCardId, forkedCard, actorId, baseUrl);

      expect(activity.type).toBe('Fork');
      expect(activity.actor).toBe(actorId);
      expect(activity.object).toBe(sourceCardId);
      expect(activity.result).toBe(forkedCard);
      expect(activity['@context']).toBe(FORK_ACTIVITY_CONTEXT);
    });

    it('should parse fork activity', () => {
      const sourceCardId = 'https://original.com/cards/source-123';
      const forkedCard = cardToActivityPub(testCard, {
        id: 'https://example.com/cards/fork-456',
        actorId,
      });

      const activity = createForkActivity(sourceCardId, forkedCard, actorId, baseUrl);
      const parsed = parseForkActivity(activity);

      expect(parsed).not.toBeNull();
      expect(parsed!.sourceCardId).toBe(sourceCardId);
      expect(parsed!.forkedCard.id).toBe(forkedCard.id);
      expect(parsed!.actor).toBe(actorId);
    });

    it('should return null for invalid fork activity', () => {
      expect(parseForkActivity(null)).toBeNull();
      expect(parseForkActivity({})).toBeNull();
      expect(parseForkActivity({ type: 'Create' })).toBeNull();
      expect(parseForkActivity({ type: 'Fork' })).toBeNull();
    });

    it('should validate fork activity', () => {
      const sourceCardId = 'https://original.com/cards/source-123';
      const forkedCard = cardToActivityPub(testCard, {
        id: 'https://example.com/cards/fork-456',
        actorId,
      });

      const activity = createForkActivity(sourceCardId, forkedCard, actorId, baseUrl);
      const result = validateForkActivity(activity);

      expect(result.valid).toBe(true);
    });
  });

  describe('SyncEngine Fork Operations', () => {
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

    it('should fork card from one platform to another', async () => {
      // Add card to platform1 and create sync state
      const cardId = await platform1.saveCard(testCard);
      const sourceFederatedId = generateCardId(baseUrl, `archive-${cardId}`);

      // Create initial sync state for the source
      await stateStore.set({
        localId: cardId,
        federatedId: sourceFederatedId,
        platformIds: { archive: cardId },
        lastSync: { archive: new Date().toISOString() },
        versionHash: 'abc123',
        status: 'synced',
      });

      // Fork to platform2
      const result = await engine.forkCard(sourceFederatedId, 'archive', 'hub');

      expect(result.success).toBe(true);
      expect(result.forkState).toBeDefined();
      expect(result.forkState!.forkedFrom).toBeDefined();
      expect(result.forkState!.forkedFrom!.federatedId).toBe(sourceFederatedId);
      expect(result.forkState!.forkedFrom!.platform).toBe('archive');

      // Verify fork exists in platform2
      const forkedId = result.forkState!.platformIds.hub;
      const forked = await platform2.getCard(forkedId!);
      expect(forked).not.toBeNull();
      expect(forked!.data.name).toBe('Test Character');

      // Check extensions
      const ext = forked!.data.extensions?.['character-foundry'] as Record<string, unknown>;
      expect(ext?.forkedFrom).toBeDefined();
    });

    it('should track fork count', async () => {
      const federatedId = 'https://example.com/cards/test-123';

      await stateStore.set({
        localId: 'test-123',
        federatedId,
        platformIds: { archive: 'test-123' },
        lastSync: {},
        versionHash: 'abc',
        status: 'synced',
        forksCount: 5,
      });

      const count = await engine.getForkCount(federatedId);
      expect(count).toBe(5);
    });

    it('should emit fork events', async () => {
      const events: string[] = [];

      engine.on('card:forked', () => events.push('forked'));

      const cardId = await platform1.saveCard(testCard);
      const sourceFederatedId = generateCardId(baseUrl, `archive-${cardId}`);

      await stateStore.set({
        localId: cardId,
        federatedId: sourceFederatedId,
        platformIds: { archive: cardId },
        lastSync: {},
        versionHash: 'abc',
        status: 'synced',
      });

      await engine.forkCard(sourceFederatedId, 'archive', 'hub');

      expect(events).toContain('forked');
    });
  });

  describe('MemorySyncStateStore Fork Methods', () => {
    let store: MemorySyncStateStore;

    beforeEach(() => {
      store = new MemorySyncStateStore();
    });

    it('should increment fork count', async () => {
      const federatedId = 'fed:123';

      await store.set({
        localId: '123',
        federatedId,
        platformIds: {},
        lastSync: {},
        versionHash: 'abc',
        status: 'synced',
      });

      const notification: ForkNotification = {
        forkId: 'fed:fork-1',
        actorId: 'https://other.com/users/alice',
        platform: 'hub',
        timestamp: new Date().toISOString(),
      };

      await store.incrementForkCount(federatedId, notification);

      const count = await store.getForkCount(federatedId);
      expect(count).toBe(1);

      const state = await store.get(federatedId);
      expect(state!.forkNotifications).toHaveLength(1);
      expect(state!.forkNotifications![0]!.forkId).toBe('fed:fork-1');
    });

    it('should cap fork notifications at 100', async () => {
      const federatedId = 'fed:123';

      await store.set({
        localId: '123',
        federatedId,
        platformIds: {},
        lastSync: {},
        versionHash: 'abc',
        status: 'synced',
        forksCount: 99,
        forkNotifications: Array.from({ length: 99 }, (_, i) => ({
          forkId: `fed:fork-${i}`,
          actorId: 'https://other.com/users/alice',
          platform: 'hub' as const,
          timestamp: new Date().toISOString(),
        })),
      });

      // Add 5 more notifications
      for (let i = 0; i < 5; i++) {
        await store.incrementForkCount(federatedId, {
          forkId: `fed:fork-new-${i}`,
          actorId: 'https://other.com/users/bob',
          platform: 'hub',
          timestamp: new Date().toISOString(),
        });
      }

      const state = await store.get(federatedId);
      expect(state!.forkNotifications).toHaveLength(100); // Capped at 100
      expect(state!.forksCount).toBe(104); // Count still increments
    });

    it('should find forks by source', async () => {
      const sourceFederatedId = 'fed:source';

      // Create two forks
      await store.set({
        localId: 'fork-1',
        federatedId: 'fed:fork-1',
        platformIds: {},
        lastSync: {},
        versionHash: 'a',
        status: 'synced',
        forkedFrom: {
          federatedId: sourceFederatedId,
          platform: 'archive',
          forkedAt: new Date().toISOString(),
        },
      });

      await store.set({
        localId: 'fork-2',
        federatedId: 'fed:fork-2',
        platformIds: {},
        lastSync: {},
        versionHash: 'b',
        status: 'synced',
        forkedFrom: {
          federatedId: sourceFederatedId,
          platform: 'archive',
          forkedAt: new Date().toISOString(),
        },
      });

      // Create unrelated card
      await store.set({
        localId: 'other',
        federatedId: 'fed:other',
        platformIds: {},
        lastSync: {},
        versionHash: 'c',
        status: 'synced',
      });

      const forks = await store.findForks(sourceFederatedId);
      expect(forks).toHaveLength(2);
      expect(forks.map((f) => f.federatedId)).toContain('fed:fork-1');
      expect(forks.map((f) => f.federatedId)).toContain('fed:fork-2');
    });
  });

  describe('Inbox Handler', () => {
    it('should handle fork activity', async () => {
      let receivedFork: ForkActivity | undefined;

      const forkedCard = cardToActivityPub(testCard, {
        id: 'https://example.com/cards/fork-456',
        actorId,
      });

      const activity = createForkActivity(
        'https://original.com/cards/source-123',
        forkedCard,
        actorId,
        baseUrl
      );

      const result = await handleInbox(activity, new Headers(), {
        fetchActor: async () => null,
        onFork: async (act) => {
          receivedFork = act;
        },
      });

      expect(result.accepted).toBe(true);
      expect(result.activityType).toBe('Fork');
      expect(receivedFork).toBeDefined();
    });

    it('should reject invalid activities', async () => {
      const result = await handleInbox({ invalid: true }, new Headers(), {
        fetchActor: async () => null,
      });

      expect(result.accepted).toBe(false);
      expect(result.error).toContain('Invalid activity');
    });

    describe('Digest Verification', () => {
      const mockActor = {
        id: 'https://example.com/users/test',
        type: 'Person' as const,
        preferredUsername: 'test',
        inbox: 'https://example.com/users/test/inbox',
        outbox: 'https://example.com/users/test/outbox',
        publicKey: {
          id: 'https://example.com/users/test#main-key',
          owner: 'https://example.com/users/test',
          publicKeyPem: 'mock-key',
        },
      };

      it('should reject when Digest header present but rawBody not provided', async () => {
        const forkedCard = cardToActivityPub(testCard, {
          id: 'https://example.com/cards/fork-456',
          actorId: 'https://example.com/users/test',
        });
        const activity = createForkActivity(
          'https://original.com/cards/source-123',
          forkedCard,
          'https://example.com/users/test',
          'https://example.com'
        );

        const headers = new Headers({
          'signature': 'keyId="https://example.com/users/test#main-key",headers="(request-target) host date digest",signature="abc"',
          'digest': 'SHA-256=somehash',
          'date': new Date().toUTCString(),
          'host': 'example.com',
        });

        const result = await handleInbox(activity, headers, {
          strictMode: true,
          fetchActor: async () => mockActor,
        });

        expect(result.accepted).toBe(false);
        expect(result.error).toContain('rawBody not provided');
      });

      it('should reject when Digest does not match body', async () => {
        const forkedCard = cardToActivityPub(testCard, {
          id: 'https://example.com/cards/fork-456',
          actorId: 'https://example.com/users/test',
        });
        const activity = createForkActivity(
          'https://original.com/cards/source-123',
          forkedCard,
          'https://example.com/users/test',
          'https://example.com'
        );

        const rawBody = JSON.stringify(activity);
        const wrongDigest = 'SHA-256=wronghashvalue';

        const headers = new Headers({
          'signature': 'keyId="https://example.com/users/test#main-key",headers="(request-target) host date digest",signature="abc"',
          'digest': wrongDigest,
          'date': new Date().toUTCString(),
          'host': 'example.com',
        });

        const result = await handleInbox(activity, headers, {
          strictMode: true,
          rawBody,
          fetchActor: async () => mockActor,
        });

        expect(result.accepted).toBe(false);
        expect(result.error).toContain('Digest mismatch');
      });

      it('should reject invalid Digest header format', async () => {
        const forkedCard = cardToActivityPub(testCard, {
          id: 'https://example.com/cards/fork-456',
          actorId: 'https://example.com/users/test',
        });
        const activity = createForkActivity(
          'https://original.com/cards/source-123',
          forkedCard,
          'https://example.com/users/test',
          'https://example.com'
        );

        const rawBody = JSON.stringify(activity);

        const headers = new Headers({
          'signature': 'keyId="https://example.com/users/test#main-key",headers="(request-target) host date digest",signature="abc"',
          'digest': 'MD5=invalidformat', // Wrong algorithm
          'date': new Date().toUTCString(),
          'host': 'example.com',
        });

        const result = await handleInbox(activity, headers, {
          strictMode: true,
          rawBody,
          fetchActor: async () => mockActor,
        });

        expect(result.accepted).toBe(false);
        expect(result.error).toContain('Invalid Digest header format');
      });

      it('should reject when signature includes digest but header missing', async () => {
        const forkedCard = cardToActivityPub(testCard, {
          id: 'https://example.com/cards/fork-456',
          actorId: 'https://example.com/users/test',
        });
        const activity = createForkActivity(
          'https://original.com/cards/source-123',
          forkedCard,
          'https://example.com/users/test',
          'https://example.com'
        );

        const headers = new Headers({
          // Signature claims to include digest, but no Digest header present
          'signature': 'keyId="https://example.com/users/test#main-key",headers="(request-target) host date digest",signature="abc"',
          'date': new Date().toUTCString(),
          'host': 'example.com',
        });

        const result = await handleInbox(activity, headers, {
          strictMode: true,
          fetchActor: async () => mockActor,
        });

        expect(result.accepted).toBe(false);
        expect(result.error).toContain('Signature includes digest but no Digest header present');
      });
    });
  });
});

describe('Install Stats Support', () => {
  const baseUrl = 'https://example.com';
  const actorId = 'https://example.com/users/test';

  describe('Install Activity', () => {
    it('should create install activity', () => {
      const cardId = 'https://hub.example.com/cards/card-123';
      const activity = createInstallActivity(cardId, actorId, baseUrl, 'sillytavern');

      expect(activity.type).toBe('Install');
      expect(activity.actor).toBe(actorId);
      expect(activity.object).toBe(cardId);
      expect(activity.target?.type).toBe('Application');
      expect(activity.target?.name).toBe('sillytavern');
      expect(activity['@context']).toBe(INSTALL_ACTIVITY_CONTEXT);
    });

    it('should parse install activity', () => {
      const cardId = 'https://hub.example.com/cards/card-123';
      const activity = createInstallActivity(cardId, actorId, baseUrl, 'sillytavern');
      const parsed = parseInstallActivity(activity);

      expect(parsed).not.toBeNull();
      expect(parsed!.cardId).toBe(cardId);
      expect(parsed!.actor).toBe(actorId);
      expect(parsed!.platform).toBe('sillytavern');
    });

    it('should return null for invalid install activity', () => {
      expect(parseInstallActivity(null)).toBeNull();
      expect(parseInstallActivity({})).toBeNull();
      expect(parseInstallActivity({ type: 'Create' })).toBeNull();
      expect(parseInstallActivity({ type: 'Install' })).toBeNull();
    });

    it('should validate install activity', () => {
      const cardId = 'https://hub.example.com/cards/card-123';
      const activity = createInstallActivity(cardId, actorId, baseUrl, 'sillytavern');
      const result = validateInstallActivity(activity);

      expect(result.valid).toBe(true);
    });

    it('should reject install activity with invalid URI', () => {
      const activity = {
        '@context': INSTALL_ACTIVITY_CONTEXT,
        id: 'https://example.com/activities/123',
        type: 'Install',
        actor: actorId,
        object: 'not-a-valid-uri', // Invalid
        published: new Date().toISOString(),
      };

      const result = validateInstallActivity(activity);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('not a valid URI');
    });
  });

  describe('SyncEngine Install Operations', () => {
    let engine: SyncEngine;
    let stateStore: MemorySyncStateStore;
    let platform1: MemoryPlatformAdapter;

    beforeEach(() => {
      stateStore = new MemorySyncStateStore();
      platform1 = new MemoryPlatformAdapter('hub', 'Hub');

      engine = new SyncEngine({
        baseUrl: 'https://hub.example.com',
        actorId: 'https://hub.example.com/users/test',
        stateStore,
      });

      engine.registerPlatform(platform1);
    });

    it('should handle install notification', async () => {
      const cardId = await platform1.saveCard(testCard);
      const federatedId = generateCardId(baseUrl, `hub-${cardId}`);

      // Create sync state for the card
      await stateStore.set({
        localId: cardId,
        federatedId,
        platformIds: { hub: cardId },
        lastSync: { hub: new Date().toISOString() },
        versionHash: 'abc123',
        status: 'synced',
      });

      // Create install activity from SillyTavern
      const installActivity = createInstallActivity(
        federatedId,
        'https://sillytavern.local/users/alice',
        'https://sillytavern.local',
        'sillytavern'
      ) as InstallActivity;

      // Handle the install notification
      await engine.handleInstallNotification(installActivity);

      // Check stats were updated
      const stats = await engine.getCardStats(federatedId);
      expect(stats).not.toBeNull();
      expect(stats!.installCount).toBe(1);
      expect(stats!.installsByPlatform.sillytavern).toBe(1);
    });

    it('should track multiple installs', async () => {
      const cardId = await platform1.saveCard(testCard);
      const federatedId = generateCardId(baseUrl, `hub-${cardId}`);

      await stateStore.set({
        localId: cardId,
        federatedId,
        platformIds: { hub: cardId },
        lastSync: {},
        versionHash: 'abc',
        status: 'synced',
      });

      // Multiple installs from different platforms
      await engine.handleInstallNotification(
        createInstallActivity(federatedId, 'actor1', 'base1', 'sillytavern') as InstallActivity
      );
      await engine.handleInstallNotification(
        createInstallActivity(federatedId, 'actor2', 'base2', 'sillytavern') as InstallActivity
      );
      await engine.handleInstallNotification(
        createInstallActivity(federatedId, 'actor3', 'base3', 'custom') as InstallActivity
      );

      const stats = await engine.getCardStats(federatedId);
      expect(stats!.installCount).toBe(3);
      expect(stats!.installsByPlatform.sillytavern).toBe(2);
      expect(stats!.installsByPlatform.custom).toBe(1);
    });

    it('should emit install events', async () => {
      const events: string[] = [];

      engine.on('card:install-received', () => events.push('install-received'));

      const cardId = await platform1.saveCard(testCard);
      const federatedId = generateCardId(baseUrl, `hub-${cardId}`);

      await stateStore.set({
        localId: cardId,
        federatedId,
        platformIds: { hub: cardId },
        lastSync: {},
        versionHash: 'abc',
        status: 'synced',
      });

      await engine.handleInstallNotification(
        createInstallActivity(federatedId, 'actor', 'base', 'sillytavern') as InstallActivity
      );

      expect(events).toContain('install-received');
    });

    it('should return install count', async () => {
      const federatedId = 'https://example.com/cards/test-123';

      await stateStore.set({
        localId: 'test-123',
        federatedId,
        platformIds: { hub: 'test-123' },
        lastSync: {},
        versionHash: 'abc',
        status: 'synced',
        stats: {
          installCount: 42,
          installsByPlatform: { sillytavern: 30, custom: 12 },
          forkCount: 5,
          likeCount: 0,
          lastUpdated: new Date().toISOString(),
        },
      });

      const count = await engine.getInstallCount(federatedId);
      expect(count).toBe(42);
    });

    it('should ignore install for unknown card', async () => {
      // This should not throw
      await engine.handleInstallNotification(
        createInstallActivity(
          'https://unknown.com/cards/nonexistent',
          'actor',
          'base',
          'sillytavern'
        ) as InstallActivity
      );

      // No state should be created
      const state = await stateStore.get('https://unknown.com/cards/nonexistent');
      expect(state).toBeNull();
    });
  });

  describe('Inbox Handler Install Routing', () => {
    it('should handle install activity', async () => {
      let receivedInstall: InstallActivity | undefined;

      const activity = createInstallActivity(
        'https://hub.example.com/cards/card-123',
        actorId,
        baseUrl,
        'sillytavern'
      );

      const result = await handleInbox(activity, new Headers(), {
        fetchActor: async () => null,
        onInstall: async (act) => {
          receivedInstall = act;
        },
      });

      expect(result.accepted).toBe(true);
      expect(result.activityType).toBe('Install');
      expect(receivedInstall).toBeDefined();
      expect(receivedInstall!.type).toBe('Install');
    });
  });
});
