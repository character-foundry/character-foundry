/**
 * @character-foundry/federation
 *
 * Federation layer for syncing character cards across platforms via ActivityPub.
 */

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
