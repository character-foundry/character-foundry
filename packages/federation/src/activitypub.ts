/**
 * ActivityPub Utilities
 *
 * Convert character cards to/from ActivityPub format.
 */

import type { CCv3Data } from '@character-foundry/schemas';
import { generateUUID } from '@character-foundry/core';
import type {
  FederatedCard,
  FederatedActivity,
  FederatedActor,
  ActivityType,
  PlatformId,
  ForkActivity,
  InstallActivity,
} from './types.js';

/**
 * ActivityPub context for character cards
 */
export const ACTIVITY_CONTEXT = [
  'https://www.w3.org/ns/activitystreams',
  {
    'character': 'https://character-foundry.dev/ns#',
    'character:version': { '@id': 'character:version' },
    'character:spec': { '@id': 'character:spec' },
  },
];

/**
 * Extended ActivityPub context for Fork activities
 * Includes custom character-foundry namespace for fork semantics
 */
export const FORK_ACTIVITY_CONTEXT = [
  'https://www.w3.org/ns/activitystreams',
  {
    'character': 'https://character-foundry.dev/ns#',
    'character:version': { '@id': 'character:version' },
    'character:spec': { '@id': 'character:spec' },
    'Fork': 'character:Fork',
    'forkedFrom': { '@id': 'character:forkedFrom', '@type': '@id' },
  },
];

/**
 * Extended ActivityPub context for Install activities
 * Used by consumers (SillyTavern, Voxta) to notify hub about installations
 */
export const INSTALL_ACTIVITY_CONTEXT = [
  'https://www.w3.org/ns/activitystreams',
  {
    'character': 'https://character-foundry.dev/ns#',
    'Install': 'character:Install',
  },
];

/**
 * Generate a unique ID for a federated card
 */
export function generateCardId(baseUrl: string, localId: string): string {
  return `${baseUrl}/cards/${localId}`;
}

/**
 * Generate a unique ID for an activity using crypto-grade randomness
 */
export function generateActivityId(baseUrl: string): string {
  const timestamp = Date.now();
  const random = generateUUID().split('-')[0]; // Use first segment of UUID
  return `${baseUrl}/activities/${timestamp}-${random}`;
}

/**
 * Convert a CCv3 card to ActivityPub FederatedCard format
 */
export function cardToActivityPub(
  card: CCv3Data,
  options: {
    id: string;
    actorId: string;
    published?: string;
    updated?: string;
    sourcePlatform?: PlatformId;
    sourceId?: string;
    sourceUrl?: string;
    attachments?: Array<{
      type: 'Image' | 'Audio' | 'Document';
      mediaType: string;
      url: string;
      name?: string;
    }>;
  }
): FederatedCard {
  const now = new Date().toISOString();
  const cardData = card.data;

  // Convert tags to ActivityPub hashtags
  const tags = cardData.tags?.map((tag) => ({
    type: 'Hashtag' as const,
    name: `#${tag.replace(/\s+/g, '_')}`,
  }));

  const federatedCard: FederatedCard = {
    '@context': ACTIVITY_CONTEXT,
    id: options.id,
    type: 'Note',
    name: cardData.name,
    summary: cardData.description?.substring(0, 500),
    content: JSON.stringify(card),
    mediaType: 'application/json',
    attributedTo: options.actorId,
    published: options.published || now,
    updated: options.updated,
    tag: tags,
    attachment: options.attachments,
    'character:version': cardData.character_version,
    'character:spec': card.spec_version,
  };

  // Add source info if provided
  if (options.sourcePlatform && options.sourceId) {
    federatedCard.source = {
      platform: options.sourcePlatform,
      id: options.sourceId,
      url: options.sourceUrl,
    };
  }

  return federatedCard;
}

/**
 * Extract CCv3 card from ActivityPub FederatedCard
 */
