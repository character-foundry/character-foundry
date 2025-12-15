/**
 * D1 Moderation Store
 *
 * Cloudflare D1-compatible implementation of ModerationStore for production
 * moderation support on Cloudflare Workers.
 */

import type { D1Database } from '../d1-store.js';
import type {
  ModerationStore,
  ModerationReport,
  ModerationAction,
  InstanceBlock,
  ContentPolicy,
  RateLimitBucket,
  ReportStatus,
  ReportCategory,
  ActionType,
  InstanceBlockLevel,
  PolicyAction,
} from './types.js';

/**
 * Database row for ModerationReport
 */
interface ReportRow {
  id: string;
  reporter_actor_id: string;
  reporter_instance: string;
  target_ids: string; // JSON array
  category: string;
  description: string;
  status: string;
  activity_id: string;
  created_at: string;
  updated_at: string;
  receiving_instance: string;
  federated_to_target: number; // SQLite boolean
  metadata: string | null;
}

/**
 * Database row for ModerationAction
 */
interface ActionRow {
  id: string;
  report_id: string | null;
  moderator_actor_id: string;
  target_id: string;
  action_type: string;
  reason: string;
  timestamp: string;
  expires_at: string | null;
  active: number; // SQLite boolean
  reverses_action_id: string | null;
  approved_by: string | null; // JSON array
  metadata: string | null;
}

/**
 * Database row for InstanceBlock
 */
interface BlockRow {
  id: string;
  blocked_domain: string;
  level: string;
  reason: string;
  created_by: string;
  created_at: string;
  active: number;
  public_comment: string | null;
  federate: number;
}

/**
 * Database row for ContentPolicy
 */
interface PolicyRow {
  id: string;
  name: string;
  description: string;
  rules: string; // JSON array
  enabled: number;
  default_action: string;
  updated_at: string;
}

/**
 * Database row for RateLimitBucket
 */
interface RateLimitRow {
  actor_id: string;
  tokens: number;
  max_tokens: number;
  last_refill: string;
  refill_rate: number;
}

/**
 * Validate table name prefix to prevent SQL injection
 */
function validateTablePrefix(prefix: string): void {
  const validPattern = /^[a-zA-Z][a-zA-Z0-9_]*$/;
  if (!validPattern.test(prefix)) {
    throw new Error(
      `Invalid table prefix "${prefix}": must start with a letter and contain only alphanumeric characters and underscores`
    );
  }
  if (prefix.length > 32) {
    throw new Error(`Invalid table prefix "${prefix}": must be 32 characters or less`);
  }
}

/**
 * D1-compatible implementation of ModerationStore
 *
 * @example
 * ```typescript
 * const store = new D1ModerationStore(env.DB);
 * await store.init();
 *
 * // Create a report
 * const report = await store.createReport({
 *   reporterActorId: 'https://example.com/users/alice',
 *   reporterInstance: 'example.com',
 *   targetIds: ['https://bad.com/cards/spam'],
 *   category: 'spam',
 *   description: 'This card is spam',
 *   status: 'pending',
 *   activityId: 'https://example.com/activities/123',
 *   createdAt: new Date().toISOString(),
 *   updatedAt: new Date().toISOString(),
 *   receivingInstance: 'bad.com',
 *   federatedToTarget: true,
 * });
 * ```
 */
export class D1ModerationStore implements ModerationStore {
  private db: D1Database;
  private prefix: string;

  constructor(db: D1Database, tablePrefix = 'moderation') {
    validateTablePrefix(tablePrefix);
    this.db = db;
    this.prefix = tablePrefix;
  }

