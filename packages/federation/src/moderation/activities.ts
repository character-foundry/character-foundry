/**
 * Moderation ActivityPub Activities
 *
 * Create and parse Flag/Block activities per ActivityPub spec.
 */

import { generateActivityId } from '../activitypub.js';
import type { FlagActivity, BlockActivity, ReportCategory } from './types.js';

/**
 * ActivityPub context for moderation activities
 */
export const MODERATION_ACTIVITY_CONTEXT = [
  'https://www.w3.org/ns/activitystreams',
  {
    moderation: 'https://character-foundry.dev/ns/moderation#',
    category: { '@id': 'moderation:category' },
  },
] as const;

/**
 * Create a Flag activity for reporting content/actors
 *
 * Per ActivityPub spec, Flag is delivered directly to the target's instance inbox,
 * NOT wrapped in a Create activity.
 *
 * @example
 * ```typescript
 * const flag = createFlagActivity(
 *   'https://myinstance.com/users/reporter',
 *   'https://other.com/cards/problematic-card',
 *   'https://myinstance.com',
 *   {
 *     content: 'This card contains spam',
 *     category: 'spam',
 *     to: ['https://other.com/inbox'],
 *   }
 * );
 * ```
 */
export function createFlagActivity(
  reporterActorId: string,
  targetIds: string | string[],
  baseUrl: string,
  options?: {
    /** Report description/reason */
    content?: string;
    /** Report category (flexible string) */
    category?: ReportCategory;
    /** Target inbox(es) */
    to?: string[];
  }
): FlagActivity {
  const targets = Array.isArray(targetIds) ? targetIds : [targetIds];

  return {
    '@context': [...MODERATION_ACTIVITY_CONTEXT],
    id: generateActivityId(baseUrl),
    type: 'Flag',
    actor: reporterActorId,
    object: targets.length === 1 ? targets[0]! : targets,
    content: options?.content,
    category: options?.category,
    published: new Date().toISOString(),
    to: options?.to,
  };
}

/**
 * Parse incoming Flag activity
 *
 * @returns Parsed flag data or null if invalid
 */
export function parseFlagActivity(activity: unknown): {
  actorId: string;
  targetIds: string[];
  content?: string;
  category?: string;
  activityId: string;
} | null {
  if (!activity || typeof activity !== 'object') return null;

  const act = activity as Record<string, unknown>;

  // Must be a Flag activity
  if (act.type !== 'Flag') return null;

  // Required fields
  if (typeof act.actor !== 'string') return null;
  if (typeof act.id !== 'string') return null;
  if (!act.object) return null;

  // Parse targets
  const targets = Array.isArray(act.object)
    ? act.object.filter((t): t is string => typeof t === 'string')
    : typeof act.object === 'string'
      ? [act.object]
      : [];

  if (targets.length === 0) return null;

  return {
    actorId: act.actor,
    targetIds: targets,
    content: typeof act.content === 'string' ? act.content : undefined,
    category: typeof act.category === 'string' ? act.category : undefined,
    activityId: act.id,
  };
}

/**
 * Validate a Flag activity has all required fields
 */
export function validateFlagActivity(activity: unknown): {
  valid: boolean;
  error?: string;
} {
  const parsed = parseFlagActivity(activity);
  if (!parsed) {
    return {
      valid: false,
      error: 'Invalid flag activity: missing required fields',
    };
  }

  // Validate all target URIs
  for (const target of parsed.targetIds) {
    try {
      new URL(target);
    } catch {
      return {
        valid: false,
        error: `Invalid flag activity: target "${target}" is not a valid URI`,
      };
    }
  }

  // Validate content length if provided
  if (parsed.content && parsed.content.length > 5000) {
    return {
      valid: false,
      error: 'Flag content too long (max 5000 chars)',
    };
  }

  return { valid: true };
}

/**
 * Create a Block activity for instance-level blocking
 *
 * Block activities are typically:
 * 1. Stored locally for enforcement
 * 2. Optionally announced to trusted federation peers
 *
 * @example
 * ```typescript
 * const block = createBlockActivity(
 *   'https://myinstance.com/actor',
 *   'evil.example.com',
 *   'https://myinstance.com',
 *   { summary: 'Spam and harassment' }
 * );
 * ```
 */
export function createBlockActivity(
  adminActorId: string,
  blockedTarget: string,
  baseUrl: string,
  options?: {
    /** Block reason */
    summary?: string;
    /** Recipients for federation announcement */
    to?: string[];
  }
): BlockActivity {
  return {
    '@context': [...MODERATION_ACTIVITY_CONTEXT],
    id: generateActivityId(baseUrl),
    type: 'Block',
    actor: adminActorId,
    object: blockedTarget,
    summary: options?.summary,
    published: new Date().toISOString(),
  };
}

/**
 * Parse incoming Block activity
 *
 * @returns Parsed block data or null if invalid
 */
export function parseBlockActivity(activity: unknown): {
  actorId: string;
  targetId: string;
  summary?: string;
  activityId: string;
} | null {
  if (!activity || typeof activity !== 'object') return null;

  const act = activity as Record<string, unknown>;

  // Must be a Block activity
  if (act.type !== 'Block') return null;

  // Required fields
  if (typeof act.actor !== 'string') return null;
  if (typeof act.object !== 'string') return null;
  if (typeof act.id !== 'string') return null;

  return {
    actorId: act.actor,
    targetId: act.object,
    summary: typeof act.summary === 'string' ? act.summary : undefined,
    activityId: act.id,
  };
}

/**
 * Validate a Block activity has all required fields
 */
export function validateBlockActivity(activity: unknown): {
  valid: boolean;
  error?: string;
} {
  const parsed = parseBlockActivity(activity);
  if (!parsed) {
    return {
      valid: false,
      error: 'Invalid block activity: missing required fields',
    };
  }

  // Block target should be a domain or actor URI
  // Domains won't parse as URLs, actor URIs will
  const target = parsed.targetId;
  const isDomain = /^[a-zA-Z0-9][a-zA-Z0-9-]*(\.[a-zA-Z0-9][a-zA-Z0-9-]*)+$/.test(target);
  let isValidUri = false;
  try {
    new URL(target);
    isValidUri = true;
  } catch {
    // Not a URI
  }

  if (!isDomain && !isValidUri) {
    return {
      valid: false,
      error: 'Invalid block activity: target must be a domain or valid URI',
    };
  }

  return { valid: true };
}
