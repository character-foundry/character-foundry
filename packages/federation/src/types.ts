/**
 * Federation Types
 *
 * Core types for ActivityPub-based character card federation.
 */

import type { CCv3Data } from '@character-foundry/schemas';

/**
 * Unique identifier for a federated card
 * Format: {platform}:{id} or full URI
 */
export type FederatedCardId = string;

/**
 * Platform identifier
 */
export type PlatformId =
  | 'archive'      // Character Archive
  | 'hub'          // CardsHub
  | 'editor'       // Card Editor
  | 'sillytavern'  // SillyTavern (via plugin)
  | 'risu'         // RisuAI
  | 'chub'         // Chub.ai
  | 'custom';      // Custom platform

/**
 * ActivityPub Actor representing a creator/user
 */
export interface FederatedActor {
  /** ActivityPub context */
  '@context'?: ActivityPubContext;
  /** ActivityPub ID (URI) */
  id: string;
  /** Actor type */
  type: 'Person' | 'Service' | 'Application';
  /** Display name */
  name: string;
  /** Username/handle */
  preferredUsername: string;
  /** Profile summary */
  summary?: string;
  /** Avatar URL */
  icon?: string;
  /** Inbox URL for receiving activities */
  inbox: string;
  /** Outbox URL for published activities */
  outbox: string;
  /** Followers collection URL */
  followers?: string;
  /** Following collection URL */
  following?: string;
  /** Public key for HTTP signatures */
  publicKey?: {
    id: string;
    owner: string;
    publicKeyPem: string;
  };
}

/**
 * ActivityPub context type - can be a string, or an array of strings and objects
 */
export type ActivityPubContext = string | (string | Record<string, unknown>)[];

/**
 * ActivityPub Object representing a character card
 */
export interface FederatedCard {
  /** ActivityPub context */
  '@context': ActivityPubContext;
  /** Unique ID (URI) */
  id: string;
  /** Object type */
  type: 'Note' | 'Article' | 'Document';
  /** Card name/title */
  name: string;
  /** Card description/summary */
  summary?: string;
  /** Full card content (JSON stringified CCv3Data) */
  content: string;
  /** Content media type */
  mediaType: 'application/json';
  /** Creator actor */
  attributedTo: string;
  /** Publication timestamp */
  published: string;
  /** Last update timestamp */
  updated?: string;
  /** Tags/hashtags */
  tag?: Array<{
    type: 'Hashtag';
    name: string;
    href?: string;
  }>;
  /** Attached assets */
  attachment?: Array<{
    type: 'Document' | 'Image' | 'Audio';
    mediaType: string;
    url: string;
    name?: string;
  }>;
  /** Source platform */
  source?: {
    platform: PlatformId;
    id: string;
    url?: string;
  };
  /** Card version */
  'character:version'?: string;
  /** Card spec version */
  'character:spec'?: string;
}

/**
 * ActivityPub Activity types for cards
 */
export type ActivityType =
  | 'Create'    // New card published
  | 'Update'    // Card modified
  | 'Delete'    // Card removed
  | 'Announce'  // Reshare/boost
  | 'Like'      // Favorite
  | 'Follow'    // Subscribe to creator
  | 'Undo'      // Undo previous activity
  | 'Fork'      // Fork/derive from another card
  | 'Install';  // Consumer installed a card (stats notification)

/**
 * Platform role in federation topology
 */
export type PlatformRole =
  | 'publisher'   // Archive: sends Create/Update to Hub, Architect
  | 'hub'         // Hub: bi-directional with Architect, distributes to consumers
  | 'architect'   // Architect: bi-directional with Hub, sends to ST/Voxta
  | 'consumer';   // ST/Voxta: receive-only, send install stats back

/**
 * Fork reference stored in card extensions
 * Path: card.data.extensions['character-foundry'].forkedFrom
 */
export interface ForkReference {
  /** Federated URI of the source card */
  federatedId: string;
  /** Source platform identifier */
  platform: PlatformId;
  /** Timestamp when forked */
  forkedAt: string;
  /** Source version hash at fork time */
  sourceVersionHash?: string;
}

/**
 * Fork notification received by source instance
 */
export interface ForkNotification {
  /** Federated URI of the fork */
  forkId: string;
  /** Actor who created the fork */
  actorId: string;
  /** Platform where fork was created */
  platform: PlatformId;
  /** Timestamp of fork */
  timestamp: string;
}

/**
 * Install notification received by source instance
 * Consumers (SillyTavern, Voxta) send these when a card is installed
 */
export interface InstallNotification {
  /** Platform where card was installed */
  platform: PlatformId;
  /** Actor/user who installed (if known) */
  actorId?: string;
  /** Timestamp of installation */
  timestamp: string;
}

/**
 * Aggregated stats for a card
 */
export interface CardStats {
  /** Total known installs across all platforms */
  installCount: number;
  /** Install counts per platform */
  installsByPlatform: Partial<Record<PlatformId, number>>;
  /** Fork count (separate from forkNotifications for efficiency) */
  forkCount: number;
  /** Like/favorite count */
  likeCount: number;
  /** Last time any stat was updated */
  lastUpdated: string;
}

/**
 * Install activity - consumer notifies hub about card installation
 */
export interface InstallActivity extends Omit<FederatedActivity, 'type' | 'object'> {
  type: 'Install';
  /** Card URI that was installed */
  object: string;
  /** Platform where installed */
  target?: {
    type: 'Application';
    name: PlatformId;
  };
}

/**
 * ActivityPub Activity
 */
