/**
 * Content Policy Engine
 *
 * Evaluates incoming cards against content policies.
 * Provides tools for community-defined moderation rules.
 */

import type { CCv3Data } from '@character-foundry/schemas';
import type {
  ContentPolicy,
  ContentPolicyRule,
  PolicyAction,
  PolicyEvaluationResult,
  ModerationStore,
} from './types.js';

/**
 * Default fields to check for keyword/regex rules
 */
const DEFAULT_TARGET_FIELDS = ['name', 'description', 'personality', 'scenario', 'first_mes'];

/**
 * Content Policy Engine
 *
 * Evaluates cards against configured policies and returns the appropriate action.
 *
 * @example
 * ```typescript
 * const engine = new PolicyEngine(moderationStore);
 *
 * const result = await engine.evaluateCard(card, 'source.example.com');
 * if (result.action === 'reject') {
 *   return new Response('Content policy violation', { status: 403 });
 * }
 * if (result.action === 'review') {
 *   await queueForReview(card, result.matchedRules);
 * }
 * ```
 */
export class PolicyEngine {
  private store: ModerationStore;
  private compiledRegexCache: Map<string, RegExp> = new Map();

  constructor(store: ModerationStore) {
    this.store = store;
  }

  /**
   * Evaluate a card against all active policies
   *
   * @param card - The CCv3 card to evaluate
   * @param sourceInstance - Optional source instance domain for instance rules
   * @returns Evaluation result with action and matched rules
   */
  async evaluateCard(card: CCv3Data, sourceInstance?: string): Promise<PolicyEvaluationResult> {
    const policies = await this.store.listPolicies({ enabled: true });
    const allMatches: PolicyEvaluationResult['matchedRules'] = [];

    // Track the highest priority (lowest number) action found
    let finalAction: PolicyAction = 'allow';
    let lowestPriority = Infinity;

    for (const policy of policies) {
      const result = this.evaluateAgainstPolicy(card, policy, sourceInstance);
      allMatches.push(...result.matchedRules);

      // Check each matched rule's priority
      for (const match of result.matchedRules) {
        const rule = policy.rules.find((r) => r.id === match.ruleId);
        if (rule && rule.priority < lowestPriority) {
          lowestPriority = rule.priority;
          finalAction = rule.action;

          // 'allow' rules act as whitelist - immediate return
          if (rule.action === 'allow') {
            return {
              action: 'allow',
              matchedRules: allMatches,
              hasMatch: true,
            };
          }
        }
      }
    }

    // If no matches, use default action from first policy or allow
    if (allMatches.length === 0) {
      const defaultAction = policies.length > 0 ? policies[0]!.defaultAction : 'allow';
      return {
        action: defaultAction,
        matchedRules: [],
        hasMatch: false,
      };
    }

    return {
      action: finalAction,
      matchedRules: allMatches,
      hasMatch: true,
    };
  }

  /**
   * Evaluate card against a single policy
   */
  private evaluateAgainstPolicy(
    card: CCv3Data,
    policy: ContentPolicy,
    sourceInstance?: string
  ): PolicyEvaluationResult {
    const matches: PolicyEvaluationResult['matchedRules'] = [];

    // Sort rules by priority (lower = checked first)
    const enabledRules = policy.rules.filter((r) => r.enabled).sort((a, b) => a.priority - b.priority);

    for (const rule of enabledRules) {
      const match = this.evaluateRule(card, rule, sourceInstance);
      if (match) {
        matches.push({
          ruleId: rule.id,
          ruleName: rule.name,
          matchedField: match.field,
          matchedValue: match.value,
        });

        // If rule is 'allow', this is a whitelist - skip remaining rules
        if (rule.action === 'allow') {
          return { action: 'allow', matchedRules: matches, hasMatch: true };
        }
      }
    }

    return {
      action:
        matches.length > 0
          ? (enabledRules.find((r) => matches.some((m) => m.ruleId === r.id))?.action ??
            policy.defaultAction)
          : policy.defaultAction,
      matchedRules: matches,
      hasMatch: matches.length > 0,
    };
  }

  /**
   * Evaluate a single rule against a card
   */
  private evaluateRule(
    card: CCv3Data,
    rule: ContentPolicyRule,
    sourceInstance?: string
  ): { field?: string; value?: string } | null {
    switch (rule.type) {
      case 'keyword':
        return this.evaluateKeywordRule(card, rule);
      case 'regex':
        return this.evaluateRegexRule(card, rule);
      case 'tag':
        return this.evaluateTagRule(card, rule);
      case 'creator':
        return this.evaluateCreatorRule(card, rule);
      case 'instance':
        return this.evaluateInstanceRule(sourceInstance, rule);
      default:
        return null;
    }
  }