export function cardFromActivityPub(federatedCard: FederatedCard): CCv3Data {
  try {
    const card = JSON.parse(federatedCard.content) as CCv3Data;

    // Validate it's a proper CCv3 card
    if (card.spec !== 'chara_card_v3') {
      throw new Error('Invalid card spec');
    }

    return card;
  } catch (err) {
    throw new Error(
      `Failed to parse card from ActivityPub: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/**
 * Create a Create activity for a new card
 */
export function createCreateActivity(
  card: FederatedCard,
  actorId: string,
  baseUrl: string,
  recipients?: { to?: string[]; cc?: string[] }
): FederatedActivity {
  return {
    '@context': ACTIVITY_CONTEXT,
    id: generateActivityId(baseUrl),
    type: 'Create',
    actor: actorId,
    object: card,
    published: new Date().toISOString(),
    to: recipients?.to || ['https://www.w3.org/ns/activitystreams#Public'],
    cc: recipients?.cc,
  };
}

/**
 * Create an Update activity for a modified card
 */
export function createUpdateActivity(
  card: FederatedCard,
  actorId: string,
  baseUrl: string,
  recipients?: { to?: string[]; cc?: string[] }
): FederatedActivity {
  return {
    '@context': ACTIVITY_CONTEXT,
    id: generateActivityId(baseUrl),
    type: 'Update',
    actor: actorId,
    object: card,
    published: new Date().toISOString(),
    to: recipients?.to || ['https://www.w3.org/ns/activitystreams#Public'],
    cc: recipients?.cc,
  };
}

/**
 * Create a Delete activity for a removed card
 */
export function createDeleteActivity(
  cardId: string,
  actorId: string,
  baseUrl: string,
  recipients?: { to?: string[]; cc?: string[] }
): FederatedActivity {
  return {
    '@context': ACTIVITY_CONTEXT,
    id: generateActivityId(baseUrl),
    type: 'Delete',
    actor: actorId,
    object: cardId,
    published: new Date().toISOString(),
    to: recipients?.to || ['https://www.w3.org/ns/activitystreams#Public'],
    cc: recipients?.cc,
  };
}

/**
 * Create an Announce (reshare) activity
 */
export function createAnnounceActivity(
  cardId: string,
  actorId: string,
  baseUrl: string,
  recipients?: { to?: string[]; cc?: string[] }
): FederatedActivity {
  return {
    '@context': ACTIVITY_CONTEXT,
    id: generateActivityId(baseUrl),
    type: 'Announce',
    actor: actorId,
    object: cardId,
    published: new Date().toISOString(),
    to: recipients?.to || ['https://www.w3.org/ns/activitystreams#Public'],
    cc: recipients?.cc,
  };
}

/**
 * Create a Like activity
 */
export function createLikeActivity(
  cardId: string,
  actorId: string,
  baseUrl: string
): FederatedActivity {
  return {
    '@context': ACTIVITY_CONTEXT,
    id: generateActivityId(baseUrl),
    type: 'Like',
    actor: actorId,
    object: cardId,
    published: new Date().toISOString(),
  };
}

/**
 * Create an Undo activity
 */
export function createUndoActivity(
  originalActivityId: string,
  actorId: string,
  baseUrl: string
): FederatedActivity {
  return {
    '@context': ACTIVITY_CONTEXT,
    id: generateActivityId(baseUrl),
    type: 'Undo',
    actor: actorId,
    object: originalActivityId,
    published: new Date().toISOString(),
  };
}

/**
 * Create a Fork activity for card derivation
 *
 * Fork activities notify the source instance that a card was forked.
 * The forked card contains a reference to the source in its extensions.
 */
export function createForkActivity(
  sourceCardId: string,
  forkedCard: FederatedCard,
  actorId: string,
  baseUrl: string,
  recipients?: { to?: string[]; cc?: string[] }
): ForkActivity {
  return {
    '@context': FORK_ACTIVITY_CONTEXT,
    id: generateActivityId(baseUrl),
    type: 'Fork',
    actor: actorId,
    object: sourceCardId,
    result: forkedCard,
    published: new Date().toISOString(),
    to: recipients?.to || ['https://www.w3.org/ns/activitystreams#Public'],
    cc: recipients?.cc,
  };
}

/**
 * Parse an incoming Fork activity
 *
 * @returns Parsed fork data or null if invalid
 */
export function parseForkActivity(activity: unknown): {
  sourceCardId: string;
  forkedCard: FederatedCard;
  actor: string;
  activityId: string;
} | null {
  if (!activity || typeof activity !== 'object') {
    return null;
  }

  const act = activity as Record<string, unknown>;

  // Verify it's a Fork activity
  if (act.type !== 'Fork') {
    return null;
  }

  // Validate required fields
  if (
    typeof act.actor !== 'string' ||
    typeof act.object !== 'string' ||
    typeof act.id !== 'string' ||
    !act.result ||
    typeof act.result !== 'object'
  ) {
    return null;
  }

  const result = act.result as Record<string, unknown>;

  // Validate the forked card has required fields
  if (
    typeof result.id !== 'string' ||
    typeof result.content !== 'string' ||
    typeof result.attributedTo !== 'string'
  ) {
    return null;
  }

  return {
    sourceCardId: act.object,
    forkedCard: result as unknown as FederatedCard,
    actor: act.actor,
    activityId: act.id,
  };
}

/**
 * Create an Install activity for notifying hub about card installation
 *
 * Consumers (SillyTavern, Voxta) send this when a card is installed/saved.
 */
export function createInstallActivity(
  cardId: string,
  actorId: string,
  baseUrl: string,
  platform: PlatformId,
  recipients?: { to?: string[]; cc?: string[] }
): InstallActivity {
  return {
    '@context': INSTALL_ACTIVITY_CONTEXT,
    id: generateActivityId(baseUrl),
    type: 'Install',
    actor: actorId,
    object: cardId,
    target: {
      type: 'Application',
      name: platform,
    },
    published: new Date().toISOString(),
    to: recipients?.to,
    cc: recipients?.cc,
  };
}

/**
 * Parse an incoming Install activity
 *
 * @returns Parsed install data or null if invalid
 */
export function parseInstallActivity(activity: unknown): {
  cardId: string;
  actor: string;
  platform: PlatformId | null;
  activityId: string;
} | null {
  if (!activity || typeof activity !== 'object') {
    return null;
  }

  const act = activity as Record<string, unknown>;

  // Verify it's an Install activity
  if (act.type !== 'Install') {
    return null;
  }

  // Validate required fields
  if (
    typeof act.actor !== 'string' ||
    typeof act.object !== 'string' ||
    typeof act.id !== 'string'
  ) {
    return null;
  }

  // Extract platform from target if present
  let platform: PlatformId | null = null;
  if (act.target && typeof act.target === 'object') {
    const target = act.target as Record<string, unknown>;
    if (target.type === 'Application' && typeof target.name === 'string') {
      platform = target.name as PlatformId;
    }
  }

  return {
    cardId: act.object,
    actor: act.actor,
    platform,
    activityId: act.id,
  };
}

/**
 * Create a minimal actor object
 */
export function createActor(options: {
  id: string;
  username: string;
  displayName: string;
  summary?: string;
  icon?: string;
  baseUrl: string;
  publicKeyPem?: string;
}): FederatedActor {
  const actor: FederatedActor = {
    id: options.id,
    type: 'Person',
    name: options.displayName,
    preferredUsername: options.username,
    summary: options.summary,
    icon: options.icon,
    inbox: `${options.id}/inbox`,
    outbox: `${options.id}/outbox`,
    followers: `${options.id}/followers`,
    following: `${options.id}/following`,
  };

  if (options.publicKeyPem) {
    actor.publicKey = {
      id: `${options.id}#main-key`,
      owner: options.id,
      publicKeyPem: options.publicKeyPem,
    };
  }

  return actor;
}

/**
 * Parse an incoming activity
 */
export function parseActivity(data: unknown): FederatedActivity {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid activity: not an object');
  }

  const activity = data as Record<string, unknown>;

  if (!activity.type || !activity.actor || !activity.object) {
    throw new Error('Invalid activity: missing required fields');
  }

  return activity as unknown as FederatedActivity;
}

/**
 * Validate that an activity is properly signed
 *
 * ⚠️  NOT IMPLEMENTED - Always throws until HTTP signature verification is complete.
 */
export function validateActivitySignature(
  _activity: FederatedActivity,
  _signature: string,
  _publicKey: string
): boolean {
  throw new Error(
    'validateActivitySignature is not implemented. ' +
    'HTTP signature verification is required for secure federation. ' +
    'Do NOT bypass this check in production.'
  );
}
