import type { FederationConfig } from '../types.js';
import { assertFederationEnabled } from '../index.js';

export interface WebFingerLink {
  rel: string;
  type?: string;
  href: string;
  template?: string;
}

export interface WebFingerResponse {
  subject: string;
  aliases?: string[];
  properties?: Record<string, string>;
  links: WebFingerLink[];
}

/**
 * Handle WebFinger discovery request
 * 
 * @param resource - The resource URI being requested (e.g. acct:user@domain)
 * @param config - Federation configuration containing actor details
 * @returns The WebFinger response object or null if not found
 */
export function handleWebFinger(
  resource: string,
  config: FederationConfig
): WebFingerResponse | null {
  assertFederationEnabled('handleWebFinger');
  if (!resource) return null;

  const { actor } = config;
  
  // Derive domain from actor ID
  let domain: string;
  try {
    domain = new URL(actor.id).host;
  } catch {
    return null;
  }

  const validResources = [
    `acct:${actor.preferredUsername}@${domain}`,
    actor.id
  ];

  if (!validResources.includes(resource)) {
    return null;
  }

  return {
    subject: `acct:${actor.preferredUsername}@${domain}`,
    aliases: [actor.id],
    links: [
      {
        rel: 'self',
        type: 'application/activity+json',
        href: actor.id,
      },
      {
        rel: 'http://webfinger.net/rel/profile-page',
        type: 'text/html',
        href: actor.id, // Often the actor ID resolves to a profile page in browsers
      }
    ],
  };
}