  /**
   * Keyword rule - case-insensitive text search
   */
  private evaluateKeywordRule(
    card: CCv3Data,
    rule: ContentPolicyRule
  ): { field?: string; value?: string } | null {
    const keyword = rule.pattern.toLowerCase();
    const fields = rule.targetFields || DEFAULT_TARGET_FIELDS;

    for (const field of fields) {
      const value = this.getCardField(card, field);
      if (typeof value === 'string' && value.toLowerCase().includes(keyword)) {
        return { field, value: keyword };
      }
    }
    return null;
  }

  /**
   * Regex rule - pattern matching with compiled cache
   */
  private evaluateRegexRule(
    card: CCv3Data,
    rule: ContentPolicyRule
  ): { field?: string; value?: string } | null {
    let regex = this.compiledRegexCache.get(rule.id);
    if (!regex) {
      try {
        regex = new RegExp(rule.pattern, 'i');
        this.compiledRegexCache.set(rule.id, regex);
      } catch {
        // Invalid regex pattern
        return null;
      }
    }

    const fields = rule.targetFields || DEFAULT_TARGET_FIELDS;

    for (const field of fields) {
      const value = this.getCardField(card, field);
      if (typeof value === 'string') {
        const match = value.match(regex);
        if (match) {
          return { field, value: match[0] };
        }
      }
    }
    return null;
  }

  /**
   * Tag rule - check card tags array
   */
  private evaluateTagRule(
    card: CCv3Data,
    rule: ContentPolicyRule
  ): { field?: string; value?: string } | null {
    const tags = card.data.tags || [];
    const targetTag = rule.pattern.toLowerCase();

    const found = tags.find((t) => t.toLowerCase() === targetTag);
    if (found) {
      return { field: 'tags', value: found };
    }
    return null;
  }

  /**
   * Creator rule - match card creator
   */
  private evaluateCreatorRule(
    card: CCv3Data,
    rule: ContentPolicyRule
  ): { field?: string; value?: string } | null {
    const creator = card.data.creator?.toLowerCase() || '';
    if (creator === rule.pattern.toLowerCase()) {
      return { field: 'creator', value: creator };
    }
    return null;
  }

  /**
   * Instance rule - match source domain
   * Supports wildcard patterns like "*.evil.com"
   */
  private evaluateInstanceRule(
    sourceInstance: string | undefined,
    rule: ContentPolicyRule
  ): { field?: string; value?: string } | null {
    if (!sourceInstance) return null;

    const domain = sourceInstance.toLowerCase();
    const pattern = rule.pattern.toLowerCase();

    // Support wildcard: "*.evil.com" matches "sub.evil.com"
    if (pattern.startsWith('*.')) {
      const suffix = pattern.slice(2); // Remove "*."
      if (domain.endsWith(suffix) || domain === suffix) {
        return { field: 'instance', value: domain };
      }
    } else if (domain === pattern) {
      return { field: 'instance', value: domain };
    }
    return null;
  }

  /**
   * Get a field value from card data
   */
  private getCardField(card: CCv3Data, field: string): unknown {
    // Handle nested fields like 'extensions.something'
    if (field.includes('.')) {
      const parts = field.split('.');
      let value: unknown = card.data;
      for (const part of parts) {
        if (value && typeof value === 'object' && part in value) {
          value = (value as Record<string, unknown>)[part];
        } else {
          return undefined;
        }
      }
      return value;
    }

    return (card.data as Record<string, unknown>)[field];
  }

  /**
   * Clear regex cache (call when rules change)
   */
  clearCache(): void {
    this.compiledRegexCache.clear();
  }

  /**
   * Pre-compile regexes for a policy (optimization)
   */
  precompilePolicy(policy: ContentPolicy): { errors: string[] } {
    const errors: string[] = [];

    for (const rule of policy.rules) {
      if (rule.type === 'regex' && rule.enabled) {
        try {
          const regex = new RegExp(rule.pattern, 'i');
          this.compiledRegexCache.set(rule.id, regex);
        } catch (err) {
          errors.push(`Rule "${rule.name}" has invalid regex: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    return { errors };
  }
}
