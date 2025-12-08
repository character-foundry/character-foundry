import type { FederationConfig, FederatedActor } from '../types.js';
import { assertFederationEnabled } from '../index.js';

/**
 * Handle Actor profile request
 * 
 * @param config - Federation configuration
 * @returns The Actor JSON-LD object
 */
export function handleActor(config: FederationConfig): FederatedActor {
  assertFederationEnabled('handleActor');
  // Ensure @context is present (it should be in the actor object, but good to verify)
  return {
    ...config.actor,
    '@context': config.actor['@context'] || [
      'https://www.w3.org/ns/activitystreams',
      'https://w3id.org/security/v1'
    ],
  } as FederatedActor;
}
