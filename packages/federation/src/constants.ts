export const FederationRoutes = {
  DISCOVERY: {
    WEBFINGER: '/.well-known/webfinger',
    NODEINFO: '/.well-known/nodeinfo',
  },
  API: {
    ACTOR: '/api/federation/actor',
    INBOX: '/api/federation/inbox',
    OUTBOX: '/api/federation/outbox',
    ASSETS: (id: string) => `/api/federation/assets/${id}`,
  },
} as const;

export type FederationRouteMap = typeof FederationRoutes;
