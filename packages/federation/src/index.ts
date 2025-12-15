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
 * 1. Set FEDERATION_ENABLED=true in your environment (Node.js) or call enableFederation({ skipEnvCheck: true }) in browser/Workers
 * 2. Call enableFederation() before using SyncEngine or route handlers
 *
 * Both steps are required as a dual opt-in safety mechanism (except in environments without process.env).
 */

let explicitlyEnabled = false;
let envCheckSkipped = false;

/**
 * Safe check for environment variable - works in Node.js, browser, and Workers
 */
function getEnvVar(name: string): string | undefined {
  // Check if process exists and has env (Node.js)
  if (typeof process !== 'undefined' && process?.env) {
    return process.env[name];
  }
  // In browser/Workers, return undefined (env var check will be skipped)
  return undefined;
}

/**
 * Enable federation features. Must be called before using SyncEngine or route handlers.
 * This is a safety gate - federation is experimental and has incomplete security.
 *
 * @param options.skipEnvCheck - Skip FEDERATION_ENABLED env var check (required for browser/Workers)
 *
 * Note: In Node.js, both this call AND FEDERATION_ENABLED=true are required (dual opt-in).
 * In browser/Workers, use skipEnvCheck: true since env vars aren't available.
 */
export function enableFederation(options?: { skipEnvCheck?: boolean }): void {
  explicitlyEnabled = true;
  envCheckSkipped = options?.skipEnvCheck ?? false;

  const nodeEnv = getEnvVar('NODE_ENV');
  if (nodeEnv === 'development' || nodeEnv === 'test') {
    console.warn(
      '[character-foundry/federation] Federation enabled. ' +
      'WARNING: Verify HTTP signatures in production. ' +
      'Do NOT use in production with untrusted inputs without signature validation.'
    );
  }
}

/**
 * Check if federation is enabled
 *
 * In Node.js: requires BOTH env var AND enableFederation() call
 * In browser/Workers with skipEnvCheck: requires only enableFederation() call
 */
export function isFederationEnabled(): boolean {
  if (!explicitlyEnabled) {
    return false;
  }

  // If env check was skipped (browser/Workers), only check explicit enable
  if (envCheckSkipped) {
    return true;
  }

  // In Node.js, also require env var
  const envEnabled = getEnvVar('FEDERATION_ENABLED') === 'true';
  return envEnabled;
}

/**
 * Assert federation is enabled, throw if not
 * @internal
 */
export function assertFederationEnabled(feature: string): void {
  if (!explicitlyEnabled) {
    const hasProcess = typeof process !== 'undefined' && process?.env;
    const envHint = hasProcess
      ? 'You must BOTH call enableFederation() AND set FEDERATION_ENABLED=true.'
      : 'You must call enableFederation({ skipEnvCheck: true }) in browser/Workers environments.';

    throw new Error(
      `Federation is not enabled. ${feature} requires federation to be explicitly enabled. ` +
      `${envHint} ` +
      `WARNING: Federation security features are incomplete.`
    );
  }

  // If env check was skipped, we're done
  if (envCheckSkipped) {
    return;
  }

  // In Node.js, also check env var
  const envEnabled = getEnvVar('FEDERATION_ENABLED') === 'true';
  if (!envEnabled) {
    throw new Error(
      `FEDERATION_ENABLED environment variable not set. ${feature} requires FEDERATION_ENABLED=true. ` +
      `Code opt-in alone is not sufficient (dual opt-in required). ` +
      `In browser/Workers, use enableFederation({ skipEnvCheck: true }) instead.`
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
  // validateActivitySignature is deprecated - use validateHttpSignature instead
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

// Moderation - community-based content moderation tools
export {
  // Activity types
  type FlagActivity,
  type BlockActivity,
  // Report types
  type ModerationReport,
  type ReportStatus,
  type ReportCategory,
  // Action types
  type ModerationAction,
  type ActionType,
  // Block types
  type InstanceBlock,
  type InstanceBlockLevel,
  // Policy types
  type ContentPolicy,
  type ContentPolicyRule,
  type PolicyRuleType,
  type PolicyAction,
  type PolicyEvaluationResult,
  // Rate limit types
  type RateLimitBucket,
  type RateLimitResult,
  // Store interface
  type ModerationStore,
  // Event types
  type ModerationEvent,
  type ModerationEventType,
  type ModerationEventListener,
  // Activities
  MODERATION_ACTIVITY_CONTEXT,
  createFlagActivity,
  parseFlagActivity,
  validateFlagActivity as validateFlagActivityFields,
  createBlockActivity,
  parseBlockActivity,
  validateBlockActivity as validateBlockActivityFields,
  // Stores
  MemoryModerationStore,
  D1ModerationStore,
  // Engines
  PolicyEngine,
  RateLimiter,
  type RateLimiterConfig,
} from './moderation/index.js';
