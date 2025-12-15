/**
 * Moderation Types
 *
 * Core types for federated moderation infrastructure.
 * Provides tools for communities to self-moderate without imposing specific morality.
 */

import type { ActivityPubContext } from '../types.js';

// ============ Activity Types ============

/**
 * Flag activity for reporting content/actors
 * Per ActivityPub spec, Flag is delivered directly to target's inbox
 */
export interface FlagActivity {
  '@context': ActivityPubContext;
  id: string;
  type: 'Flag';
  /** Reporter actor URI */
  actor: string;
  /** Reported content/actor URI(s) */
  object: string | string[];
  /** Report reason/description */
  content?: string;
  /** Report category (flexible string - communities define their own) */
  category?: string;
  published: string;
  /** Target instance inbox */
  to?: string[];
}

/**
 * Block activity for instance-level blocking
 */
export interface BlockActivity {
  '@context': ActivityPubContext;
  id: string;
  type: 'Block';
  /** Admin actor URI */
  actor: string;
  /** Blocked instance domain or actor URI */
  object: string;
  /** Block reason */
  summary?: string;
  published: string;
}

// ============ Report Types ============

/**
 * Report status - flexible string, communities define their own workflow
 * Common values: 'pending', 'reviewing', 'resolved', 'dismissed', 'escalated'
 */
export type ReportStatus = string;

/**
 * Report category - flexible string, communities define their own categories
 * Examples: 'spam', 'harassment', 'nsfw_unmarked', 'copyright', 'illegal_content', etc.
 */
export type ReportCategory = string;

/**
 * Moderation report record
 */
export interface ModerationReport {
  /** Unique report ID */
  id: string;
  /** Reporter actor URI */
  reporterActorId: string;
  /** Reporter's instance domain */
  reporterInstance: string;
  /** Reported content/actor URI(s) */
  targetIds: string[];
  /** Report category */
  category: ReportCategory;
  /** Detailed description */
  description: string;
  /** Report status */
  status: ReportStatus;
  /** Associated Flag activity ID */
  activityId: string;
  /** Timestamp when created */
  createdAt: string;
  /** Timestamp of last update */
  updatedAt: string;
  /** Instance where report was received */
  receivingInstance: string;
  /** Whether the report was federated to target instance */
  federatedToTarget: boolean;
  /** Any additional context/metadata */
  metadata?: Record<string, unknown>;
}

// ============ Moderation Action Types ============

/**
 * Action type - flexible string, communities define their own actions
 * Examples: 'warn', 'delete', 'suspend', 'silence', 'ban', 'reject_report', 'escalate', 'restore'
 */
export type ActionType = string;

/**
 * Moderation action record - audit trail for moderator decisions
 */
export interface ModerationAction {
  /** Unique action ID */
  id: string;
  /** Report this action addresses (optional - some actions are proactive) */
  reportId?: string;
  /** Moderator actor URI */
  moderatorActorId: string;
  /** Target of the action (actor or content URI) */
  targetId: string;
  /** Type of action taken */
  actionType: ActionType;
  /** Reason/justification for action */
  reason: string;
  /** When action was taken */
  timestamp: string;
  /** When action expires (for temporary actions like suspensions) */
  expiresAt?: string;
  /** Whether action is currently active */
  active: boolean;
  /** Previous action this reverses (for undo/restore) */
  reversesActionId?: string;
  /** Audit trail - who approved (for multi-mod workflows) */
  approvedBy?: string[];
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

// ============ Instance Block Types ============

/**
 * Instance block level
 * - suspend: Full defederation, reject all activities
 * - silence: Don't show in public feeds, but allow existing follows
 * - reject_media: Accept text but reject media/assets
 */
export type InstanceBlockLevel = 'suspend' | 'silence' | 'reject_media';

/**
 * Instance block record for defederation
 */
export interface InstanceBlock {
  /** Unique block ID */
  id: string;
  /** Blocked instance domain (e.g., "evil.example.com") */
  blockedDomain: string;
  /** Block level */
  level: InstanceBlockLevel;
  /** Reason for block */
  reason: string;
  /** Admin who created block */
  createdBy: string;
  /** When block was created */
  createdAt: string;
  /** Whether block is active */
  active: boolean;
  /** Optional: public comment for transparency reports */
  publicComment?: string;
  /** Whether to announce block to federation peers */
  federate: boolean;
}

// ============ Content Policy Types ============

/**
 * Policy rule types
 * - keyword: Text contains keyword (case-insensitive)
 * - regex: Text matches regex pattern
 * - tag: Card has specific tag
 * - creator: Card from specific creator
 * - instance: Card from specific instance domain
 */
export type PolicyRuleType = 'keyword' | 'regex' | 'tag' | 'creator' | 'instance';

/**
 * Policy action on rule match
 * - allow: Explicitly allow (bypass other checks, whitelist)
 * - warn: Log warning, allow through
 * - review: Queue for manual review
 * - reject: Block entirely
 * - quarantine: Accept but limit visibility
 */
export type PolicyAction = 'allow' | 'warn' | 'review' | 'reject' | 'quarantine';

/**
 * Content policy rule
 */
export interface ContentPolicyRule {
  /** Unique rule ID */
  id: string;
  /** Rule name for admin reference */
  name: string;
  /** Rule type */
  type: PolicyRuleType;
  /** Pattern/value to match (interpretation depends on type) */
  pattern: string;
  /**
   * Fields to check (for keyword/regex)
   * Default: ['name', 'description', 'personality', 'scenario']
   */
  targetFields?: string[];
  /** Action to take on match */
  action: PolicyAction;
  /** Priority (lower = checked first, allows for whitelist rules) */
  priority: number;
  /** Whether rule is enabled */
  enabled: boolean;
  /** Optional explanation for transparency */
  publicReason?: string;
  /** When rule was created */
  createdAt: string;
  /** Who created the rule */
  createdBy: string;
}

/**
 * Content policy (collection of rules)
 */
export interface ContentPolicy {
  /** Policy ID */
  id: string;
  /** Policy name */
  name: string;
  /** Description */
  description: string;
  /** Rules in this policy */
  rules: ContentPolicyRule[];
  /** Whether policy is active */
  enabled: boolean;
  /** Default action if no rules match */
  defaultAction: PolicyAction;
  /** When policy was last updated */
  updatedAt: string;
}

/**
 * Result of policy evaluation
 */
export interface PolicyEvaluationResult {
  /** Final action to take */
  action: PolicyAction;
  /** Rules that matched (for audit) */
  matchedRules: Array<{
    ruleId: string;
    ruleName: string;
    matchedField?: string;
    matchedValue?: string;
  }>;
  /** Whether any rules matched */
  hasMatch: boolean;
}

// ============ Rate Limiting Types ============

/**
 * Rate limit bucket for an actor
 */
export interface RateLimitBucket {
  /** Actor ID */
  actorId: string;
  /** Current token count */
  tokens: number;
  /** Max tokens (bucket capacity) */
  maxTokens: number;
  /** Last time bucket was refilled (ISO timestamp) */
  lastRefill: string;
  /** Refill rate (tokens per hour) */
  refillRate: number;
}

/**
 * Rate limit check result
 */
export interface RateLimitResult {
  /** Whether action is allowed */
  allowed: boolean;
  /** Remaining tokens */
  remaining: number;
  /** When bucket resets (ISO timestamp) */
  resetAt: string;
  /** Retry-After header value in seconds (if not allowed) */
  retryAfter?: number;
}

// ============ Store Interface ============

/**
 * Moderation store interface
 * Follows same pattern as SyncStateStore for consistency
 */
export interface ModerationStore {
  // ---- Report operations ----

