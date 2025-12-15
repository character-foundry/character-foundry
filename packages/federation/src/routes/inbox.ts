/**
 * Inbox Handler
 *
 * Process incoming ActivityPub activities.
 */

import type {
  FederatedActivity,
  FederatedActor,
  InboxResult,
  InboxHandlerOptions,
  ForkActivity,
  InstallActivity,
  ActivityType,
} from '../types.js';
import { parseActivity, parseForkActivity, parseInstallActivity } from '../activitypub.js';
import { assertFederationEnabled } from '../index.js';

/**
 * Handle incoming ActivityPub activities
 *
 * Parses and routes incoming activities to the appropriate handlers.
 * Currently supports Fork activities for fork notification handling.
 *
 * @example
 * ```typescript
 * // In your web framework (e.g., Hono, Express)
 * app.post('/inbox', async (req) => {
 *   const result = await handleInbox(await req.json(), req.headers, {
 *     fetchActor: async (id) => fetchActorFromNetwork(id),
 *     onFork: async (activity) => {
 *       await syncEngine.handleForkNotification(activity);
 *     },
 *   });
 *
 *   if (result.accepted) {
 *     return new Response(null, { status: 202 });
 *   } else {
 *     return new Response(result.error, { status: 400 });
 *   }
 * });
 * ```
 */
export async function handleInbox(
  body: unknown,
  headers: Headers | Record<string, string>,
  options: InboxHandlerOptions & {
    onFork?: (activity: ForkActivity) => Promise<void>;
    onInstall?: (activity: InstallActivity) => Promise<void>;
    onCreate?: (activity: FederatedActivity) => Promise<void>;
    onUpdate?: (activity: FederatedActivity) => Promise<void>;
    onDelete?: (activity: FederatedActivity) => Promise<void>;
    onLike?: (activity: FederatedActivity) => Promise<void>;
    onAnnounce?: (activity: FederatedActivity) => Promise<void>;
    onUndo?: (activity: FederatedActivity) => Promise<void>;
  }
): Promise<InboxResult> {
  assertFederationEnabled('handleInbox');

  try {
    // Parse the activity
    let activity: FederatedActivity;
    try {
      activity = parseActivity(body);
    } catch (err) {
      return {
        accepted: false,
        error: `Invalid activity: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    // Fetch the actor for signature verification (if strict mode)
    if (options.strictMode) {
      const actor = await options.fetchActor(activity.actor);
      if (!actor) {
        return {
          accepted: false,
          error: `Unknown actor: ${activity.actor}`,
        };
      }

      // Note: Full HTTP signature verification would happen here
      // For now, we just verify the actor exists
      // TODO: Implement full HTTP signature verification when ready
    }

    // Route to appropriate handler
    const activityType = activity.type as ActivityType;

    switch (activityType) {
      case 'Fork': {
        if (options.onFork) {
          const forkActivity = activity as unknown as ForkActivity;
          await options.onFork(forkActivity);
        }
        return { accepted: true, activityType: 'Fork' };
      }

      case 'Install': {
        if (options.onInstall) {
          const installActivity = activity as unknown as InstallActivity;
          await options.onInstall(installActivity);
        }
        return { accepted: true, activityType: 'Install' };
      }

      case 'Create': {
        if (options.onCreate) {
          await options.onCreate(activity);
        }
        return { accepted: true, activityType: 'Create' };
      }

      case 'Update': {
        if (options.onUpdate) {
          await options.onUpdate(activity);
        }
        return { accepted: true, activityType: 'Update' };
      }

      case 'Delete': {
        if (options.onDelete) {
          await options.onDelete(activity);
        }
        return { accepted: true, activityType: 'Delete' };
      }

      case 'Like': {
        if (options.onLike) {
          await options.onLike(activity);
        }
        return { accepted: true, activityType: 'Like' };
      }

      case 'Announce': {
        if (options.onAnnounce) {
          await options.onAnnounce(activity);
        }
        return { accepted: true, activityType: 'Announce' };
      }

      case 'Undo': {
        if (options.onUndo) {
          await options.onUndo(activity);
        }
        return { accepted: true, activityType: 'Undo' };
      }

      default: {
        // Unknown activity type - accept but ignore
        return {
          accepted: true,
          activityType: activityType,
        };
      }
    }
  } catch (err) {
    return {
      accepted: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Validate that a Fork activity has all required fields
 */
export function validateForkActivity(activity: unknown): {
  valid: boolean;
  error?: string;
} {
  const parsed = parseForkActivity(activity);
  if (!parsed) {
    return {
      valid: false,
      error: 'Invalid fork activity: missing required fields',
    };
  }

  // Verify the forked card has content
  try {
    JSON.parse(parsed.forkedCard.content);
  } catch {
    return {
      valid: false,
      error: 'Invalid fork activity: forked card content is not valid JSON',
    };
  }

  return { valid: true };
}

/**
 * Validate that an Install activity has all required fields
 */
export function validateInstallActivity(activity: unknown): {
  valid: boolean;
  error?: string;
} {
  const parsed = parseInstallActivity(activity);
  if (!parsed) {
    return {
      valid: false,
      error: 'Invalid install activity: missing required fields',
    };
  }

  // Verify the card ID is a valid URI
  try {
    new URL(parsed.cardId);
  } catch {
    return {
      valid: false,
      error: 'Invalid install activity: cardId is not a valid URI',
    };
  }

  return { valid: true };
}
