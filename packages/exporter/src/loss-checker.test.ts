/**
 * Loss Checker Tests
 */

import { describe, it, expect } from 'vitest';
import { checkExportLoss, preExportCheck, formatLossReport } from './loss-checker.js';
import type { CCv3Data } from '@character-foundry/schemas';
import type { ExportAsset } from './types.js';

const createTestCard = (overrides: Partial<CCv3Data['data']> = {}): CCv3Data => ({
  spec: 'chara_card_v3',
  spec_version: '3.0',
  data: {
    name: 'Test Character',
    description: 'A test character',
    personality: 'Friendly',
    scenario: 'Testing',
    first_mes: 'Hello!',
    mes_example: '',
    creator_notes: '',
    system_prompt: '',
    post_history_instructions: '',
    alternate_greetings: [],
    group_only_greetings: [],
    tags: [],
    creator: 'Tester',
    character_version: '1.0',
    extensions: {},
    ...overrides,
  },
});

const createTestAsset = (overrides: Partial<ExportAsset> = {}): ExportAsset => ({
  name: 'main',
  type: 'icon',
  ext: 'png',
  data: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
  isMain: true,
  ...overrides,
});

describe('checkExportLoss', () => {
  describe('PNG export', () => {
    it('should report no loss for simple card with one icon', () => {
      const card = createTestCard();
      const assets = [createTestAsset()];

      const report = checkExportLoss(card, assets, 'png');

      expect(report.targetFormat).toBe('png');
      expect(report.lostFields.length).toBe(0);
      expect(report.isLossless).toBe(true);
    });

    it('should report lost assets for non-icon assets', () => {
      const card = createTestCard();
      const assets = [
        createTestAsset(),
        createTestAsset({ name: 'bgm', type: 'sound', ext: 'mp3', isMain: false }),
      ];

      const report = checkExportLoss(card, assets, 'png');

      expect(report.lostAssets.length).toBe(1);
      expect(report.lostAssets[0]).toContain('bgm');
      expect(report.isLossless).toBe(false);
    });
  });

  describe('CharX export', () => {
    it('should report minimal loss for standard card', () => {
      const card = createTestCard();
      const assets = [createTestAsset()];

      const report = checkExportLoss(card, assets, 'charx');

      expect(report.targetFormat).toBe('charx');
      expect(report.lostFields.length).toBe(0);
      expect(report.isLossless).toBe(true);
    });

    it('should warn about voxta extensions', () => {
      const card = createTestCard({
        extensions: { voxta: { id: 'test' } },
      });
      const assets = [createTestAsset()];

      const report = checkExportLoss(card, assets, 'charx');

      expect(report.warnings.some((w) => w.includes('Voxta'))).toBe(true);
    });
  });

  describe('Voxta export', () => {
    it('should NOT report loss of system_prompt (Voxta supports it)', () => {
      const card = createTestCard({
        system_prompt: 'You are helpful.',
      });
      const assets = [createTestAsset()];

      const report = checkExportLoss(card, assets, 'voxta');

      expect(report.lostFields).not.toContain('system_prompt');
      expect(report.isLossless).toBe(true);
    });

    it('should NOT report loss of alternate_greetings (Voxta supports it)', () => {
      const card = createTestCard({
        alternate_greetings: ['Hi!', 'Hey!'],
      });
      const assets = [createTestAsset()];

      const report = checkExportLoss(card, assets, 'voxta');

      expect(report.lostFields.some((f) => f.includes('alternate_greetings'))).toBe(false);
      expect(report.isLossless).toBe(true);
    });

    it('should report loss of group_only_greetings', () => {
      const card = createTestCard({
        group_only_greetings: ['Welcome all!'],
      });
      const assets = [createTestAsset()];

      const report = checkExportLoss(card, assets, 'voxta');

      expect(report.lostFields.some((f) => f.includes('group_only_greetings'))).toBe(true);
    });

    it('should report loss of risu extensions', () => {
      const card = createTestCard({
        extensions: { risuai: { emotions: [] } },
      });
      const assets = [createTestAsset()];

      const report = checkExportLoss(card, assets, 'voxta');

      expect(report.lostFields.some((f) => f.includes('risuai'))).toBe(true);
    });
  });
});

describe('preExportCheck', () => {
  it('should allow export and report loss for group_only_greetings', () => {
    // group_only_greetings is NOT supported by Voxta (unlike system_prompt which IS)
    const card = createTestCard({ group_only_greetings: ['Welcome all!'] });
    const assets = [createTestAsset()];

    const check = preExportCheck(card, assets, 'voxta');

    expect(check.canExport).toBe(true);
    expect(check.lossReport.lostFields.length).toBeGreaterThan(0);
  });

  it('should suggest alternative formats with less loss', () => {
    // group_only_greetings causes loss in Voxta but not in CharX/PNG
    const card = createTestCard({
      group_only_greetings: ['Group hello!'],
    });
    const assets = [createTestAsset()];

    const check = preExportCheck(card, assets, 'voxta');

    // CharX and PNG should be suggested as they lose less
    expect(check.suggestedFormats).toBeDefined();
    if (check.suggestedFormats) {
      expect(check.suggestedFormats.includes('charx')).toBe(true);
    }
  });

  it('should report lossless for supported fields', () => {
    // system_prompt, alternate_greetings ARE supported by Voxta
    const card = createTestCard({
      system_prompt: 'Test',
      alternate_greetings: ['Hi'],
    });
    const assets = [createTestAsset()];

    const check = preExportCheck(card, assets, 'voxta');

    expect(check.canExport).toBe(true);
    expect(check.lossReport.isLossless).toBe(true);
    expect(check.suggestedFormats).toBeUndefined();
  });
});

describe('formatLossReport', () => {
  it('should format lossless report', () => {
    const report = {
      lostFields: [],
      lostAssets: [],
      warnings: [],
      targetFormat: 'charx' as const,
      isLossless: true,
    };

    const formatted = formatLossReport(report);

    expect(formatted).toContain('lossless');
  });

  it('should format report with lost fields', () => {
    const report = {
      lostFields: ['system_prompt', 'alternate_greetings (2 entries)'],
      lostAssets: [],
      warnings: [],
      targetFormat: 'voxta' as const,
      isLossless: false,
    };

    const formatted = formatLossReport(report);

    expect(formatted).toContain('VOXTA');
    expect(formatted).toContain('system_prompt');
    expect(formatted).toContain('alternate_greetings');
  });

  it('should format report with warnings', () => {
    const report = {
      lostFields: ['test_field'],
      lostAssets: [],
      warnings: ['Some assets may not load'],
      targetFormat: 'png' as const,
      isLossless: false,
    };

    const formatted = formatLossReport(report);

    expect(formatted).toContain('Warnings');
    expect(formatted).toContain('assets');
  });
});
