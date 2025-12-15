/**
 * Moderation Module
 *
 * Provides tools for community-based moderation in federated character card systems.
 *
 * @packageDocumentation
 */

// ============ Types ============
export type {
  // Activity types
  FlagActivity,
  BlockActivity,
  // Report types
  ModerationReport,
  ReportStatus,
  ReportCategory,
  // Action types
  ModerationAction,
  ActionType,
  // Block types
  InstanceBlock,
  InstanceBlockLevel,
  // Policy types
  ContentPolicy,
  ContentPolicyRule,
  PolicyRuleType,
  PolicyAction,
  PolicyEvaluationResult,
  // Rate limit types
  RateLimitBucket,
  RateLimitResult,
  // Store interface
  ModerationStore,
  // Event types
  ModerationEvent,
  ModerationEventType,
  ModerationEventListener,
} from './types.js';

// ============ Activities ============
export {
  MODERATION_ACTIVITY_CONTEXT,
  createFlagActivity,
  parseFlagActivity,
  validateFlagActivity,
  createBlockActivity,
  parseBlockActivity,
  validateBlockActivity,
} from './activities.js';

// ============ Stores ============
export { MemoryModerationStore } from './store.js';
export { D1ModerationStore } from './d1-store.js';

// ============ Engines ============
export { PolicyEngine, checkRegexSafety } from './policy-engine.js';
export { RateLimiter, type RateLimiterConfig } from './rate-limiter.js';
