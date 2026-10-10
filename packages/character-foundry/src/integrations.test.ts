import { describe, expect, it } from 'vitest';
import { instanceApiUrl, connectionHeaders, compareFavoriteStates, isFavoriteState } from './integrations';

describe('direct instance connections', () => {
  it('retains proxy prefixes and accepts an API URL', () => {
    expect(instanceApiUrl(' http://localhost:3456/ ', '/api/import')).toBe('http://localhost:3456/api/import');
    expect(instanceApiUrl('https://host/apps/lumi/api/?ignored=1', 'characters/import')).toBe('https://host/apps/lumi/api/characters/import');
    expect(instanceApiUrl('http://localhost', 'cards?limit=1')).toBe('http://localhost/api/cards?limit=1');
    expect(() => instanceApiUrl('file:///tmp', 'import')).toThrow();
    expect(() => instanceApiUrl('http://user:secret@host', 'import')).toThrow();
  });
  it('supports authenticated and passwordless instances', () => {
    expect(connectionHeaders({ baseUrl: '', sessionToken: 'token' })).toEqual({ Accept: 'application/json', Authorization: 'Bearer token' });
    expect(connectionHeaders({ baseUrl: '', sessionCookie: 'session=x' }).Cookie).toBe('session=x');
    expect(connectionHeaders({ baseUrl: '' })).toEqual({ Accept: 'application/json' });
  });
  it('converges on explicit unstars and deterministically breaks concurrent ties', () => {
    const older = { favorite: true, updatedAt: 1, changeId: 'a' };
    const newer = { favorite: false, updatedAt: 2, changeId: 'b' };
    expect(compareFavoriteStates(newer, older)).toBeGreaterThan(0);
    expect(compareFavoriteStates(older, newer)).toBeLessThan(0);
    expect(compareFavoriteStates(newer, { ...newer })).toBe(0);
    expect(compareFavoriteStates({ ...newer, changeId: 'c' }, newer)).toBeGreaterThan(0);
    expect(isFavoriteState(newer)).toBe(true);
    expect(isFavoriteState({ ...newer, favorite: 'false' })).toBe(false);
    expect(isFavoriteState({ ...newer, updatedAt: NaN })).toBe(false);
  });
});
