/**
 * Inbox Handler
 *
 * Process incoming ActivityPub activities.
 */

import type {
  FederatedActivity,
  InboxResult,
  InboxHandlerOptions,
  ForkActivity,
  InstallActivity,
  ActivityType,
} from '../types.js';
import type {
  ModerationStore,
  FlagActivity,
  BlockActivity,
} from '../moderation/types.js';
import { parseActivity, parseForkActivity, parseInstallActivity } from '../activitypub.js';
import { parseFlagActivity, parseBlockActivity } from '../moderation/activities.js';
import { assertFederationEnabled } from '../index.js';
import { parseSignatureHeader, verifyHttpSignature, calculateDigest, REQUIRED_SIGNED_HEADERS } from '../http-signatures.js';

/**
 * Extract host from an actor ID URL
 */
function extractHostFromActorId(actorId: string): string | null {
  try {
    const url = new URL(actorId);
    return url.host;
  } catch {
    return null;
  }
}

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
 *   // IMPORTANT: Capture raw body BEFORE parsing for Digest verification
 *   const rawBody = await req.text();
 *   const body = JSON.parse(rawBody);
 *
 *   const result = await handleInbox(body, req.headers, {
 *     rawBody, // Required for body integrity verification
 *     method: 'POST',
 *     path: '/inbox', // Must match your actual route path
 *     strictMode: true,
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
    /** HTTP method (required for signature verification in strictMode) */
    method?: string;
    /** Request path (required for signature verification in strictMode) */
    path?: string;
    /**
     * Raw request body for Digest header verification.
     *
     * @security REQUIRED in strictMode when Digest header is present.
     * Without this, an attacker could modify the JSON body while keeping a valid signature
     * (since signatures only cover headers, not the body).
     *
     * Pass the raw bytes before JSON parsing:
     * ```typescript
     * const rawBody = await req.text();
     * const body = JSON.parse(rawBody);
     * handleInbox(body, headers, { rawBody, ... });
     * ```
     */
    rawBody?: string | ArrayBuffer;
    onFork?: (activity: ForkActivity) => Promise<void>;
    onInstall?: (activity: InstallActivity) => Promise<void>;
    onCreate?: (activity: FederatedActivity) => Promise<void>;
    onUpdate?: (activity: FederatedActivity) => Promise<void>;
    onDelete?: (activity: FederatedActivity) => Promise<void>;
    onLike?: (activity: FederatedActivity) => Promise<void>;
    onAnnounce?: (activity: FederatedActivity) => Promise<void>;
    onUndo?: (activity: FederatedActivity) => Promise<void>;
    // Moderation handlers
    onFlag?: (activity: FlagActivity, parsedReport: ReturnType<typeof parseFlagActivity>) => Promise<void>;
    onBlock?: (activity: BlockActivity, parsedBlock: ReturnType<typeof parseBlockActivity>) => Promise<void>;
    /**
     * Moderation store for instance blocking.
     * If provided, blocked instances are rejected BEFORE signature verification (saves CPU).
     */
    moderationStore?: ModerationStore;
  }
): Promise<InboxResult> {
  assertFederationEnabled('handleInbox');

  try {
    // Early instance block check - BEFORE signature verification (saves CPU for blocked instances)
    // We extract actor from the raw body to avoid full parsing costs
    if (options.moderationStore) {
      const actorId = typeof body === 'object' && body !== null && 'actor' in body
        ? String((body as Record<string, unknown>).actor)
        : null;

      if (actorId) {
        const host = extractHostFromActorId(actorId);
        if (host && await options.moderationStore.isInstanceBlocked(host)) {
          return {
            accepted: false,
            error: `Instance ${host} is blocked`,
          };
        }
      }
    }

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

    // Verify HTTP signature in strict mode
    if (options.strictMode) {
      // Get signature header
      const signatureHeader = headers instanceof Headers
        ? headers.get('signature')
        : headers['signature'] || headers['Signature'];

      if (!signatureHeader) {
        return {
          accepted: false,
          error: 'Missing Signature header (required in strict mode)',
        };
      }

      // Parse the signature
      const parsedSig = parseSignatureHeader(signatureHeader);
      if (!parsedSig) {
        return {
          accepted: false,
          error: 'Invalid Signature header format',
        };
      }

      // STRICT MODE: Enforce required headers in signature
      // This matches validateActivitySignature behavior for consistency
      const missingSignedHeaders = REQUIRED_SIGNED_HEADERS.filter(
        (h) => !parsedSig.headers.includes(h)
      );
      if (missingSignedHeaders.length > 0) {
        return {
          accepted: false,
          error: `Strict mode: signature missing required headers: ${missingSignedHeaders.join(', ')}`,
        };
      }

      // STRICT MODE: Require Date header to be present (not just signed)
      const dateHeader = headers instanceof Headers
        ? headers.get('date')
        : headers['date'] || headers['Date'];
      if (!dateHeader) {
        return {
          accepted: false,
          error: 'Strict mode: Date header required',
        };
      }

      // STRICT MODE: Require host header to be present
      const hostHeader = headers instanceof Headers
        ? headers.get('host')
        : headers['host'] || headers['Host'];
      if (!hostHeader) {
        return {
          accepted: false,
          error: 'Strict mode: host header required',
        };
      }

      // Fetch the actor to get their public key
      const actor = await options.fetchActor(activity.actor);
      if (!actor) {
        return {
          accepted: false,
          error: `Unknown actor: ${activity.actor}`,
        };
      }

      // Verify the key belongs to the actor (strict equality on URL origin + path)
      if (!actor.publicKey?.publicKeyPem) {
        return {
          accepted: false,
          error: `Actor ${activity.actor} has no public key`,
        };
      }

      // Verify key ID matches actor (strict equality on base URL)
      // Key ID format: "https://example.com/actors/alice#main-key"
      // Actor format: "https://example.com/actors/alice"
      try {
        const keyIdUrl = new URL(parsedSig.keyId);
        const actorUrl = new URL(activity.actor);

        // Extract base (origin + pathname) - key ID has fragment, actor doesn't
        const keyIdBase = `${keyIdUrl.origin}${keyIdUrl.pathname}`;
        const actorBase = `${actorUrl.origin}${actorUrl.pathname}`;

        // Strict equality required - no startsWith which could allow:
        // - actor: https://evil.com/victim
        // - keyId: https://evil.com/victim-fake#main-key (would match with startsWith)
        if (keyIdBase !== actorBase) {
          return {
            accepted: false,
            error: `Key ID ${parsedSig.keyId} does not match actor ${activity.actor}`,
          };
        }

        // Also verify the fetched actor's key ID matches the signature's key ID
        if (actor.publicKey.id !== parsedSig.keyId) {
          return {
            accepted: false,
            error: `Actor's key ID ${actor.publicKey.id} does not match signature key ID ${parsedSig.keyId}`,
          };
        }
      } catch {
        return {
          accepted: false,
          error: `Invalid key ID or actor URL`,
        };
      }

      // Verify Digest header BEFORE signature verification
      // @security This prevents body tampering even if signature is valid (signatures only cover headers)
      // Order: Digest (body integrity, cheap hash) → Signature (header integrity, crypto)
      const digestHeader = headers instanceof Headers
        ? headers.get('digest')
        : headers['digest'] || headers['Digest'];

      if (digestHeader) {
        // Digest header present - MUST verify
        if (!options.rawBody) {
          return {
            accepted: false,
            error: 'Digest header present but rawBody not provided for verification',
          };
        }

        // Parse digest format: "SHA-256=base64hash" or "sha-256=base64hash"
        const digestMatch = digestHeader.match(/^(SHA-256|sha-256)=(.+)$/i);
        if (!digestMatch) {
          return {
            accepted: false,
            error: 'Invalid Digest header format (expected SHA-256=...)',
          };
        }

        // Calculate actual digest
        const expectedDigest = await calculateDigest(options.rawBody);
        const actualDigest = `SHA-256=${digestMatch[2]}`;

        // Compare (case-insensitive for algorithm, exact for hash)
        if (expectedDigest !== actualDigest) {
          return {
            accepted: false,
            error: 'Digest mismatch - body may have been tampered with',
          };
        }
      } else if (parsedSig.headers.includes('digest')) {
        // Signature claims to have signed a digest, but no Digest header present
        return {
          accepted: false,
          error: 'Signature includes digest but no Digest header present',
        };
      }

      // Verify the signature (covers headers including Digest)
      const method = options.method || 'POST';
      const path = options.path || '/inbox';

      // Normalize headers to Headers object for signature verification
      const normalizedHeaders = headers instanceof Headers
        ? headers
        : new Headers(headers);

      const isValid = await verifyHttpSignature(
        parsedSig,
        actor.publicKey.publicKeyPem,
        method,
        path,
        normalizedHeaders
      );

      if (!isValid) {
        return {
          accepted: false,
          error: 'Invalid HTTP signature',
        };
      }

      // Check date header for replay protection
      // In strict mode, Date header is required (checked above), so always verify freshness
      // Default maxAge: 300 seconds (5 minutes) matches validateActivitySignature behavior
      const effectiveMaxAge = options.maxAge ?? 300;
      const requestDate = new Date(dateHeader);
      const now = new Date();
      const ageMs = Math.abs(now.getTime() - requestDate.getTime());

      if (isNaN(requestDate.getTime())) {
        return {
          accepted: false,
          error: 'Invalid Date header format',
        };
      }

      if (ageMs > effectiveMaxAge * 1000) {
        return {
          accepted: false,
          error: `Request too old or in future (${Math.round(ageMs / 1000)}s, max ${effectiveMaxAge}s)`,
        };
      }
    }

    // Route to appropriate handler
    const activityType = activity.type as ActivityType;

    switch (activityType) {
      case 'Fork': {
        const parsed = parseForkActivity(activity);
        if (!parsed) {
          return {
            accepted: false,
            error: 'Invalid Fork activity: missing or malformed required fields',
          };
        }
        if (options.onFork) {
          await options.onFork(activity as ForkActivity);
        }
        return { accepted: true, activityType: 'Fork' };
      }

      case 'Install': {
        const parsed = parseInstallActivity(activity);
        if (!parsed) {
          return {
            accepted: false,
            error: 'Invalid Install activity: missing or malformed required fields',
          };
        }
        if (options.onInstall) {
          await options.onInstall(activity as InstallActivity);
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

      case 'Flag': {
        const parsed = parseFlagActivity(activity);
        if (options.onFlag && parsed) {
          await options.onFlag(activity as unknown as FlagActivity, parsed);
        }
        return { accepted: true, activityType: 'Flag' };
      }

      case 'Block': {
        const parsed = parseBlockActivity(activity);
        if (options.onBlock && parsed) {
          await options.onBlock(activity as unknown as BlockActivity, parsed);
        }
        return { accepted: true, activityType: 'Block' };
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