  /**
   * Initialize all moderation tables
   */
  async init(): Promise<void> {
    // Reports table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS ${this.prefix}_reports (
        id TEXT PRIMARY KEY,
        reporter_actor_id TEXT NOT NULL,
        reporter_instance TEXT NOT NULL,
        target_ids TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT NOT NULL,
        status TEXT NOT NULL,
        activity_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        receiving_instance TEXT NOT NULL,
        federated_to_target INTEGER NOT NULL DEFAULT 0,
        metadata TEXT
      )
    `);

    await this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_${this.prefix}_reports_status
      ON ${this.prefix}_reports(status)
    `);

    await this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_${this.prefix}_reports_reporter
      ON ${this.prefix}_reports(reporter_actor_id)
    `);

    // Actions table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS ${this.prefix}_actions (
        id TEXT PRIMARY KEY,
        report_id TEXT,
        moderator_actor_id TEXT NOT NULL,
        target_id TEXT NOT NULL,
        action_type TEXT NOT NULL,
        reason TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        expires_at TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        reverses_action_id TEXT,
        approved_by TEXT,
        metadata TEXT
      )
    `);

    await this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_${this.prefix}_actions_target
      ON ${this.prefix}_actions(target_id)
    `);

    await this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_${this.prefix}_actions_active
      ON ${this.prefix}_actions(active)
    `);

    // Instance blocks table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS ${this.prefix}_blocks (
        id TEXT PRIMARY KEY,
        blocked_domain TEXT NOT NULL UNIQUE,
        level TEXT NOT NULL CHECK (level IN ('suspend', 'silence', 'reject_media')),
        reason TEXT NOT NULL,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1,
        public_comment TEXT,
        federate INTEGER NOT NULL DEFAULT 0
      )
    `);

    await this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_${this.prefix}_blocks_domain
      ON ${this.prefix}_blocks(blocked_domain)
    `);

    // Content policies table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS ${this.prefix}_policies (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT NOT NULL,
        rules TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        default_action TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    // Rate limits table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS ${this.prefix}_rate_limits (
        actor_id TEXT PRIMARY KEY,
        tokens REAL NOT NULL,
        max_tokens INTEGER NOT NULL,
        last_refill TEXT NOT NULL,
        refill_rate REAL NOT NULL
      )
    `);
  }

  // ============ Report Operations ============

  async createReport(report: Omit<ModerationReport, 'id'>): Promise<ModerationReport> {
    const id = crypto.randomUUID();
    const full: ModerationReport = { ...report, id };

    await this.db
      .prepare(
        `INSERT INTO ${this.prefix}_reports
         (id, reporter_actor_id, reporter_instance, target_ids, category, description, status,
          activity_id, created_at, updated_at, receiving_instance, federated_to_target, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        report.reporterActorId,
        report.reporterInstance,
        JSON.stringify(report.targetIds),
        report.category,
        report.description,
        report.status,
        report.activityId,
        report.createdAt,
        report.updatedAt,
        report.receivingInstance,
        report.federatedToTarget ? 1 : 0,
        report.metadata ? JSON.stringify(report.metadata) : null
      )
      .run();

    return full;
  }

  async getReport(id: string): Promise<ModerationReport | null> {
    const row = await this.db
      .prepare(`SELECT * FROM ${this.prefix}_reports WHERE id = ?`)
      .bind(id)
      .first<ReportRow>();

    return row ? this.rowToReport(row) : null;
  }

  async updateReport(id: string, updates: Partial<ModerationReport>): Promise<void> {
    const existing = await this.getReport(id);
    if (!existing) return;

    const merged = { ...existing, ...updates, updatedAt: new Date().toISOString() };

    await this.db
      .prepare(
        `UPDATE ${this.prefix}_reports SET
         reporter_actor_id = ?, reporter_instance = ?, target_ids = ?, category = ?,
         description = ?, status = ?, activity_id = ?, updated_at = ?,
         receiving_instance = ?, federated_to_target = ?, metadata = ?
         WHERE id = ?`
      )
      .bind(
        merged.reporterActorId,
        merged.reporterInstance,
        JSON.stringify(merged.targetIds),
        merged.category,
        merged.description,
        merged.status,
        merged.activityId,
        merged.updatedAt,
        merged.receivingInstance,
        merged.federatedToTarget ? 1 : 0,
        merged.metadata ? JSON.stringify(merged.metadata) : null,
        id
      )
      .run();
  }

  async listReports(filters?: {
    status?: ReportStatus;
    category?: ReportCategory;
    targetId?: string;
    reporterActorId?: string;
    since?: string;
    limit?: number;
    offset?: number;
  }): Promise<ModerationReport[]> {
    const conditions: string[] = ['1=1'];
    const bindings: unknown[] = [];

    if (filters?.status) {
      conditions.push('status = ?');
      bindings.push(filters.status);
    }
    if (filters?.category) {
      conditions.push('category = ?');
      bindings.push(filters.category);
    }
    if (filters?.targetId) {
      conditions.push('target_ids LIKE ?');
      bindings.push(`%${filters.targetId}%`);
    }
    if (filters?.reporterActorId) {
      conditions.push('reporter_actor_id = ?');
      bindings.push(filters.reporterActorId);
    }
    if (filters?.since) {
      conditions.push('created_at >= ?');
      bindings.push(filters.since);
    }

    const limit = filters?.limit ?? 100;
    const offset = filters?.offset ?? 0;

    let stmt = this.db.prepare(
      `SELECT * FROM ${this.prefix}_reports
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`
    );

    for (const binding of bindings) {
      stmt = stmt.bind(binding);
    }
    stmt = stmt.bind(limit, offset);

    const result = await stmt.all<ReportRow>();
    return result.results.map((row) => this.rowToReport(row));
  }

  async countReports(filters?: { status?: ReportStatus }): Promise<number> {
    let query = `SELECT COUNT(*) as count FROM ${this.prefix}_reports`;
    const bindings: unknown[] = [];

    if (filters?.status) {
      query += ' WHERE status = ?';
      bindings.push(filters.status);
    }

    let stmt = this.db.prepare(query);
    for (const binding of bindings) {
      stmt = stmt.bind(binding);
    }

    const result = await stmt.first<{ count: number }>();
    return result?.count ?? 0;
  }

  // ============ Action Operations ============

  async createAction(action: Omit<ModerationAction, 'id'>): Promise<ModerationAction> {
    const id = crypto.randomUUID();
    const full: ModerationAction = { ...action, id };

    await this.db
      .prepare(
        `INSERT INTO ${this.prefix}_actions
         (id, report_id, moderator_actor_id, target_id, action_type, reason, timestamp,
          expires_at, active, reverses_action_id, approved_by, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        action.reportId ?? null,
        action.moderatorActorId,
        action.targetId,
        action.actionType,
        action.reason,
        action.timestamp,
        action.expiresAt ?? null,
        action.active ? 1 : 0,
        action.reversesActionId ?? null,
        action.approvedBy ? JSON.stringify(action.approvedBy) : null,
        action.metadata ? JSON.stringify(action.metadata) : null
      )
      .run();

    return full;
  }

  async getAction(id: string): Promise<ModerationAction | null> {
    const row = await this.db
      .prepare(`SELECT * FROM ${this.prefix}_actions WHERE id = ?`)
      .bind(id)
      .first<ActionRow>();

    return row ? this.rowToAction(row) : null;
  }

  async listActions(filters?: {
    targetId?: string;
    moderatorActorId?: string;
    actionType?: ActionType;
    active?: boolean;
    since?: string;
    limit?: number;
  }): Promise<ModerationAction[]> {
    const conditions: string[] = ['1=1'];
    const bindings: unknown[] = [];

    if (filters?.targetId) {
      conditions.push('target_id = ?');
      bindings.push(filters.targetId);
    }
    if (filters?.moderatorActorId) {
      conditions.push('moderator_actor_id = ?');
      bindings.push(filters.moderatorActorId);
    }
    if (filters?.actionType) {
      conditions.push('action_type = ?');
      bindings.push(filters.actionType);
    }
    if (filters?.active !== undefined) {
      conditions.push('active = ?');
      bindings.push(filters.active ? 1 : 0);
    }
    if (filters?.since) {
      conditions.push('timestamp >= ?');
      bindings.push(filters.since);
    }

    const limit = filters?.limit ?? 100;

    let stmt = this.db.prepare(
      `SELECT * FROM ${this.prefix}_actions
       WHERE ${conditions.join(' AND ')}
       ORDER BY timestamp DESC
       LIMIT ?`
    );

    for (const binding of bindings) {
      stmt = stmt.bind(binding);
    }
    stmt = stmt.bind(limit);

    const result = await stmt.all<ActionRow>();
    return result.results.map((row) => this.rowToAction(row));
  }

  async deactivateAction(id: string): Promise<void> {
    await this.db
      .prepare(`UPDATE ${this.prefix}_actions SET active = 0 WHERE id = ?`)
      .bind(id)
      .run();
  }

  // ============ Instance Block Operations ============

  async createBlock(block: Omit<InstanceBlock, 'id'>): Promise<InstanceBlock> {
    const id = crypto.randomUUID();
    const full: InstanceBlock = { ...block, id };

    await this.db
      .prepare(
        `INSERT INTO ${this.prefix}_blocks
         (id, blocked_domain, level, reason, created_by, created_at, active, public_comment, federate)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        block.blockedDomain.toLowerCase(),
        block.level,
        block.reason,
        block.createdBy,
        block.createdAt,
        block.active ? 1 : 0,
        block.publicComment ?? null,
        block.federate ? 1 : 0
      )
      .run();

    return full;
  }

  async getBlock(id: string): Promise<InstanceBlock | null> {
    const row = await this.db
      .prepare(`SELECT * FROM ${this.prefix}_blocks WHERE id = ?`)
      .bind(id)
      .first<BlockRow>();

    return row ? this.rowToBlock(row) : null;
  }

  async getBlockByDomain(domain: string): Promise<InstanceBlock | null> {
    const row = await this.db
      .prepare(`SELECT * FROM ${this.prefix}_blocks WHERE blocked_domain = ? AND active = 1`)
      .bind(domain.toLowerCase())
      .first<BlockRow>();

    return row ? this.rowToBlock(row) : null;
  }

  async listBlocks(filters?: { active?: boolean }): Promise<InstanceBlock[]> {
    let query = `SELECT * FROM ${this.prefix}_blocks`;
    const bindings: unknown[] = [];

    if (filters?.active !== undefined) {
      query += ' WHERE active = ?';
      bindings.push(filters.active ? 1 : 0);
    }

    query += ' ORDER BY created_at DESC';

    let stmt = this.db.prepare(query);
    for (const binding of bindings) {
      stmt = stmt.bind(binding);
    }

    const result = await stmt.all<BlockRow>();
    return result.results.map((row) => this.rowToBlock(row));
  }

  async updateBlock(id: string, updates: Partial<InstanceBlock>): Promise<void> {
    const existing = await this.getBlock(id);
    if (!existing) return;

    const merged = { ...existing, ...updates };

    await this.db
      .prepare(
        `UPDATE ${this.prefix}_blocks SET
         blocked_domain = ?, level = ?, reason = ?, active = ?, public_comment = ?, federate = ?
         WHERE id = ?`
      )
      .bind(
        merged.blockedDomain.toLowerCase(),
        merged.level,
        merged.reason,
        merged.active ? 1 : 0,
        merged.publicComment ?? null,
        merged.federate ? 1 : 0,
        id
      )
      .run();
  }

  async isInstanceBlocked(domain: string): Promise<boolean> {
    const block = await this.getBlockByDomain(domain);
    return block !== null;
  }

  // ============ Content Policy Operations ============

  async createPolicy(policy: Omit<ContentPolicy, 'id'>): Promise<ContentPolicy> {
    const id = crypto.randomUUID();
    const full: ContentPolicy = { ...policy, id };

    await this.db
      .prepare(
        `INSERT INTO ${this.prefix}_policies
         (id, name, description, rules, enabled, default_action, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        policy.name,
        policy.description,
        JSON.stringify(policy.rules),
        policy.enabled ? 1 : 0,
        policy.defaultAction,
        policy.updatedAt
      )
      .run();

    return full;
  }

  async getPolicy(id: string): Promise<ContentPolicy | null> {
    const row = await this.db
      .prepare(`SELECT * FROM ${this.prefix}_policies WHERE id = ?`)
      .bind(id)
      .first<PolicyRow>();

    return row ? this.rowToPolicy(row) : null;
  }

  async listPolicies(filters?: { enabled?: boolean }): Promise<ContentPolicy[]> {
    let query = `SELECT * FROM ${this.prefix}_policies`;
    const bindings: unknown[] = [];

    if (filters?.enabled !== undefined) {
      query += ' WHERE enabled = ?';
      bindings.push(filters.enabled ? 1 : 0);
    }

    query += ' ORDER BY name ASC';

    let stmt = this.db.prepare(query);
    for (const binding of bindings) {
      stmt = stmt.bind(binding);
    }

    const result = await stmt.all<PolicyRow>();
    return result.results.map((row) => this.rowToPolicy(row));
  }

  async updatePolicy(id: string, updates: Partial<ContentPolicy>): Promise<void> {
    const existing = await this.getPolicy(id);
    if (!existing) return;

    const merged = { ...existing, ...updates, updatedAt: new Date().toISOString() };

    await this.db
      .prepare(
        `UPDATE ${this.prefix}_policies SET
         name = ?, description = ?, rules = ?, enabled = ?, default_action = ?, updated_at = ?
         WHERE id = ?`
      )
      .bind(
        merged.name,
        merged.description,
        JSON.stringify(merged.rules),
        merged.enabled ? 1 : 0,
        merged.defaultAction,
        merged.updatedAt,
        id
      )
      .run();
  }

  async deletePolicy(id: string): Promise<void> {
    await this.db.prepare(`DELETE FROM ${this.prefix}_policies WHERE id = ?`).bind(id).run();
  }

  // ============ Rate Limit Operations ============

  async getRateLimitBucket(actorId: string): Promise<RateLimitBucket | null> {
    const row = await this.db
      .prepare(`SELECT * FROM ${this.prefix}_rate_limits WHERE actor_id = ?`)
      .bind(actorId)
      .first<RateLimitRow>();

    return row ? this.rowToRateLimit(row) : null;
  }

  async updateRateLimitBucket(bucket: RateLimitBucket): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO ${this.prefix}_rate_limits (actor_id, tokens, max_tokens, last_refill, refill_rate)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(actor_id) DO UPDATE SET
           tokens = excluded.tokens,
           max_tokens = excluded.max_tokens,
           last_refill = excluded.last_refill,
           refill_rate = excluded.refill_rate`
      )
      .bind(bucket.actorId, bucket.tokens, bucket.maxTokens, bucket.lastRefill, bucket.refillRate)
      .run();
  }

  // ============ Audit ============

  async getAuditLog(filters?: {
    targetId?: string;
    actorId?: string;
    since?: string;
    until?: string;
    limit?: number;
  }): Promise<ModerationAction[]> {
    const conditions: string[] = ['1=1'];
    const bindings: unknown[] = [];

    if (filters?.targetId) {
      conditions.push('target_id = ?');
      bindings.push(filters.targetId);
    }
    if (filters?.actorId) {
      conditions.push('moderator_actor_id = ?');
      bindings.push(filters.actorId);
    }
    if (filters?.since) {
      conditions.push('timestamp >= ?');
      bindings.push(filters.since);
    }
    if (filters?.until) {
      conditions.push('timestamp <= ?');
      bindings.push(filters.until);
    }

    const limit = filters?.limit ?? 100;

    let stmt = this.db.prepare(
      `SELECT * FROM ${this.prefix}_actions
       WHERE ${conditions.join(' AND ')}
       ORDER BY timestamp DESC
       LIMIT ?`
    );

    for (const binding of bindings) {
      stmt = stmt.bind(binding);
    }
    stmt = stmt.bind(limit);

    const result = await stmt.all<ActionRow>();
    return result.results.map((row) => this.rowToAction(row));
  }

  // ============ Utility Methods ============

  /**
   * Clear all moderation data (for testing)
   */
  async clear(): Promise<void> {
    await this.db.prepare(`DELETE FROM ${this.prefix}_reports`).run();
    await this.db.prepare(`DELETE FROM ${this.prefix}_actions`).run();
    await this.db.prepare(`DELETE FROM ${this.prefix}_blocks`).run();
    await this.db.prepare(`DELETE FROM ${this.prefix}_policies`).run();
    await this.db.prepare(`DELETE FROM ${this.prefix}_rate_limits`).run();
  }

  /**
   * Get stats for dashboard
   */
  async getStats(): Promise<{
    reports: { total: number; pending: number };
    actions: { total: number; active: number };
    blocks: { total: number; active: number };
    policies: { total: number; enabled: number };
  }> {
    const [reportsTotal, reportsPending, actionsTotal, actionsActive, blocksTotal, blocksActive, policiesTotal, policiesEnabled] = await Promise.all([
      this.db.prepare(`SELECT COUNT(*) as count FROM ${this.prefix}_reports`).first<{ count: number }>(),
      this.db.prepare(`SELECT COUNT(*) as count FROM ${this.prefix}_reports WHERE status = 'pending'`).first<{ count: number }>(),
      this.db.prepare(`SELECT COUNT(*) as count FROM ${this.prefix}_actions`).first<{ count: number }>(),
      this.db.prepare(`SELECT COUNT(*) as count FROM ${this.prefix}_actions WHERE active = 1`).first<{ count: number }>(),
      this.db.prepare(`SELECT COUNT(*) as count FROM ${this.prefix}_blocks`).first<{ count: number }>(),
      this.db.prepare(`SELECT COUNT(*) as count FROM ${this.prefix}_blocks WHERE active = 1`).first<{ count: number }>(),
      this.db.prepare(`SELECT COUNT(*) as count FROM ${this.prefix}_policies`).first<{ count: number }>(),
      this.db.prepare(`SELECT COUNT(*) as count FROM ${this.prefix}_policies WHERE enabled = 1`).first<{ count: number }>(),
    ]);

    return {
      reports: { total: reportsTotal?.count ?? 0, pending: reportsPending?.count ?? 0 },
      actions: { total: actionsTotal?.count ?? 0, active: actionsActive?.count ?? 0 },
      blocks: { total: blocksTotal?.count ?? 0, active: blocksActive?.count ?? 0 },
      policies: { total: policiesTotal?.count ?? 0, enabled: policiesEnabled?.count ?? 0 },
    };
  }

  // ============ Row Converters ============

  private rowToReport(row: ReportRow): ModerationReport {
    return {
      id: row.id,
      reporterActorId: row.reporter_actor_id,
      reporterInstance: row.reporter_instance,
      targetIds: JSON.parse(row.target_ids) as string[],
      category: row.category as ReportCategory,
      description: row.description,
      status: row.status as ReportStatus,
      activityId: row.activity_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      receivingInstance: row.receiving_instance,
      federatedToTarget: row.federated_to_target === 1,
      metadata: row.metadata ? (JSON.parse(row.metadata) as Record<string, unknown>) : undefined,
    };
  }

  private rowToAction(row: ActionRow): ModerationAction {
    return {
      id: row.id,
      reportId: row.report_id ?? undefined,
      moderatorActorId: row.moderator_actor_id,
      targetId: row.target_id,
      actionType: row.action_type as ActionType,
      reason: row.reason,
      timestamp: row.timestamp,
      expiresAt: row.expires_at ?? undefined,
      active: row.active === 1,
      reversesActionId: row.reverses_action_id ?? undefined,
      approvedBy: row.approved_by ? (JSON.parse(row.approved_by) as string[]) : undefined,
      metadata: row.metadata ? (JSON.parse(row.metadata) as Record<string, unknown>) : undefined,
    };
  }

  private rowToBlock(row: BlockRow): InstanceBlock {
    return {
      id: row.id,
      blockedDomain: row.blocked_domain,
      level: row.level as InstanceBlockLevel,
      reason: row.reason,
      createdBy: row.created_by,
      createdAt: row.created_at,
      active: row.active === 1,
      publicComment: row.public_comment ?? undefined,
      federate: row.federate === 1,
    };
  }

  private rowToPolicy(row: PolicyRow): ContentPolicy {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      rules: JSON.parse(row.rules) as ContentPolicy['rules'],
      enabled: row.enabled === 1,
      defaultAction: row.default_action as PolicyAction,
      updatedAt: row.updated_at,
    };
  }

  private rowToRateLimit(row: RateLimitRow): RateLimitBucket {
    return {
      actorId: row.actor_id,
      tokens: row.tokens,
      maxTokens: row.max_tokens,
      lastRefill: row.last_refill,
      refillRate: row.refill_rate,
    };
  }
}
