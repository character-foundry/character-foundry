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
 * To enable federation features, you MUST:
 * 1. Set FEDERATION_ENABLED=true in your environment
 * 2. Call enableFederation() before using SyncEngine or route handlers
 *
 * Both steps are required as a dual opt-in safety mechanism.
 */

let explicitlyEnabled = false;

/**
 * Enable federation features. Must be called before using SyncEngine or route handlers.
 * This is a safety gate - federation is experimental and has incomplete security.
 *
 * Note: Both this call AND FEDERATION_ENABLED=true are required (dual opt-in).
 */
export function enableFederation(): void {
  explicitlyEnabled = true;
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    console.warn(
      '[character-foundry/federation] Federation enabled. ' +
      'WARNING: HTTP signature validation is NOT implemented. ' +
      'Do NOT use in production with untrusted inputs.'
    );
  }
}

/**
 * Check if federation is enabled (requires BOTH env var AND enableFederation() call)
 */
export function isFederationEnabled(): boolean {
  const envEnabled = process.env.FEDERATION_ENABLED === 'true';
  // Require BOTH explicit enableFederation() call AND env var
  return explicitlyEnabled && envEnabled;
}

/**
 * Assert federation is enabled, throw if not
 * @internal
 */
export function assertFederationEnabled(feature: string): void {
  const envEnabled = process.env.FEDERATION_ENABLED === 'true';

  if (!explicitlyEnabled && !envEnabled) {
    throw new Error(
      `Federation is not enabled. ${feature} requires federation to be explicitly enabled. ` +
      `You must BOTH call enableFederation() AND set FEDERATION_ENABLED=true. ` +
      `WARNING: Federation security features are incomplete.`
    );
  }

  if (!explicitlyEnabled) {
    throw new Error(
      `Federation not explicitly enabled. ${feature} requires enableFederation() to be called. ` +
      `Environment variable alone is not sufficient (dual opt-in required).`
    );
  }

  if (!envEnabled) {
    throw new Error(
      `FEDERATION_ENABLED environment variable not set. ${feature} requires FEDERATION_ENABLED=true. ` +
      `Code opt-in alone is not sufficient (dual opt-in required).`
    );
  }
}

// Core types
export type {
  FederatedCardId,
  PlatformId,
  PlatformRole,
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
  // Fork types
  ForkReference,
  ForkNotification,
  ForkActivity,
  ForkResult,
  InboxResult,
  InboxHandlerOptions,
  // Install/stats types
  InstallNotification,
  InstallActivity,
  CardStats,
} from './types.js';

// ActivityPub utilities
export {
  ACTIVITY_CONTEXT,
  FORK_ACTIVITY_CONTEXT,
  INSTALL_ACTIVITY_CONTEXT,
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
  createForkActivity,
  parseForkActivity,
  createInstallActivity,
  parseInstallActivity,
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

export {
  D1SyncStateStore,
  type D1Database,
  type D1PreparedStatement,
  type D1Result,
  type D1ExecResult,
} from './d1-store.js';

// Platform adapters
export {
  BasePlatformAdapter,
  MemoryPlatformAdapter,
  HttpPlatformAdapter,
  InvalidResourceIdError,
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
  type STCharacterStats,
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
  handleInbox,
  validateForkActivity,
  validateInstallActivity,
} from './routes/index.js';

// HTTP Signatures
export {
  REQUIRED_SIGNED_HEADERS,
  type ParsedSignature,
  type SignatureValidationOptions,
  type SignatureValidationResult,
  type SigningOptions,
  parseSignatureHeader,
  buildSigningString,
  verifyHttpSignature,
  validateActivitySignature as validateHttpSignature,
  signRequest,
  calculateDigest,
} from './http-signatures.js';
