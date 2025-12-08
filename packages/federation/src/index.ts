/**
 * @character-foundry/federation
 *
 * Federation layer for syncing character cards across platforms via ActivityPub.
 *
 * ⚠️  WARNING: This package is experimental and incomplete.
 *
 * Security-critical features (signature validation, inbox handling) are stubbed.
 * Do NOT use in production without explicit opt-in.
 *
 * To enable federation features, set FEDERATION_ENABLED=true in your environment
 * or call enableFederation() before using SyncEngine or route handlers.
 */

let federationEnabled = false;

/**
 * Enable federation features. Must be called before using SyncEngine or route handlers.
 * This is a safety gate - federation is experimental and has incomplete security.
 */
export function enableFederation(): void {
  federationEnabled = true;
}

/**
 * Check if federation is enabled
 */
export function isFederationEnabled(): boolean {
  return federationEnabled || process.env.FEDERATION_ENABLED === 'true';
}

/**
 * Assert federation is enabled, throw if not
 * @internal
 */
export function assertFederationEnabled(feature: string): void {
  if (!isFederationEnabled()) {
    throw new Error(
      `Federation is not enabled. ${feature} requires federation to be explicitly enabled. ` +
      `Call enableFederation() or set FEDERATION_ENABLED=true to proceed. ` +
      `WARNING: Federation security features are incomplete.`
    );
  }
}

// Core types
export type {
  FederatedCardId,
  PlatformId,
  FederatedActor,
  FederatedCard,
  ActivityType,
  FederatedActivity,
  CardSyncState,
  SyncOperation,
  SyncResult,
  PlatformAdapter,
  FederationConfig,
  SyncStateStore,
  FederationEventType,
  FederationEvent,
  FederationEventListener,
} from './types.js';

// ActivityPub utilities
export {
  ACTIVITY_CONTEXT,
  generateCardId,
  generateActivityId,
  cardToActivityPub,
  cardFromActivityPub,
  createCreateActivity,
  createUpdateActivity,
  createDeleteActivity,
  createAnnounceActivity,
  createLikeActivity,
  createUndoActivity,
  createActor,
  parseActivity,
  validateActivitySignature,
} from './activitypub.js';

// Sync engine
export {
  SyncEngine,
  type SyncEngineOptions,
} from './sync-engine.js';

// State stores
export {
  MemorySyncStateStore,
  FileSyncStateStore,
  createLocalStorageStore,
} from './state-store.js';

// Platform adapters
export {
  BasePlatformAdapter,
  MemoryPlatformAdapter,
  HttpPlatformAdapter,
  SillyTavernAdapter,
  createArchiveAdapter,
  createHubAdapter,
  stCharacterToCCv3,
  ccv3ToSTCharacter,
  createMockSTBridge,
  type AdapterCard,
  type AdapterAsset,
  type HttpAdapterConfig,
  type FetchFn,
  type SillyTavernBridge,
  type STCharacter,
} from './adapters/index.js';

// Routes
export {
  handleWebFinger,
  type WebFingerResponse,
  type WebFingerLink,
  handleNodeInfoDiscovery,
  handleNodeInfo,
  type NodeInfoDiscoveryResponse,
  type NodeInfoResponse,
  handleActor,
} from './routes/index.js';
