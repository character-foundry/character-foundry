/** Direct, self-hosted connections. These helpers do not use federation. */
export interface InstanceConnection {
  baseUrl: string;
  sessionCookie?: string;
  sessionToken?: string;
}

/** Accept an instance root or an /api URL, retaining a reverse proxy's path prefix. */
export function instanceApiUrl(baseUrl: string, endpoint: string): string {
  const url = new URL(baseUrl.trim());
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Use an HTTP or HTTPS instance URL without embedded credentials');
  }
  url.search = '';
  url.hash = '';
  const [path, query = ''] = endpoint.split('?');
  url.search = query;
  url.pathname = url.pathname.replace(/\/+$/, '').replace(/\/api$/, '')
    + '/api/' + path.replace(/^\/+/, '').replace(/^api\//, '');
  return url.toString();
}

export function connectionHeaders(connection: InstanceConnection): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = connection.sessionToken?.trim();
  const cookie = connection.sessionCookie?.trim();
  if (token) headers.Authorization = `Bearer ${token}`;
  else if (cookie) headers.Cookie = cookie;
  return headers;
}

/** An explicit value (including unstar) with a stable ordering for offline reconciliation. */
export interface FavoriteState {
  favorite: boolean;
  updatedAt: number;
  changeId: string;
}

export function isFavoriteState(value: unknown): value is FavoriteState {
  if (!value || typeof value !== 'object') return false;
  const state = value as Partial<FavoriteState>;
  return typeof state.favorite === 'boolean'
    && Number.isSafeInteger(state.updatedAt) && state.updatedAt! >= 0
    && typeof state.changeId === 'string' && state.changeId.length <= 128;
}

export function compareFavoriteStates(left: FavoriteState, right: FavoriteState): number {
  if (left.updatedAt !== right.updatedAt) return left.updatedAt < right.updatedAt ? -1 : 1;
  return left.changeId < right.changeId ? -1 : left.changeId > right.changeId ? 1 : 0;
}