  /** Create a new report */
  createReport(report: Omit<ModerationReport, 'id'>): Promise<ModerationReport>;

  /** Get report by ID */
  getReport(id: string): Promise<ModerationReport | null>;

  /** Update report */
  updateReport(id: string, updates: Partial<ModerationReport>): Promise<void>;

  /** List reports with optional filters */
  listReports(filters?: {
    status?: ReportStatus;
    category?: ReportCategory;
    targetId?: string;
    reporterActorId?: string;
    since?: string;
    limit?: number;
    offset?: number;
  }): Promise<ModerationReport[]>;

  /** Count reports */
  countReports(filters?: { status?: ReportStatus }): Promise<number>;

  // ---- Action operations ----

  /** Create a moderation action */
  createAction(action: Omit<ModerationAction, 'id'>): Promise<ModerationAction>;

  /** Get action by ID */
  getAction(id: string): Promise<ModerationAction | null>;

  /** List actions with optional filters */
  listActions(filters?: {
    targetId?: string;
    moderatorActorId?: string;
    actionType?: ActionType;
    active?: boolean;
    since?: string;
    limit?: number;
  }): Promise<ModerationAction[]>;

  /** Deactivate an action (for reversal) */
  deactivateAction(id: string): Promise<void>;

  // ---- Instance block operations ----

  /** Create an instance block */
  createBlock(block: Omit<InstanceBlock, 'id'>): Promise<InstanceBlock>;

  /** Get block by ID */
  getBlock(id: string): Promise<InstanceBlock | null>;

  /** Get block by domain */
  getBlockByDomain(domain: string): Promise<InstanceBlock | null>;

  /** List blocks */
  listBlocks(filters?: { active?: boolean }): Promise<InstanceBlock[]>;

  /** Update block */
  updateBlock(id: string, updates: Partial<InstanceBlock>): Promise<void>;

  /** Check if instance is blocked */
  isInstanceBlocked(domain: string): Promise<boolean>;

  // ---- Content policy operations ----

  /** Create a content policy */
  createPolicy(policy: Omit<ContentPolicy, 'id'>): Promise<ContentPolicy>;

  /** Get policy by ID */
  getPolicy(id: string): Promise<ContentPolicy | null>;

  /** List policies */
  listPolicies(filters?: { enabled?: boolean }): Promise<ContentPolicy[]>;

  /** Update policy */
  updatePolicy(id: string, updates: Partial<ContentPolicy>): Promise<void>;

  /** Delete policy */
  deletePolicy(id: string): Promise<void>;

  // ---- Rate limit operations ----

  /** Get rate limit bucket for actor */
  getRateLimitBucket(actorId: string): Promise<RateLimitBucket | null>;

  /** Update rate limit bucket */
  updateRateLimitBucket(bucket: RateLimitBucket): Promise<void>;

  // ---- Audit ----

  /** Get audit log (alias for listActions with specific filters) */
  getAuditLog(filters?: {
    targetId?: string;
    actorId?: string;
    since?: string;
    until?: string;
    limit?: number;
  }): Promise<ModerationAction[]>;
}

// ============ Event Types ============

/**
 * Moderation event types
 */
export type ModerationEventType =
  | 'report:created'
  | 'report:updated'
  | 'report:resolved'
  | 'action:created'
  | 'action:reverted'
  | 'block:created'
  | 'block:removed'
  | 'policy:matched'
  | 'policy:rejected';

/**
 * Moderation event
 */
export interface ModerationEvent {
  type: ModerationEventType;
  timestamp: string;
  data: unknown;
}

/**
 * Moderation event listener
 */
export type ModerationEventListener = (event: ModerationEvent) => void | Promise<void>;
