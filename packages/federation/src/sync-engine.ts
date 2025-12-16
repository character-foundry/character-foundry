/**
 * Sync Engine
 *
 * Handles synchronization of character cards across platforms.
 */

import type { CCv3Data } from '@character-foundry/schemas';
import { generateUUID } from '@character-foundry/core';
import type {
  PlatformId,
  PlatformAdapter,
  CardSyncState,
  SyncOperation,
  SyncResult,
  SyncStateStore,
  FederationEvent,
  FederationEventListener,
  FederationEventType,
  ForkReference,
  ForkResult,
  ForkActivity,
  ForkNotification,
  InstallActivity,
  CardStats,
} from './types.js';
import { generateCardId, parseForkActivity, parseInstallActivity } from './activitypub.js';
import { assertFederationEnabled } from './index.js';

/**
 * Generate a simple hash of card content for change detection (32-bit djb2-style).
 *
 * Fast but has collision potential (~2^16 birthday bound). Suitable for
 * local change detection where collisions are unlikely and recoverable.
 *
 * @see hashCardSecure for cryptographic alternative
 */
function hashCardFast(card: CCv3Data): string {
  const content = JSON.stringify(card);
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Generate a SHA-256 hash of card content for secure change detection.
 *
 * Cryptographically secure with negligible collision probability.
 * Recommended for federation sync where hash collisions could cause
 * data loss or missed updates across systems.
 *
 * @security Use this for cross-system sync to prevent collision attacks
 */
async function hashCardSecure(card: CCv3Data): Promise<string> {
  const content = JSON.stringify(card);
  const data = new TextEncoder().encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Sync Engine Options
 */
export interface SyncEngineOptions {
  /** Base URL for this federation instance */
  baseUrl: string;
  /** Actor ID for this instance */
  actorId: string;
  /** State storage */
  stateStore: SyncStateStore;
  /** Auto-sync interval in ms (0 to disable) */
  autoSyncInterval?: number;
  /**
   * Use SHA-256 for change detection instead of fast 32-bit hash.
   *
   * Default: false (fast hash for backwards compatibility)
   * Recommended: true for federation sync across untrusted systems
   *
   * @security Fast hash has collision potential (~2^16 birthday bound).
   * SHA-256 is cryptographically secure but slightly slower.
   */
  secureHashing?: boolean;
}

/**
 * Sync Engine
 * Coordinates synchronization between registered platforms
 */
export class SyncEngine {
  private platforms: Map<PlatformId, PlatformAdapter> = new Map();
  private stateStore: SyncStateStore;
  private baseUrl: string;
  private actorId: string;
  private listeners: Map<FederationEventType, Set<FederationEventListener>> = new Map();
  private autoSyncTimer?: ReturnType<typeof setInterval>;
  private secureHashing: boolean;

  /**
   * Mutex flag to prevent concurrent syncAll() executions.
   * When autoSyncInterval triggers while a sync is in progress,
   * the new sync is skipped to prevent race conditions.
   */
  private syncInProgress = false;

  constructor(options: SyncEngineOptions) {
    assertFederationEnabled('SyncEngine');

    this.baseUrl = options.baseUrl;
    this.actorId = options.actorId;
    this.stateStore = options.stateStore;
    this.secureHashing = options.secureHashing ?? false;

    if (options.autoSyncInterval && options.autoSyncInterval > 0) {
      this.autoSyncTimer = setInterval(
        () => void this.syncAll(), // void to handle Promise without blocking
        options.autoSyncInterval
      );
    }
  }

  /**
   * Generate a hash for change detection.
   * Uses SHA-256 if secureHashing is enabled, otherwise fast 32-bit hash.
   */
  private async hashCard(card: CCv3Data): Promise<string> {
    if (this.secureHashing) {
      return hashCardSecure(card);
    }
    return hashCardFast(card);
  }

  /**
   * Register a platform adapter
   */
  registerPlatform(adapter: PlatformAdapter): void {
    this.platforms.set(adapter.platform, adapter);
  }

  /**
   * Unregister a platform adapter
   */
  unregisterPlatform(platform: PlatformId): void {
    this.platforms.delete(platform);
  }

  /**
   * Get registered platforms
   */
  getPlatforms(): PlatformId[] {
    return Array.from(this.platforms.keys());
  }

  /**
   * Add event listener
   */
  on(event: FederationEventType, listener: FederationEventListener): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  /**
   * Remove event listener
   */
  off(event: FederationEventType, listener: FederationEventListener): void {
    this.listeners.get(event)?.delete(listener);
  }

  /**
   * Emit an event
   */
  private emit(type: FederationEventType, data: unknown): void {
    const event: FederationEvent = {
      type,
      timestamp: new Date().toISOString(),
      data,
    };

    const listeners = this.listeners.get(type);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(event);
        } catch (err) {
          console.error(`Event listener error:`, err);
        }
      }
    }
  }

  /**
   * Push a card from one platform to another
   */
  async pushCard(
    sourcePlatform: PlatformId,
    sourceId: string,
    targetPlatform: PlatformId
  ): Promise<SyncResult> {
    const operation: SyncOperation = {
      type: 'push',
      cardId: `${sourcePlatform}:${sourceId}`,
      sourcePlatform,
      targetPlatform,
      timestamp: new Date().toISOString(),
    };

    try {
      // Get source adapter
      const sourceAdapter = this.platforms.get(sourcePlatform);
      if (!sourceAdapter) {
        throw new Error(`Platform not registered: ${sourcePlatform}`);
      }

      // Get target adapter
      const targetAdapter = this.platforms.get(targetPlatform);
      if (!targetAdapter) {
        throw new Error(`Platform not registered: ${targetPlatform}`);
      }

      // Check availability
      if (!await sourceAdapter.isAvailable()) {
        throw new Error(`Source platform unavailable: ${sourcePlatform}`);
      }
      if (!await targetAdapter.isAvailable()) {
        throw new Error(`Target platform unavailable: ${targetPlatform}`);
      }

      // Get the card
      const card = await sourceAdapter.getCard(sourceId);
      if (!card) {
        throw new Error(`Card not found: ${sourceId}`);
      }

      // Check for existing sync state
      const federatedId = generateCardId(this.baseUrl, `${sourcePlatform}-${sourceId}`);
      const syncState = await this.stateStore.get(federatedId);

      // Check for conflicts
      if (syncState?.platformIds[targetPlatform]) {
        const existingCard = await targetAdapter.getCard(syncState.platformIds[targetPlatform]!);
        if (existingCard) {
          const existingHash = await this.hashCard(existingCard);
          const newHash = await this.hashCard(card);

          if (existingHash !== syncState.versionHash && newHash !== syncState.versionHash) {
            // Both sides changed - conflict!
            syncState.status = 'conflict';
            syncState.conflict = {
              localVersion: newHash,
              remoteVersion: existingHash,
              remotePlatform: targetPlatform,
            };
            await this.stateStore.set(syncState);

            this.emit('card:conflict', { syncState, sourcePlatform, targetPlatform });

            return {
              success: false,
              operation,
              newState: syncState,
              error: 'Sync conflict detected',
            };
          }
        }
      }

      // Save to target platform
      const targetId = await targetAdapter.saveCard(
        card,
        syncState?.platformIds[targetPlatform]
      );

      // Update sync state
      const newHash = await this.hashCard(card);
      const now = new Date().toISOString();

      // Create new state or use existing
      const updatedState: CardSyncState = syncState ?? {
        localId: sourceId,
        federatedId,
        platformIds: {},
        lastSync: {},
        versionHash: newHash,
        status: 'synced',
      };

      updatedState.platformIds[sourcePlatform] = sourceId;
      updatedState.platformIds[targetPlatform] = targetId;
      updatedState.lastSync[sourcePlatform] = now;
      updatedState.lastSync[targetPlatform] = now;
      updatedState.versionHash = newHash;
      updatedState.status = 'synced';
      updatedState.conflict = undefined;

      await this.stateStore.set(updatedState);

      this.emit('card:synced', { syncState: updatedState, sourcePlatform, targetPlatform });

      return {
        success: true,
        operation,
        newState: updatedState,
      };
    } catch (err) {
      this.emit('sync:failed', { operation, error: err });

      return {
        success: false,
        operation,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Pull a card from a remote platform to local
   */
  async pullCard(
    remotePlatform: PlatformId,
    remoteId: string,
    localPlatform: PlatformId
  ): Promise<SyncResult> {
    // Pull is just push in reverse
    return this.pushCard(remotePlatform, remoteId, localPlatform);
  }

  /**
   * Sync a card across all registered platforms
   */
  async syncCardToAll(
    sourcePlatform: PlatformId,
    sourceId: string
  ): Promise<SyncResult[]> {
    const results: SyncResult[] = [];

    for (const [platform] of this.platforms) {
      if (platform === sourcePlatform) continue;

      const result = await this.pushCard(sourcePlatform, sourceId, platform);
      results.push(result);
    }

    return results;
  }

  /**
   * Sync all cards from one platform to another
   */
  async syncPlatform(
    sourcePlatform: PlatformId,
    targetPlatform: PlatformId
  ): Promise<SyncResult[]> {
    const sourceAdapter = this.platforms.get(sourcePlatform);
    if (!sourceAdapter) {
      throw new Error(`Platform not registered: ${sourcePlatform}`);
    }

    this.emit('sync:started', { sourcePlatform, targetPlatform });

    const cards = await sourceAdapter.listCards();
    const results: SyncResult[] = [];

    for (const { id } of cards) {
      const result = await this.pushCard(sourcePlatform, id, targetPlatform);
      results.push(result);
    }

    this.emit('sync:completed', {
      sourcePlatform,
      targetPlatform,
      total: results.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
    });

    return results;
  }

  /**
   * Sync all platforms with each other.
   *
   * Includes mutex protection to prevent concurrent executions when
   * triggered by autoSyncInterval. If a sync is already in progress,
   * subsequent calls are skipped and emit a 'sync:skipped' event.
   */
  async syncAll(): Promise<Map<string, SyncResult[]>> {
    // Mutex: prevent concurrent sync operations
    if (this.syncInProgress) {
      this.emit('sync:skipped', { reason: 'already_in_progress', timestamp: new Date().toISOString() });
      return new Map();
    }

    this.syncInProgress = true;
    try {
      const results = new Map<string, SyncResult[]>();
      const platforms = Array.from(this.platforms.keys());

      for (let i = 0; i < platforms.length; i++) {
        for (let j = i + 1; j < platforms.length; j++) {
          const source = platforms[i]!;
          const target = platforms[j]!;
          const key = `${source}->${target}`;

          results.set(key, await this.syncPlatform(source, target));
        }
      }

      return results;
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Get sync state for a card
   */
  async getSyncState(federatedId: string): Promise<CardSyncState | null> {
    return this.stateStore.get(federatedId);
  }

  /**
   * Find sync state by platform ID
   */
  async findSyncState(
    platform: PlatformId,
    platformId: string
  ): Promise<CardSyncState | null> {
    return this.stateStore.findByPlatformId(platform, platformId);
  }

  /**
   * Resolve a sync conflict by choosing a version
   */
  async resolveConflict(
    federatedId: string,
    resolution: 'local' | 'remote' | 'merge',
    mergedCard?: CCv3Data
  ): Promise<SyncResult> {
    const syncState = await this.stateStore.get(federatedId);
    if (!syncState || syncState.status !== 'conflict' || !syncState.conflict) {
      throw new Error('No conflict to resolve');
    }

    const operation: SyncOperation = {
      type: 'resolve',
      cardId: federatedId,
      sourcePlatform: 'archive', // Will be updated
      targetPlatform: syncState.conflict.remotePlatform,
      timestamp: new Date().toISOString(),
    };

    try {
      let sourceCard: CCv3Data | null = null;
      let _sourcePlatform: PlatformId | null = null;

      if (resolution === 'merge' && mergedCard) {
        sourceCard = mergedCard;
      } else if (resolution === 'local') {
        // Find local platform
        for (const [platform, id] of Object.entries(syncState.platformIds)) {
          if (platform !== syncState.conflict.remotePlatform) {
            const adapter = this.platforms.get(platform as PlatformId);
            if (adapter) {
              sourceCard = await adapter.getCard(id);
              _sourcePlatform = platform as PlatformId;
              break;
            }
          }
        }
      } else if (resolution === 'remote') {
        const adapter = this.platforms.get(syncState.conflict.remotePlatform);
        if (adapter) {
          const remoteId = syncState.platformIds[syncState.conflict.remotePlatform];
          if (remoteId) {
            sourceCard = await adapter.getCard(remoteId);
            _sourcePlatform = syncState.conflict.remotePlatform;
          }
        }
      }

      if (!sourceCard) {
        throw new Error('Could not resolve conflict: source card not found');
      }

      // Push resolved card to all platforms
      const newHash = await this.hashCard(sourceCard);
      const now = new Date().toISOString();

      for (const [platform, id] of Object.entries(syncState.platformIds)) {
        const adapter = this.platforms.get(platform as PlatformId);
        if (adapter) {
          await adapter.saveCard(sourceCard, id);
          syncState.lastSync[platform as PlatformId] = now;
        }
      }

      syncState.versionHash = newHash;
      syncState.status = 'synced';
      syncState.conflict = undefined;

      await this.stateStore.set(syncState);

      this.emit('card:synced', { syncState, resolution });

      return {
        success: true,
        operation,
        newState: syncState,
      };
    } catch (err) {
      return {
        success: false,
        operation,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Fork a card from a remote source
   *
   * Creates a local copy of a remote card with fork metadata stored in
   * the card's extensions and sync state. Optionally notifies the source
   * instance about the fork.
   *
   * @param sourceFederatedId - Federated URI of the source card
   * @param sourcePlatform - Platform where the source card resides
   * @param targetPlatform - Platform to save the fork to
   * @param options - Fork options
   */
  async forkCard(
    sourceFederatedId: string,
    sourcePlatform: PlatformId,
    targetPlatform: PlatformId,
    options?: {
      modifications?: Partial<CCv3Data['data']>;
      notifySource?: boolean;
      sourceInbox?: string;
    }
  ): Promise<ForkResult> {
    const operation: SyncOperation = {
      type: 'fork',
      cardId: sourceFederatedId,
      sourcePlatform,
      targetPlatform,
      timestamp: new Date().toISOString(),
    };

    try {
      // Get source adapter
      const sourceAdapter = this.platforms.get(sourcePlatform);
      if (!sourceAdapter) {
        throw new Error(`Platform not registered: ${sourcePlatform}`);
      }

      // Get target adapter
      const targetAdapter = this.platforms.get(targetPlatform);
      if (!targetAdapter) {
        throw new Error(`Platform not registered: ${targetPlatform}`);
      }

      // Find source card by looking up sync state or trying to get directly
      const sourceState = await this.stateStore.get(sourceFederatedId);
      const sourceLocalId = sourceState?.platformIds[sourcePlatform];

      if (!sourceLocalId) {
        throw new Error(`Cannot find source card: ${sourceFederatedId}`);
      }

      const sourceCard = await sourceAdapter.getCard(sourceLocalId);
      if (!sourceCard) {
        throw new Error(`Source card not found: ${sourceLocalId}`);
      }

      // Create forked card with modifications and metadata
      const forkedCard = this.createForkedCard(
        sourceCard,
        sourceFederatedId,
        sourcePlatform,
        sourceState?.versionHash,
        options?.modifications
      );

      // Save fork to target platform
      const forkLocalId = await targetAdapter.saveCard(forkedCard);

      // Create sync state for the fork
      const forkFederatedId = generateCardId(this.baseUrl, `${targetPlatform}-${forkLocalId}`);
      const forkHash = await this.hashCard(forkedCard);
      const now = new Date().toISOString();

      const forkReference: ForkReference = {
        federatedId: sourceFederatedId,
        platform: sourcePlatform,
        forkedAt: now,
        sourceVersionHash: sourceState?.versionHash,
      };

      const forkState: CardSyncState = {
        localId: forkLocalId,
        federatedId: forkFederatedId,
        platformIds: { [targetPlatform]: forkLocalId },
        lastSync: { [targetPlatform]: now },
        versionHash: forkHash,
        status: 'synced',
        forkedFrom: forkReference,
      };

      await this.stateStore.set(forkState);

      this.emit('card:forked', {
        forkState,
        sourceFederatedId,
        sourcePlatform,
        targetPlatform,
      });

      return {
        success: true,
        operation,
        forkState,
        sourceFederatedId,
        forkFederatedId,
      };
    } catch (err) {
      this.emit('sync:failed', { operation, error: err });

      return {
        success: false,
        operation,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Create a forked card with fork metadata in extensions
   */
  private createForkedCard(
    source: CCv3Data,
    sourceFederatedId: string,
    sourcePlatform: PlatformId,
    sourceVersionHash?: string,
    modifications?: Partial<CCv3Data['data']>
  ): CCv3Data {
    const now = new Date().toISOString();

    // Deep clone the source card
    const forked: CCv3Data = JSON.parse(JSON.stringify(source));

    // Apply modifications if provided
    if (modifications) {
      Object.assign(forked.data, modifications);
    }

    // Ensure extensions object exists
    if (!forked.data.extensions) {
      forked.data.extensions = {};
    }

    // Add fork metadata to character-foundry extension
    const cfExtension = (forked.data.extensions['character-foundry'] as Record<string, unknown>) || {};
    cfExtension.forkedFrom = {
      federatedId: sourceFederatedId,
      platform: sourcePlatform,
      forkedAt: now,
      sourceVersionHash,
    };
    forked.data.extensions['character-foundry'] = cfExtension;

    // Update version info
    forked.data.character_version = generateUUID();

    return forked;
  }

  /**
   * Handle incoming fork notification
   *
   * Called when another instance notifies us that they forked one of our cards.
   * Increments the fork count and stores the notification.
   */
  async handleForkNotification(activity: ForkActivity): Promise<void> {
    const parsed = parseForkActivity(activity);
    if (!parsed) {
      throw new Error('Invalid fork activity');
    }

    const { sourceCardId, actor } = parsed;

    // Find our sync state for the source card
    const sourceState = await this.stateStore.get(sourceCardId);
    if (!sourceState) {
      // We don't have this card tracked - might be from before federation
      // or the card was deleted. Just ignore.
      return;
    }

    // Determine the forking platform from the actor URL
    // Actor URLs are typically like: https://hub.example.com/users/alice
    let forkPlatform: PlatformId = 'custom';
    if (actor.includes('archive')) forkPlatform = 'archive';
    else if (actor.includes('hub')) forkPlatform = 'hub';
    else if (actor.includes('editor')) forkPlatform = 'editor';
    else if (actor.includes('chub')) forkPlatform = 'chub';
    else if (actor.includes('risu')) forkPlatform = 'risu';

    const notification: ForkNotification = {
      forkId: parsed.forkedCard.id,
      actorId: actor,
      platform: forkPlatform,
      timestamp: new Date().toISOString(),
    };

    // Update state (increment count, add notification)
    const notifications = sourceState.forkNotifications || [];
    if (notifications.length < 100) {
      notifications.push(notification);
    }

    sourceState.forksCount = (sourceState.forksCount || 0) + 1;
    sourceState.forkNotifications = notifications;

    await this.stateStore.set(sourceState);

    this.emit('card:fork-received', {
      sourceCardId,
      notification,
      newForkCount: sourceState.forksCount,
    });
  }

  /**
   * Handle incoming install notification
   *
   * Called when a consumer (SillyTavern, Voxta) notifies us that they installed one of our cards.
   * Increments the install count and stores the notification.
   */
  async handleInstallNotification(activity: InstallActivity): Promise<void> {
    const parsed = parseInstallActivity(activity);
    if (!parsed) {
      throw new Error('Invalid install activity');
    }

    const { cardId, actor, platform } = parsed;

    // Find our sync state for the card
    const cardState = await this.stateStore.get(cardId);
    if (!cardState) {
      // We don't have this card tracked - might be from before federation
      // or the card was deleted. Just ignore.
      return;
    }

    // Determine the installing platform
    const installPlatform: PlatformId = platform || 'custom';

    // Initialize stats if needed
    if (!cardState.stats) {
      cardState.stats = {
        installCount: 0,
        installsByPlatform: {},
        forkCount: cardState.forksCount || 0,
        likeCount: 0,
        lastUpdated: new Date().toISOString(),
      };
    }

    // Increment counts
    cardState.stats.installCount++;
    cardState.stats.installsByPlatform[installPlatform] =
      (cardState.stats.installsByPlatform[installPlatform] || 0) + 1;
    cardState.stats.lastUpdated = new Date().toISOString();

    await this.stateStore.set(cardState);

    this.emit('card:install-received', {
      cardId,
      platform: installPlatform,
      actorId: actor,
      newInstallCount: cardState.stats.installCount,
    });
  }

  /**
   * Get stats for a card
   */
  async getCardStats(federatedId: string): Promise<CardStats | null> {
    const state = await this.stateStore.get(federatedId);
    return state?.stats || null;
  }

  /**
   * Get fork count for a card
   */
  async getForkCount(federatedId: string): Promise<number> {
    const state = await this.stateStore.get(federatedId);
    return state?.forksCount || 0;
  }

  /**
   * Get install count for a card
   */
  async getInstallCount(federatedId: string): Promise<number> {
    const state = await this.stateStore.get(federatedId);
    return state?.stats?.installCount || 0;
  }

  /**
   * Find all local forks of a source card
   */
  async findForks(sourceFederatedId: string): Promise<CardSyncState[]> {
    const allStates = await this.stateStore.list();
    return allStates.filter(
      (state) => state.forkedFrom?.federatedId === sourceFederatedId
    );
  }

  /**
   * Stop the sync engine
   */
  dispose(): void {
    if (this.autoSyncTimer) {
      clearInterval(this.autoSyncTimer);
    }
    this.listeners.clear();
  }
}
