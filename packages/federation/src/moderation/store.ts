/**
 * In-Memory Moderation Store
 *
 * Memory implementation for testing and single-session use.
 * Follows the same pattern as MemorySyncStateStore.
 */

import { generateUUID } from '@character-foundry/core';
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
} from './types.js';

/**
 * In-memory implementation of ModerationStore
 *
 * Suitable for testing, development, and single-session use cases.
 * Data is lost when the process ends.
 */
export class MemoryModerationStore implements ModerationStore {
  private reports: Map<string, ModerationReport> = new Map();
  private actions: Map<string, ModerationAction> = new Map();
  private blocks: Map<string, InstanceBlock> = new Map();
  private policies: Map<string, ContentPolicy> = new Map();
  private rateLimits: Map<string, RateLimitBucket> = new Map();

  // ============ Report Operations ============

  async createReport(report: Omit<ModerationReport, 'id'>): Promise<ModerationReport> {
    const id = generateUUID();
    const full: ModerationReport = { ...report, id };
    this.reports.set(id, full);
    return full;
  }

  async getReport(id: string): Promise<ModerationReport | null> {
    return this.reports.get(id) || null;
  }

  async updateReport(id: string, updates: Partial<ModerationReport>): Promise<void> {
    const existing = this.reports.get(id);
    if (existing) {
      this.reports.set(id, {
        ...existing,
        ...updates,
        updatedAt: new Date().toISOString(),
      });
    }
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
    let results = Array.from(this.reports.values());

    if (filters?.status) {
      results = results.filter((r) => r.status === filters.status);
    }
    if (filters?.category) {
      results = results.filter((r) => r.category === filters.category);
    }
    if (filters?.targetId) {
      results = results.filter((r) => r.targetIds.includes(filters.targetId!));
    }
    if (filters?.reporterActorId) {
      results = results.filter((r) => r.reporterActorId === filters.reporterActorId);
    }
    if (filters?.since) {
      results = results.filter((r) => r.createdAt >= filters.since!);
    }

    // Sort by creation date descending (newest first)
    results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const offset = filters?.offset || 0;
    const limit = filters?.limit || 100;
    return results.slice(offset, offset + limit);
  }

  async countReports(filters?: { status?: ReportStatus }): Promise<number> {
    let count = 0;
    for (const report of this.reports.values()) {
      if (!filters?.status || report.status === filters.status) {
        count++;
      }
    }
    return count;
  }

  // ============ Action Operations ============

  async createAction(action: Omit<ModerationAction, 'id'>): Promise<ModerationAction> {
    const id = generateUUID();
    const full: ModerationAction = { ...action, id };
    this.actions.set(id, full);
    return full;
  }

  async getAction(id: string): Promise<ModerationAction | null> {
    return this.actions.get(id) || null;
  }

  async listActions(filters?: {
    targetId?: string;
    moderatorActorId?: string;
    actionType?: ActionType;
    active?: boolean;
    since?: string;
    limit?: number;
  }): Promise<ModerationAction[]> {
    let results = Array.from(this.actions.values());

    if (filters?.targetId) {
      results = results.filter((a) => a.targetId === filters.targetId);
    }
    if (filters?.moderatorActorId) {
      results = results.filter((a) => a.moderatorActorId === filters.moderatorActorId);
    }
    if (filters?.actionType) {
      results = results.filter((a) => a.actionType === filters.actionType);
    }
    if (filters?.active !== undefined) {
      results = results.filter((a) => a.active === filters.active);
    }
    if (filters?.since) {
      results = results.filter((a) => a.timestamp >= filters.since!);
    }

    // Sort by timestamp descending (newest first)
    results.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return results.slice(0, filters?.limit || 100);
  }

  async deactivateAction(id: string): Promise<void> {
    const action = this.actions.get(id);
    if (action) {
      this.actions.set(id, { ...action, active: false });
    }
  }

  // ============ Instance Block Operations ============

  async createBlock(block: Omit<InstanceBlock, 'id'>): Promise<InstanceBlock> {
    const id = generateUUID();
    const full: InstanceBlock = { ...block, id };
    this.blocks.set(id, full);
    return full;
  }

