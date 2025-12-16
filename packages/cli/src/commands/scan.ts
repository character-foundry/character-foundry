/**
 * Scan Command
 *
 * Recursively scan a directory for character cards and categorize them.
 * Useful for finding test fixtures with specific issues.
 */

import { Command } from 'commander';
import { readdir, stat } from 'node:fs/promises';
import { join, extname, relative } from 'node:path';
import { parseCard, detectFormat } from '@character-foundry/loader';
import type { CCv3Data } from '@character-foundry/schemas';
import { output, readFileBytes, handleError, EXIT_SUCCESS } from '../utils/index.js';

// Known issues to detect
type IssueType =
  | 'null_personality'
  | 'null_mes_example'
  | 'null_character_book'
  | 'missing_name'
  | 'missing_description'
  | 'missing_first_mes'
  | 'missing_tags'
  | 'missing_creator'
  | 'non_array_tags'
  | 'non_array_alternate_greetings'
  | 'timestamp_milliseconds'
  | 'v1_unwrapped'
  | 'hybrid_format'
  | 'has_character_book'
  | 'has_assets'
  | 'has_alternate_greetings'
  | 'has_extensions'
  | 'has_risuai_extensions'
  | 'has_group_only_greetings'
  | 'parse_error'
  | 'empty_name'
  | 'empty_description'
  | 'empty_first_mes'
  | 'large_lorebook'
  | 'many_assets';

interface CardInfo {
  path: string;
  relativePath: string;
  name: string;
  containerFormat: string;
  spec: string;
  sourceFormat: string;
  size: number;
  issues: IssueType[];
  assetCount: number;
  lorebookEntryCount: number;
  hasWarnings: boolean;
  error?: string;
}

interface ScanSummary {
  totalFiles: number;
  parsedSuccessfully: number;
  parseErrors: number;
  byFormat: Record<string, number>;
  bySpec: Record<string, number>;
  byIssue: Record<IssueType, string[]>; // issue -> file paths
  cards: CardInfo[];
}

interface ScanOptions {
  json?: boolean;
  quiet?: boolean;
  recursive?: boolean;
  minIssues?: string;
  hasIssue?: string[];
  limit?: string;
  includeGood?: boolean;
}

const SUPPORTED_EXTENSIONS = new Set(['.png', '.charx', '.voxpkg', '.json']);

/**
 * Recursively find all files with supported extensions
 */
async function findFiles(dir: string, recursive: boolean): Promise<string[]> {
  const files: string[] = [];

  async function walk(currentDir: string): Promise<void> {
    const entries = await readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);

      if (entry.isDirectory() && recursive) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        const ext = extname(entry.name).toLowerCase();
        if (SUPPORTED_EXTENSIONS.has(ext)) {
          files.push(fullPath);
        }
      }
    }
  }

  await walk(dir);
  return files;
}

/**
 * Detect issues in a parsed card
 */
function detectIssues(
  card: CCv3Data,
  originalShape: unknown,
  spec: string,
  assetCount: number
): IssueType[] {
  const issues: IssueType[] = [];
  const data = card.data;
  const original = originalShape as Record<string, unknown> | undefined;

  // Null fields (detected from original shape if available)
  if (original) {
    const origData = (original.data ?? original) as Record<string, unknown>;
    if (origData.personality === null) issues.push('null_personality');
    if (origData.mes_example === null) issues.push('null_mes_example');
    if (origData.character_book === null) issues.push('null_character_book');

    // Non-array checks on original
    if (origData.tags !== undefined && !Array.isArray(origData.tags)) {
      issues.push('non_array_tags');
    }
    if (origData.alternate_greetings !== undefined && !Array.isArray(origData.alternate_greetings)) {
      issues.push('non_array_alternate_greetings');
    }

    // Hybrid format (ChubAI) - fields at root level
    if (original.name || original.description || original.personality) {
      if (original.data && typeof original.data === 'object') {
        issues.push('hybrid_format');
      }
    }

    // Timestamp in milliseconds (>year 2100 in seconds = 4102444800)
    if (origData.creation_date && typeof origData.creation_date === 'number') {
      if (origData.creation_date > 4102444800) {
        issues.push('timestamp_milliseconds');
      }
    }
  }

  // V1 unwrapped format
  if (spec === 'v1' || (original && !original.spec && !original.data)) {
    issues.push('v1_unwrapped');
  }

  // Missing/empty fields
  if (!data.name) issues.push('missing_name');
  else if (data.name.trim() === '') issues.push('empty_name');

  if (!data.description) issues.push('missing_description');
  else if (data.description.trim() === '') issues.push('empty_description');

  if (!data.first_mes) issues.push('missing_first_mes');
  else if (data.first_mes.trim() === '') issues.push('empty_first_mes');

  if (!data.tags || data.tags.length === 0) issues.push('missing_tags');
  if (!data.creator) issues.push('missing_creator');

  // Feature presence (not issues, but useful for finding examples)
  if (data.character_book && data.character_book.entries.length > 0) {
    issues.push('has_character_book');
    if (data.character_book.entries.length > 50) {
      issues.push('large_lorebook');
    }
  }

  if (data.assets && data.assets.length > 0) {
    issues.push('has_assets');
    if (assetCount > 10) {
      issues.push('many_assets');
    }
  }

  if (data.alternate_greetings && data.alternate_greetings.length > 0) {
    issues.push('has_alternate_greetings');
  }

  if (data.group_only_greetings && data.group_only_greetings.length > 0) {
    issues.push('has_group_only_greetings');
  }

  if (data.extensions && Object.keys(data.extensions).length > 0) {
    issues.push('has_extensions');
    if ((data.extensions as Record<string, unknown>).risuai) {
      issues.push('has_risuai_extensions');
    }
  }

  return issues;
}