export interface FederatedActivity {
  '@context': ActivityPubContext;
  id: string;
  type: ActivityType;
  actor: string;
  object: string | FederatedCard;
  published: string;
  to?: string[];
  cc?: string[];
}

/**
 * Sync state for a card across platforms
 */
export interface CardSyncState {
  /** Local card ID */
  localId: string;
  /** Federated card ID (ActivityPub URI) */
  federatedId: string;
  /** Platform-specific IDs (only set for synced platforms) */
  platformIds: Partial<Record<PlatformId, string>>;
  /** Last sync timestamp per platform (only set for synced platforms) */
  lastSync: Partial<Record<PlatformId, string>>;
  /** Current version hash */
  versionHash: string;
  /** Sync status */
  status: 'synced' | 'pending' | 'conflict' | 'error';
  /** Conflict details if any */
  conflict?: {
    localVersion: string;
    remoteVersion: string;
    remotePlatform: PlatformId;
  };
  /** Fork reference if this card is a fork */
  forkedFrom?: ForkReference;
  /** Count of known forks of this card */
  forksCount?: number;
  /** References to known forks (capped at 100 to prevent unbounded growth) */
  forkNotifications?: ForkNotification[];
  /** Aggregated stats for this card */
  stats?: CardStats;
}

/**
 * Sync operation
 */
export interface SyncOperation {
  type: 'push' | 'pull' | 'delete' | 'resolve' | 'fork';
  cardId: FederatedCardId;
  sourcePlatform: PlatformId;
  targetPlatform: PlatformId;
  timestamp: string;
}

/**
 * Sync result
 */
export interface SyncResult {
  success: boolean;
  operation: SyncOperation;
  newState?: CardSyncState;
  error?: string;
}

/**
 * Platform adapter interface
 * Each platform implements this to enable federation
 */
export interface PlatformAdapter {
  /** Platform identifier */
  readonly platform: PlatformId;

  /** Platform display name */
  readonly displayName: string;

  /** Whether the platform is currently available */
  isAvailable(): Promise<boolean>;

  /** Get a card by local ID */
  getCard(localId: string): Promise<CCv3Data | null>;

  /** List all cards (with optional pagination) */
  listCards(options?: {
    limit?: number;
    offset?: number;
    since?: string;
  }): Promise<Array<{ id: string; card: CCv3Data; updatedAt: string }>>;

  /** Save/update a card */
  saveCard(card: CCv3Data, localId?: string): Promise<string>;

  /** Delete a card */
  deleteCard(localId: string): Promise<boolean>;

  /** Get card assets */
  getAssets(localId: string): Promise<Array<{
    name: string;
    type: string;
    data: Uint8Array;
  }>>;

  /** Get the last modified timestamp for a card */
  getLastModified(localId: string): Promise<string | null>;
}

/**
 * Federation hub configuration
 */
export interface FederationConfig {
  /** This instance's ActivityPub actor */
  actor: FederatedActor;
  /** Registered platform adapters */
  platforms: Map<PlatformId, PlatformAdapter>;
  /** Sync state storage */
  stateStore: SyncStateStore;
  /** HTTP signature keys */
  keys?: {
    privateKey: string;
    publicKey: string;
  };
}

/**
 * Sync state storage interface
 */
export interface SyncStateStore {
  /** Get sync state for a card */
  get(federatedId: string): Promise<CardSyncState | null>;

  /** Save sync state */
  set(state: CardSyncState): Promise<void>;

  /** Delete sync state */
  delete(federatedId: string): Promise<void>;

  /** List all sync states */
  list(): Promise<CardSyncState[]>;

  /** Find by platform ID */
  findByPlatformId(platform: PlatformId, platformId: string): Promise<CardSyncState | null>;
}

/**
 * Federation event types
 */
export type FederationEventType =
  | 'card:created'
  | 'card:updated'
  | 'card:deleted'
  | 'card:synced'
  | 'card:conflict'
  | 'card:forked'           // When we create a fork
  | 'card:fork-received'    // When we receive fork notification
  | 'card:installed'        // When we push to a consumer
  | 'card:install-received' // When we receive install notification
  | 'sync:started'
  | 'sync:completed'
  | 'sync:failed'
  | 'sync:skipped'
  | 'actor:followed'
  | 'actor:unfollowed';

/**
 * Federation event
 */
export interface FederationEvent {
  type: FederationEventType;
  timestamp: string;
  data: unknown;
}

/**
 * Event listener
 */
export type FederationEventListener = (event: FederationEvent) => void | Promise<void>;

/**
 * Fork activity - custom ActivityPub extension
 */
export interface ForkActivity extends Omit<FederatedActivity, 'type' | 'object'> {
  type: 'Fork';
  /** Source card URI being forked */
  object: string;
  /** The newly created fork */
  result: FederatedCard;
}

/**
 * Fork operation result
 */
export interface ForkResult {
  success: boolean;
  operation: SyncOperation;
  forkState?: CardSyncState;
  sourceFederatedId?: string;
  forkFederatedId?: string;
  error?: string;
}

/**
 * Inbox handler result
 */
export interface InboxResult {
  accepted: boolean;
  error?: string;
  activityType?: ActivityType;
}

/**
 * Inbox handler options
 */
export interface InboxHandlerOptions {
  /** Fetch actor by ID for signature verification */
  fetchActor: (actorId: string) => Promise<FederatedActor | null>;
  /** Strict mode for signature validation */
  strictMode?: boolean;
  /** Maximum age for signatures in seconds (default 300) */
  maxAge?: number;
}