  async getBlock(id: string): Promise<InstanceBlock | null> {
    return this.blocks.get(id) || null;
  }

  async getBlockByDomain(domain: string): Promise<InstanceBlock | null> {
    const normalized = domain.toLowerCase();
    for (const block of this.blocks.values()) {
      if (block.blockedDomain.toLowerCase() === normalized && block.active) {
        return block;
      }
    }
    return null;
  }

  async listBlocks(filters?: { active?: boolean }): Promise<InstanceBlock[]> {
    let results = Array.from(this.blocks.values());
    if (filters?.active !== undefined) {
      results = results.filter((b) => b.active === filters.active);
    }
    // Sort by creation date descending
    results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return results;
  }

  async updateBlock(id: string, updates: Partial<InstanceBlock>): Promise<void> {
    const existing = this.blocks.get(id);
    if (existing) {
      this.blocks.set(id, { ...existing, ...updates });
    }
  }

  async isInstanceBlocked(domain: string): Promise<boolean> {
    const block = await this.getBlockByDomain(domain);
    return block !== null;
  }

  // ============ Content Policy Operations ============

  async createPolicy(policy: Omit<ContentPolicy, 'id'>): Promise<ContentPolicy> {
    const id = generateUUID();
    const full: ContentPolicy = { ...policy, id };
    this.policies.set(id, full);
    return full;
  }

  async getPolicy(id: string): Promise<ContentPolicy | null> {
    return this.policies.get(id) || null;
  }

  async listPolicies(filters?: { enabled?: boolean }): Promise<ContentPolicy[]> {
    let results = Array.from(this.policies.values());
    if (filters?.enabled !== undefined) {
      results = results.filter((p) => p.enabled === filters.enabled);
    }
    return results;
  }

  async updatePolicy(id: string, updates: Partial<ContentPolicy>): Promise<void> {
    const existing = this.policies.get(id);
    if (existing) {
      this.policies.set(id, {
        ...existing,
        ...updates,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  async deletePolicy(id: string): Promise<void> {
    this.policies.delete(id);
  }

  // ============ Rate Limit Operations ============

  async getRateLimitBucket(actorId: string): Promise<RateLimitBucket | null> {
    return this.rateLimits.get(actorId) || null;
  }

  async updateRateLimitBucket(bucket: RateLimitBucket): Promise<void> {
    this.rateLimits.set(bucket.actorId, bucket);
  }

  // ============ Audit ============

  async getAuditLog(filters?: {
    targetId?: string;
    actorId?: string;
    since?: string;
    until?: string;
    limit?: number;
  }): Promise<ModerationAction[]> {
    let results = await this.listActions({
      targetId: filters?.targetId,
      moderatorActorId: filters?.actorId,
      since: filters?.since,
      limit: filters?.limit,
    });

    if (filters?.until) {
      results = results.filter((a) => a.timestamp <= filters.until!);
    }

    return results;
  }

  // ============ Utility Methods ============

  /**
   * Clear all data (useful for testing)
   */
  clear(): void {
    this.reports.clear();
    this.actions.clear();
    this.blocks.clear();
    this.policies.clear();
    this.rateLimits.clear();
  }

  /**
   * Get counts for dashboard/stats
   */
  async getStats(): Promise<{
    reports: { total: number; pending: number };
    actions: { total: number; active: number };
    blocks: { total: number; active: number };
    policies: { total: number; enabled: number };
  }> {
    const pendingReports = await this.countReports({ status: 'pending' });
    const activeActions = (await this.listActions({ active: true })).length;
    const activeBlocks = (await this.listBlocks({ active: true })).length;
    const enabledPolicies = (await this.listPolicies({ enabled: true })).length;

    return {
      reports: {
        total: this.reports.size,
        pending: pendingReports,
      },
      actions: {
        total: this.actions.size,
        active: activeActions,
      },
      blocks: {
        total: this.blocks.size,
        active: activeBlocks,
      },
      policies: {
        total: this.policies.size,
        enabled: enabledPolicies,
      },
    };
  }
}