/**
 * Analyze a single file
 */
async function analyzeFile(filePath: string, baseDir: string): Promise<CardInfo> {
  const relativePath = relative(baseDir, filePath);
  const fileStat = await stat(filePath);

  try {
    const data = await readFileBytes(filePath);
    const detection = detectFormat(data);

    if (detection.format === 'unknown') {
      return {
        path: filePath,
        relativePath,
        name: '',
        containerFormat: 'unknown',
        spec: 'unknown',
        sourceFormat: 'unknown',
        size: fileStat.size,
        issues: ['parse_error'],
        assetCount: 0,
        lorebookEntryCount: 0,
        hasWarnings: false,
        error: detection.reason,
      };
    }

    const result = parseCard(data);
    const issues = detectIssues(
      result.card,
      result.originalShape,
      result.spec,
      result.assets.length
    );

    return {
      path: filePath,
      relativePath,
      name: result.card.data.name || '(unnamed)',
      containerFormat: result.containerFormat,
      spec: result.spec,
      sourceFormat: result.sourceFormat,
      size: fileStat.size,
      issues,
      assetCount: result.assets.length,
      lorebookEntryCount: result.card.data.character_book?.entries.length ?? 0,
      hasWarnings: (result.warnings?.length ?? 0) > 0,
    };
  } catch (err) {
    return {
      path: filePath,
      relativePath,
      name: '',
      containerFormat: 'unknown',
      spec: 'unknown',
      sourceFormat: 'unknown',
      size: fileStat.size,
      issues: ['parse_error'],
      assetCount: 0,
      lorebookEntryCount: 0,
      hasWarnings: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Build summary from card infos
 */
function buildSummary(cards: CardInfo[]): ScanSummary {
  const summary: ScanSummary = {
    totalFiles: cards.length,
    parsedSuccessfully: 0,
    parseErrors: 0,
    byFormat: {},
    bySpec: {},
    byIssue: {} as Record<IssueType, string[]>,
    cards,
  };

  for (const card of cards) {
    if (card.issues.includes('parse_error')) {
      summary.parseErrors++;
    } else {
      summary.parsedSuccessfully++;
    }

    // Count by format
    summary.byFormat[card.containerFormat] = (summary.byFormat[card.containerFormat] || 0) + 1;

    // Count by spec
    summary.bySpec[card.spec] = (summary.bySpec[card.spec] || 0) + 1;

    // Index by issue
    for (const issue of card.issues) {
      if (!summary.byIssue[issue]) {
        summary.byIssue[issue] = [];
      }
      summary.byIssue[issue].push(card.relativePath);
    }
  }

  return summary;
}

export function createScanCommand(): Command {
  return new Command('scan')
    .description('Scan directory for character cards and categorize by format/issues')
    .argument('<directory>', 'Directory to scan')
    .option('--json', 'Output as JSON')
    .option('-q, --quiet', 'Suppress progress output')
    .option('-r, --recursive', 'Recursively scan subdirectories', true)
    .option('--no-recursive', 'Do not recurse into subdirectories')
    .option('--min-issues <n>', 'Only show cards with at least N issues')
    .option('--has-issue <issues...>', 'Filter to cards with specific issue(s)')
    .option('--limit <n>', 'Limit output to N cards per category')
    .option('--include-good', 'Include cards with no issues in output')
    .action(async (directory: string, opts: ScanOptions) => {
      try {
        if (!opts.quiet && !opts.json) {
          output.info(`Scanning ${directory}...`);
        }

        // Find all files
        const files = await findFiles(directory, opts.recursive !== false);

        if (!opts.quiet && !opts.json) {
          output.info(`Found ${files.length} potential card files`);
        }

        // Analyze each file
        const cards: CardInfo[] = [];
        let processed = 0;

        for (const file of files) {
          const info = await analyzeFile(file, directory);
          cards.push(info);
          processed++;

          if (!opts.quiet && !opts.json && processed % 100 === 0) {
            output.info(`Processed ${processed}/${files.length}...`);
          }
        }

        // Build summary
        let summary = buildSummary(cards);

        // Apply filters
        let filteredCards = summary.cards;

        if (opts.minIssues) {
          const min = parseInt(opts.minIssues, 10);
          filteredCards = filteredCards.filter(c => c.issues.length >= min);
        }

        if (opts.hasIssue && opts.hasIssue.length > 0) {
          filteredCards = filteredCards.filter(c =>
            opts.hasIssue!.some(issue => c.issues.includes(issue as IssueType))
          );
        }

        if (!opts.includeGood) {
          // Filter out cards with no meaningful issues (only feature flags)
          const featureFlags: IssueType[] = [
            'has_character_book', 'has_assets', 'has_alternate_greetings',
            'has_extensions', 'has_risuai_extensions', 'has_group_only_greetings',
            'large_lorebook', 'many_assets'
          ];
          filteredCards = filteredCards.filter(c =>
            c.issues.some(issue => !featureFlags.includes(issue))
          );
        }

        // Apply limit per issue category
        const limit = opts.limit ? parseInt(opts.limit, 10) : undefined;

        if (opts.json) {
          // Rebuild summary with filtered cards
          summary = buildSummary(filteredCards);

          // Apply limit to byIssue paths
          if (limit) {
            for (const issue of Object.keys(summary.byIssue) as IssueType[]) {
              summary.byIssue[issue] = summary.byIssue[issue].slice(0, limit);
            }
          }

          output.json({
            success: true,
            ...summary,
          });
        } else {
          // Human-readable output
          output.header('Scan Summary');
          output.field('Total files', summary.totalFiles);
          output.field('Parsed successfully', summary.parsedSuccessfully);
          output.field('Parse errors', summary.parseErrors);

          output.header('By Format');
          for (const [format, count] of Object.entries(summary.byFormat).sort((a, b) => b[1] - a[1])) {
            output.bullet(`${format}: ${count}`);
          }

          output.header('By Spec');
          for (const [spec, count] of Object.entries(summary.bySpec).sort((a, b) => b[1] - a[1])) {
            output.bullet(`${spec}: ${count}`);
          }

          output.header('By Issue');
          const issueEntries = Object.entries(summary.byIssue)
            .sort((a, b) => b[1].length - a[1].length);

          for (const [issue, paths] of issueEntries) {
            output.bullet(`${issue}: ${paths.length} cards`);

            // Show example files
            const examples = limit ? paths.slice(0, limit) : paths.slice(0, 3);
            for (const path of examples) {
              output.bullet(path, 4);
            }
            if (paths.length > examples.length) {
              output.bullet(`... and ${paths.length - examples.length} more`, 4);
            }
          }

          // Show cards with most issues
          const interesting = [...filteredCards]
            .sort((a, b) => b.issues.length - a.issues.length)
            .slice(0, 10);

          if (interesting.length > 0) {
            output.header('Most Interesting Cards (by issue count)');
            for (const card of interesting) {
              output.bullet(`${card.relativePath}`);
              output.bullet(`Name: ${card.name}`, 4);
              output.bullet(`Format: ${card.containerFormat} / ${card.spec}`, 4);
              output.bullet(`Issues: ${card.issues.join(', ')}`, 4);
            }
          }
        }

        process.exit(EXIT_SUCCESS);
      } catch (err) {
        handleError(err, opts);
      }
    });
}
