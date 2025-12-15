/**
 * Moderation Module Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { CCv3Data } from '@character-foundry/schemas';
import {
  createFlagActivity,
  parseFlagActivity,
  validateFlagActivity,
  createBlockActivity,
  parseBlockActivity,
  validateBlockActivity,
  MODERATION_ACTIVITY_CONTEXT,
} from './activities.js';
import { MemoryModerationStore } from './store.js';
import { PolicyEngine } from './policy-engine.js';
import { RateLimiter } from './rate-limiter.js';
import type { ContentPolicy, ContentPolicyRule } from './types.js';

describe('Moderation Activities', () => {
  describe('Flag Activity', () => {
    it('creates a Flag activity with single target', () => {
      const flag = createFlagActivity(
        'https://example.com/users/alice',
        'https://bad.com/cards/spam',
        'https://example.com',
        {
          content: 'This is spam',
          category: 'spam',
        }
      );

      expect(flag.type).toBe('Flag');
      expect(flag.actor).toBe('https://example.com/users/alice');
      expect(flag.object).toBe('https://bad.com/cards/spam');
      expect(flag.content).toBe('This is spam');
      expect(flag.category).toBe('spam');
      expect(flag['@context']).toEqual([...MODERATION_ACTIVITY_CONTEXT]);
    });

    it('creates a Flag activity with multiple targets', () => {
      const flag = createFlagActivity(
        'https://example.com/users/alice',
        ['https://bad.com/cards/1', 'https://bad.com/cards/2'],
        'https://example.com'
      );

      expect(flag.object).toEqual(['https://bad.com/cards/1', 'https://bad.com/cards/2']);
    });

    it('parses a valid Flag activity', () => {
      const activity = {
        '@context': MODERATION_ACTIVITY_CONTEXT,
        id: 'https://example.com/activities/123',
        type: 'Flag',
        actor: 'https://example.com/users/alice',
        object: 'https://bad.com/cards/spam',
        content: 'This is spam',
        category: 'spam',
        published: '2025-01-01T00:00:00Z',
      };

      const parsed = parseFlagActivity(activity);

      expect(parsed).not.toBeNull();
      expect(parsed?.actorId).toBe('https://example.com/users/alice');
      expect(parsed?.targetIds).toEqual(['https://bad.com/cards/spam']);
      expect(parsed?.content).toBe('This is spam');
      expect(parsed?.category).toBe('spam');
    });

    it('validates Flag activity correctly', () => {
      const valid = validateFlagActivity({
        id: 'https://example.com/activities/123',
        type: 'Flag',
        actor: 'https://example.com/users/alice',
        object: 'https://bad.com/cards/spam',
      });
      expect(valid.valid).toBe(true);

      const invalid = validateFlagActivity({
        id: 'https://example.com/activities/123',
        type: 'Flag',
        actor: 'https://example.com/users/alice',
        // missing object
      });
      expect(invalid.valid).toBe(false);
    });
  });

  describe('Block Activity', () => {
    it('creates a Block activity', () => {
      const block = createBlockActivity(
        'https://example.com/users/admin',
        'https://evil.com',
        'https://example.com',
        {
          summary: 'Spam instance',
        }
      );

      expect(block.type).toBe('Block');
      expect(block.actor).toBe('https://example.com/users/admin');
      expect(block.object).toBe('https://evil.com');
      expect(block.summary).toBe('Spam instance');
    });

    it('parses a valid Block activity', () => {
      const activity = {
        type: 'Block',
        id: 'https://example.com/activities/456',
        actor: 'https://example.com/users/admin',
        object: 'https://evil.com',
        summary: 'Spam instance',
        published: '2025-01-01T00:00:00Z',
      };

      const parsed = parseBlockActivity(activity);

      expect(parsed).not.toBeNull();
      expect(parsed?.actorId).toBe('https://example.com/users/admin');
      expect(parsed?.targetId).toBe('https://evil.com');
      expect(parsed?.summary).toBe('Spam instance');
    });

    it('validates Block activity correctly', () => {
      const valid = validateBlockActivity({
        id: 'https://example.com/activities/456',
        type: 'Block',
        actor: 'https://example.com/users/admin',
        object: 'https://evil.com',
      });
      expect(valid.valid).toBe(true);

      const invalid = validateBlockActivity({
        id: 'https://example.com/activities/456',
        type: 'Block',
        actor: 'https://example.com/users/admin',
        // missing object
      });
      expect(invalid.valid).toBe(false);
    });
  });
});

describe('MemoryModerationStore', () => {
  let store: MemoryModerationStore;

  beforeEach(() => {
    store = new MemoryModerationStore();
  });

  describe('Reports', () => {
    it('creates and retrieves a report', async () => {
      const report = await store.createReport({
        reporterActorId: 'https://example.com/users/alice',
        reporterInstance: 'example.com',
        targetIds: ['https://bad.com/cards/spam'],
        category: 'spam',
        description: 'Spam content',
        status: 'pending',
        activityId: 'https://example.com/activities/123',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        receivingInstance: 'bad.com',
        federatedToTarget: false,
      });

      expect(report.id).toBeDefined();
      expect(report.category).toBe('spam');

      const retrieved = await store.getReport(report.id);
      expect(retrieved).toEqual(report);
    });

    it('updates a report', async () => {
      const report = await store.createReport({
        reporterActorId: 'https://example.com/users/alice',
        reporterInstance: 'example.com',
        targetIds: ['https://bad.com/cards/spam'],
        category: 'spam',
        description: 'Spam content',
        status: 'pending',
        activityId: 'https://example.com/activities/123',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        receivingInstance: 'bad.com',
        federatedToTarget: false,
      });

      await store.updateReport(report.id, { status: 'resolved' });

      const updated = await store.getReport(report.id);
      expect(updated?.status).toBe('resolved');
    });

    it('lists reports with filters', async () => {
      await store.createReport({
        reporterActorId: 'https://example.com/users/alice',
        reporterInstance: 'example.com',
        targetIds: ['https://bad.com/cards/1'],
        category: 'spam',
        description: 'Spam 1',
        status: 'pending',
        activityId: 'https://example.com/activities/1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        receivingInstance: 'bad.com',
        federatedToTarget: false,
      });

      await store.createReport({
        reporterActorId: 'https://example.com/users/bob',
        reporterInstance: 'example.com',
        targetIds: ['https://bad.com/cards/2'],
        category: 'harassment',
        description: 'Harassment',
        status: 'resolved',
        activityId: 'https://example.com/activities/2',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        receivingInstance: 'bad.com',
        federatedToTarget: false,
      });

      const pending = await store.listReports({ status: 'pending' });
      expect(pending.length).toBe(1);
      expect(pending[0]!.category).toBe('spam');

      const all = await store.listReports();
      expect(all.length).toBe(2);

      const count = await store.countReports({ status: 'pending' });
      expect(count).toBe(1);
    });
  });

  describe('Actions', () => {
    it('creates and retrieves an action', async () => {
      const action = await store.createAction({
        moderatorActorId: 'https://example.com/users/mod',
        targetId: 'https://bad.com/cards/spam',
        actionType: 'delete',
        reason: 'Violated community guidelines',
        timestamp: new Date().toISOString(),
        active: true,
      });

      expect(action.id).toBeDefined();
      expect(action.actionType).toBe('delete');

      const retrieved = await store.getAction(action.id);
      expect(retrieved).toEqual(action);
    });

    it('deactivates an action', async () => {
      const action = await store.createAction({
        moderatorActorId: 'https://example.com/users/mod',
        targetId: 'https://bad.com/cards/spam',
        actionType: 'suspend',
        reason: 'Temporary suspension',
        timestamp: new Date().toISOString(),
        active: true,
      });

      await store.deactivateAction(action.id);

      const deactivated = await store.getAction(action.id);
      expect(deactivated?.active).toBe(false);
    });
  });

  describe('Instance Blocks', () => {
    it('creates and checks instance blocks', async () => {
      const block = await store.createBlock({
        blockedDomain: 'evil.example.com',
        level: 'suspend',
        reason: 'Spam server',
        createdBy: 'https://example.com/users/admin',
        createdAt: new Date().toISOString(),
        active: true,
        federate: false,
      });

      expect(block.id).toBeDefined();

      const isBlocked = await store.isInstanceBlocked('evil.example.com');
      expect(isBlocked).toBe(true);

      const isNotBlocked = await store.isInstanceBlocked('good.example.com');
      expect(isNotBlocked).toBe(false);
    });

    it('updates block status', async () => {
      const block = await store.createBlock({
        blockedDomain: 'temp.example.com',
        level: 'silence',
        reason: 'Temporary silence',
        createdBy: 'https://example.com/users/admin',
        createdAt: new Date().toISOString(),
        active: true,
        federate: false,
      });

      await store.updateBlock(block.id, { active: false });

      const isBlocked = await store.isInstanceBlocked('temp.example.com');
      expect(isBlocked).toBe(false);
    });
  });

  describe('Content Policies', () => {
    it('creates and retrieves a policy', async () => {
      const policy = await store.createPolicy({
        name: 'Anti-Spam',
        description: 'Block spam content',
        rules: [
          {
            id: 'rule-1',
            name: 'Block spam keywords',
            type: 'keyword',
            pattern: 'buy now',
            action: 'reject',
            priority: 1,
            enabled: true,
            createdAt: new Date().toISOString(),
            createdBy: 'admin',
          },
        ],
        enabled: true,
        defaultAction: 'allow',
        updatedAt: new Date().toISOString(),
      });

      expect(policy.id).toBeDefined();
      expect(policy.rules.length).toBe(1);

      const retrieved = await store.getPolicy(policy.id);
      expect(retrieved).toEqual(policy);
    });

    it('lists enabled policies', async () => {
      await store.createPolicy({
        name: 'Active Policy',
        description: 'Active',
        rules: [],
        enabled: true,
        defaultAction: 'allow',
        updatedAt: new Date().toISOString(),
      });

      await store.createPolicy({
        name: 'Disabled Policy',
        description: 'Disabled',
        rules: [],
        enabled: false,
        defaultAction: 'allow',
        updatedAt: new Date().toISOString(),
      });

      const enabled = await store.listPolicies({ enabled: true });
      expect(enabled.length).toBe(1);
      expect(enabled[0]!.name).toBe('Active Policy');
    });
  });

  describe('Stats', () => {
    it('returns correct stats', async () => {
      await store.createReport({
        reporterActorId: 'https://example.com/users/alice',
        reporterInstance: 'example.com',
        targetIds: ['https://bad.com/cards/1'],
        category: 'spam',
        description: 'Spam',
        status: 'pending',
        activityId: 'https://example.com/activities/1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        receivingInstance: 'bad.com',
        federatedToTarget: false,
      });

      await store.createBlock({
        blockedDomain: 'evil.com',
        level: 'suspend',
        reason: 'Bad',
        createdBy: 'admin',
        createdAt: new Date().toISOString(),
        active: true,
        federate: false,
      });

      const stats = await store.getStats();

      expect(stats.reports.total).toBe(1);
      expect(stats.reports.pending).toBe(1);
      expect(stats.blocks.total).toBe(1);
      expect(stats.blocks.active).toBe(1);
    });
  });
});

describe('PolicyEngine', () => {
  let store: MemoryModerationStore;
  let engine: PolicyEngine;

  const createTestCard = (overrides: Partial<CCv3Data['data']> = {}): CCv3Data => ({
    spec: 'chara_card_v3',
    spec_version: '3.0',
    data: {
      name: 'Test Character',
      description: 'A test character',
      personality: 'Friendly and helpful',
      scenario: 'Testing scenario',
      first_mes: 'Hello!',
      mes_example: '',
      creator_notes: '',
      system_prompt: '',
      post_history_instructions: '',
      tags: [],
      creator: 'testuser',
      character_version: '1.0',
      alternate_greetings: [],
      group_only_greetings: [],
      assets: [],
      ...overrides,
    },
  });

  beforeEach(async () => {
    store = new MemoryModerationStore();
    engine = new PolicyEngine(store);
  });

  it('returns allow when no policies exist', async () => {
    const card = createTestCard();
    const result = await engine.evaluateCard(card);

    expect(result.action).toBe('allow');
    expect(result.hasMatch).toBe(false);
  });

  it('matches keyword rules', async () => {
    await store.createPolicy({
      name: 'Spam Filter',
      description: 'Block spam',
      rules: [
        {
          id: 'spam-keyword',
          name: 'Block spam keywords',
          type: 'keyword',
          pattern: 'buy now',
          action: 'reject',
          priority: 1,
          enabled: true,
          createdAt: new Date().toISOString(),
          createdBy: 'admin',
        },
      ],
      enabled: true,
      defaultAction: 'allow',
      updatedAt: new Date().toISOString(),
    });

    const spamCard = createTestCard({ description: 'Amazing product - BUY NOW!' });
    const result = await engine.evaluateCard(spamCard);

    expect(result.action).toBe('reject');
    expect(result.hasMatch).toBe(true);
    expect(result.matchedRules[0]!.matchedField).toBe('description');
  });

  it('matches regex rules', async () => {
    await store.createPolicy({
      name: 'Phone Filter',
      description: 'Flag phone numbers',
      rules: [
        {
          id: 'phone-regex',
          name: 'Flag phone numbers',
          type: 'regex',
          pattern: '\\d{3}-\\d{3}-\\d{4}',
          action: 'review',
          priority: 1,
          enabled: true,
          createdAt: new Date().toISOString(),
          createdBy: 'admin',
        },
      ],
      enabled: true,
      defaultAction: 'allow',
      updatedAt: new Date().toISOString(),
    });

    const card = createTestCard({ description: 'Call me at 555-123-4567' });
    const result = await engine.evaluateCard(card);

    expect(result.action).toBe('review');
    expect(result.hasMatch).toBe(true);
  });

  it('matches tag rules', async () => {
    await store.createPolicy({
      name: 'NSFW Filter',
      description: 'Quarantine NSFW',
      rules: [
        {
          id: 'nsfw-tag',
          name: 'Quarantine NSFW tags',
          type: 'tag',
          pattern: 'nsfw',
          action: 'quarantine',
          priority: 1,
          enabled: true,
          createdAt: new Date().toISOString(),
          createdBy: 'admin',
        },
      ],
      enabled: true,
      defaultAction: 'allow',
      updatedAt: new Date().toISOString(),
    });

    const card = createTestCard({ tags: ['fantasy', 'nsfw', 'romance'] });
    const result = await engine.evaluateCard(card);

    expect(result.action).toBe('quarantine');
    expect(result.hasMatch).toBe(true);
    expect(result.matchedRules[0]!.matchedField).toBe('tags');
  });

  it('matches creator rules', async () => {
    await store.createPolicy({
      name: 'Trusted Creator',
      description: 'Allow trusted creators',
      rules: [
        {
          id: 'trusted-creator',
          name: 'Allow trusted',
          type: 'creator',
          pattern: 'trusteduser',
          action: 'allow',
          priority: 0, // High priority (whitelist)
          enabled: true,
          createdAt: new Date().toISOString(),
          createdBy: 'admin',
        },
      ],
      enabled: true,
      defaultAction: 'review',
      updatedAt: new Date().toISOString(),
    });

    const card = createTestCard({ creator: 'trusteduser' });
    const result = await engine.evaluateCard(card);

    expect(result.action).toBe('allow');
  });

  it('matches instance rules', async () => {
    await store.createPolicy({
      name: 'Instance Block',
      description: 'Block bad instances',
      rules: [
        {
          id: 'bad-instance',
          name: 'Block evil.com',
          type: 'instance',
          pattern: 'evil.com',
          action: 'reject',
          priority: 1,
          enabled: true,
          createdAt: new Date().toISOString(),
          createdBy: 'admin',
        },
      ],
      enabled: true,
      defaultAction: 'allow',
      updatedAt: new Date().toISOString(),
    });

    const card = createTestCard();
    const result = await engine.evaluateCard(card, 'evil.com');

    expect(result.action).toBe('reject');
    expect(result.matchedRules[0]!.matchedField).toBe('instance');
  });

  it('supports wildcard instance patterns', async () => {
    await store.createPolicy({
      name: 'Subdomain Block',
      description: 'Block all subdomains',
      rules: [
        {
          id: 'wildcard-instance',
          name: 'Block *.evil.com',
          type: 'instance',
          pattern: '*.evil.com',
          action: 'reject',
          priority: 1,
          enabled: true,
          createdAt: new Date().toISOString(),
          createdBy: 'admin',
        },
      ],
      enabled: true,
      defaultAction: 'allow',
      updatedAt: new Date().toISOString(),
    });

    const card = createTestCard();

    const subResult = await engine.evaluateCard(card, 'sub.evil.com');
    expect(subResult.action).toBe('reject');

    const goodResult = await engine.evaluateCard(card, 'good.com');
    expect(goodResult.action).toBe('allow');
  });

  it('respects rule priority for whitelist', async () => {
    await store.createPolicy({
      name: 'Mixed Policy',
      description: 'Test priority',
      rules: [
        {
          id: 'block-all',
          name: 'Block all from evil.com',
          type: 'instance',
          pattern: 'evil.com',
          action: 'reject',
          priority: 10, // Lower priority
          enabled: true,
          createdAt: new Date().toISOString(),
          createdBy: 'admin',
        },
        {
          id: 'allow-trusted',
          name: 'Allow trusted creator',
          type: 'creator',
          pattern: 'trusteduser',
          action: 'allow',
          priority: 1, // Higher priority (whitelist)
          enabled: true,
          createdAt: new Date().toISOString(),
          createdBy: 'admin',
        },
      ],
      enabled: true,
      defaultAction: 'allow',
      updatedAt: new Date().toISOString(),
    });

    // Trusted creator from evil.com should be allowed
    const card = createTestCard({ creator: 'trusteduser' });
    const result = await engine.evaluateCard(card, 'evil.com');

    expect(result.action).toBe('allow');
  });
});

describe('RateLimiter', () => {
  let store: MemoryModerationStore;
  let limiter: RateLimiter;

  beforeEach(() => {
    store = new MemoryModerationStore();
    limiter = new RateLimiter(store, {
      maxTokens: 3,
      refillRate: 1, // 1 per hour
    });
  });

  it('allows actions within limit', async () => {
    const result1 = await limiter.checkAndConsume('https://example.com/users/alice');
    expect(result1.allowed).toBe(true);
    expect(result1.remaining).toBe(2);

    const result2 = await limiter.checkAndConsume('https://example.com/users/alice');
    expect(result2.allowed).toBe(true);
    expect(result2.remaining).toBe(1);

    const result3 = await limiter.checkAndConsume('https://example.com/users/alice');
    expect(result3.allowed).toBe(true);
    expect(result3.remaining).toBe(0);
  });

  it('blocks actions over limit', async () => {
    // Use all tokens
    await limiter.checkAndConsume('https://example.com/users/alice');
    await limiter.checkAndConsume('https://example.com/users/alice');
    await limiter.checkAndConsume('https://example.com/users/alice');

    // Should be blocked now
    const result = await limiter.checkAndConsume('https://example.com/users/alice');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it('tracks separate buckets per actor', async () => {
    await limiter.checkAndConsume('https://example.com/users/alice');
    await limiter.checkAndConsume('https://example.com/users/alice');
    await limiter.checkAndConsume('https://example.com/users/alice');

    // Alice is blocked
    const aliceResult = await limiter.checkAndConsume('https://example.com/users/alice');
    expect(aliceResult.allowed).toBe(false);

    // Bob should be allowed
    const bobResult = await limiter.checkAndConsume('https://example.com/users/bob');
    expect(bobResult.allowed).toBe(true);
    expect(bobResult.remaining).toBe(2);
  });

  it('can check without consuming', async () => {
    const check1 = await limiter.check('https://example.com/users/alice');
    expect(check1.allowed).toBe(true);
    expect(check1.remaining).toBe(3);

    const check2 = await limiter.check('https://example.com/users/alice');
    expect(check2.remaining).toBe(3); // Still 3, nothing consumed
  });

  it('can reset rate limit', async () => {
    // Use all tokens
    await limiter.checkAndConsume('https://example.com/users/alice');
    await limiter.checkAndConsume('https://example.com/users/alice');
    await limiter.checkAndConsume('https://example.com/users/alice');

    // Reset
    await limiter.reset('https://example.com/users/alice');

    // Should be allowed again
    const result = await limiter.checkAndConsume('https://example.com/users/alice');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });
});
