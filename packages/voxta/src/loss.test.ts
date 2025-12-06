/**
 * Voxta Loss Reporting Tests
 */

import { describe, it, expect } from 'vitest';
import { checkVoxtaLoss, isVoxtaExportLossless, formatVoxtaLossReport } from './loss.js';
import type { NormalizedCard } from '@character-foundry/schemas';

describe('checkVoxtaLoss', () => {
  const minimalCard: NormalizedCard = {
    name: 'Test',
    description: '',
    personality: '',
    scenario: '',
    firstMes: '',
    mesExample: '',
    alternateGreetings: [],
    groupOnlyGreetings: [],
    tags: [],
    extensions: {},
  };

  it('should report no loss for minimal card', () => {
    const report = checkVoxtaLoss(minimalCard);

    expect(report.lostFields.length).toBe(0);
    expect(report.warnings.length).toBe(0);
  });

  it('should report loss of system_prompt', () => {
    const card: NormalizedCard = {
      ...minimalCard,
      systemPrompt: 'You are a helpful assistant.',
    };

    const report = checkVoxtaLoss(card);

    expect(report.lostFields).toContain('system_prompt');
  });

  it('should report loss of post_history_instructions', () => {
    const card: NormalizedCard = {
      ...minimalCard,
      postHistoryInstructions: 'Remember to be helpful.',
    };

    const report = checkVoxtaLoss(card);

    expect(report.lostFields).toContain('post_history_instructions');
  });

  it('should report loss of alternate_greetings', () => {
    const card: NormalizedCard = {
      ...minimalCard,
      alternateGreetings: ['Hi!', 'Hello!', 'Hey there!'],
    };

    const report = checkVoxtaLoss(card);

    expect(report.lostFields.some((f) => f.includes('alternate_greetings'))).toBe(true);
    expect(report.lostFields.some((f) => f.includes('3 entries'))).toBe(true);
  });

  it('should report loss of group_only_greetings', () => {
    const card: NormalizedCard = {
      ...minimalCard,
      groupOnlyGreetings: ['Welcome to the group!'],
    };

    const report = checkVoxtaLoss(card);

    expect(report.lostFields.some((f) => f.includes('group_only_greetings'))).toBe(true);
  });

  it('should report loss of risuai extensions', () => {
    const card: NormalizedCard = {
      ...minimalCard,
      extensions: {
        risuai: {
          emotion_images: [],
        },
      },
    };

    const report = checkVoxtaLoss(card);

    expect(report.lostFields.some((f) => f.includes('risuai'))).toBe(true);
  });

  it('should warn about Risu scripts', () => {
    const card: NormalizedCard = {
      ...minimalCard,
      extensions: {
        risuai: {
          triggerscript: [{ type: 'before', content: 'test' }],
        },
      },
    };

    const report = checkVoxtaLoss(card);

    expect(report.warnings.some((w) => w.includes('script'))).toBe(true);
  });

  it('should report loss of depth_prompt', () => {
    const card: NormalizedCard = {
      ...minimalCard,
      extensions: {
        depth_prompt: {
          prompt: 'Deep context',
          depth: 4,
        },
      },
    };

    const report = checkVoxtaLoss(card);

    expect(report.lostFields.some((f) => f.includes('depth_prompt'))).toBe(true);
    expect(report.warnings.some((w) => w.includes('depth prompt'))).toBe(true);
  });

  it('should report loss of chub extensions', () => {
    const card: NormalizedCard = {
      ...minimalCard,
      extensions: {
        chub: {
          full_path: '/characters/test',
        },
      },
    };

    const report = checkVoxtaLoss(card);

    expect(report.lostFields.some((f) => f.includes('chub'))).toBe(true);
  });

  it('should report loss of character_book extensions', () => {
    const card: NormalizedCard = {
      ...minimalCard,
      characterBook: {
        name: 'Lore',
        entries: [],
        extensions: { custom: 'value' },
      },
    };

    const report = checkVoxtaLoss(card);

    expect(report.lostFields.some((f) => f.includes('character_book.extensions'))).toBe(true);
  });
});

describe('isVoxtaExportLossless', () => {
  it('should return true for minimal card', () => {
    const card: NormalizedCard = {
      name: 'Test',
      description: '',
      personality: '',
      scenario: '',
      firstMes: '',
      mesExample: '',
      alternateGreetings: [],
      groupOnlyGreetings: [],
      tags: [],
      extensions: {},
    };

    expect(isVoxtaExportLossless(card)).toBe(true);
  });

  it('should return false when data would be lost', () => {
    const card: NormalizedCard = {
      name: 'Test',
      description: '',
      personality: '',
      scenario: '',
      firstMes: '',
      mesExample: '',
      systemPrompt: 'Important system prompt',
      alternateGreetings: [],
      groupOnlyGreetings: [],
      tags: [],
      extensions: {},
    };

    expect(isVoxtaExportLossless(card)).toBe(false);
  });
});

describe('formatVoxtaLossReport', () => {
  it('should format empty report', () => {
    const report = {
      lostFields: [],
      lostAssets: [],
      warnings: [],
      reason: 'Test',
    };

    const formatted = formatVoxtaLossReport(report);

    expect(formatted).toBe('No data will be lost in this export.');
  });

  it('should format report with lost fields', () => {
    const report = {
      lostFields: ['system_prompt', 'alternate_greetings (2 entries)'],
      lostAssets: [],
      warnings: [],
      reason: 'Voxta format does not support extensions field',
    };

    const formatted = formatVoxtaLossReport(report);

    expect(formatted).toContain('Voxta Export Loss Report');
    expect(formatted).toContain('system_prompt');
    expect(formatted).toContain('alternate_greetings');
    expect(formatted).toContain('Reason:');
  });

  it('should format report with warnings', () => {
    const report = {
      lostFields: [],
      lostAssets: [],
      warnings: ['Risu scripts will be lost'],
      reason: 'Test',
    };

    const formatted = formatVoxtaLossReport(report);

    expect(formatted).toContain('Warnings:');
    expect(formatted).toContain('Risu scripts');
  });

  it('should format report with lost assets', () => {
    const report = {
      lostFields: [],
      lostAssets: ['emotion_happy.png', 'voice_sample.mp3'],
      warnings: [],
      reason: 'Test',
    };

    const formatted = formatVoxtaLossReport(report);

    expect(formatted).toContain('Lost Assets:');
    expect(formatted).toContain('emotion_happy.png');
    expect(formatted).toContain('voice_sample.mp3');
  });
});
