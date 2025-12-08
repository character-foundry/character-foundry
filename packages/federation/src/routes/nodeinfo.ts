import type { FederationConfig } from '../types.js';
import { assertFederationEnabled } from '../index.js';

export interface NodeInfoLink {
  rel: string;
  href: string;
}

export interface NodeInfoDiscoveryResponse {
  links: NodeInfoLink[];
}

export interface NodeInfoUsage {
  users: {
    total: number;
    activeMonth?: number;
    activeHalfyear?: number;
  };
  localPosts?: number;
  localComments?: number;
}

export interface NodeInfoResponse {
  version: string;
  software: {
    name: string;
    version: string;
  };
  protocols: string[];
  services: {
    inbound: string[];
    outbound: string[];
  };
  openRegistrations: boolean;
  usage: NodeInfoUsage;
  metadata: Record<string, unknown>;
}

/**
 * Handle NodeInfo discovery request (/.well-known/nodeinfo)
 * 
 * @param baseUrl - The base URL of the server (e.g. https://hub.example.com)
 * @returns The NodeInfo discovery response
 */
export function handleNodeInfoDiscovery(baseUrl: string): NodeInfoDiscoveryResponse {
  assertFederationEnabled('handleNodeInfoDiscovery');
  // Ensure no trailing slash
  const origin = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  
  return {
    links: [
      {
        rel: 'http://nodeinfo.diaspora.foundation/ns/schema/2.0',
        href: `${origin}/api/federation/nodeinfo/2.0`,
      },
      {
        rel: 'http://nodeinfo.diaspora.foundation/ns/schema/2.1',
        href: `${origin}/api/federation/nodeinfo/2.1`,
      },
    ],
  };
}

/**
 * Handle NodeInfo data request
 * 
 * @param config - Federation configuration
 * @param version - NodeInfo version ('2.0' or '2.1')
 * @returns The NodeInfo response
 */
export function handleNodeInfo(
  config: FederationConfig,
  version: '2.0' | '2.1' = '2.1'
): NodeInfoResponse {
  assertFederationEnabled('handleNodeInfo');
  return {
    version,
    software: {
      name: 'character-foundry',
      version: '0.1.0', 
    },
    protocols: [
      'activitypub',
    ],
    services: {
      inbound: [],
      outbound: [],
    },
    openRegistrations: false,
    usage: {
      users: {
        total: 1, // TODO: Count actual users if multi-tenant
      },
    },
    metadata: {
      nodeName: config.actor.name,
      nodeDescription: config.actor.summary,
    },
  };
}
