/**
 * Loss Command
 *
 * Preview data loss before conversion.
 */

import { Command } from 'commander';
import { parseCard } from '@character-foundry/loader';
import { checkExportLoss } from '@character-foundry/exporter';
import type { ExportFormat } from '@character-foundry/exporter';
import { output, readFileBytes, handleError, EXIT_SUCCESS, EXIT_UNSUPPORTED, colors } from '../utils/index.js';

interface LossOptions {
  json?: boolean;
  quiet?: boolean;
  to: string;
}

const VALID_FORMATS = ['png', 'charx', 'voxta'];

export function createLossCommand(): Command {
  return new Command('loss')
    .description('Preview data loss for format conversion')
    .argument('<file>', 'Character card file')
    .requiredOption('--to <format>', 'Target format (png, charx, voxta)')
    .option('--json', 'Output as JSON')
    .option('-q, --quiet', 'Suppress non-essential output')
    .action(async (file: string, opts: LossOptions) => {
      try {
        // Validate target format
        const targetFormat = opts.to.toLowerCase();
        if (!VALID_FORMATS.includes(targetFormat)) {
          if (opts.json) {
            output.json({
              success: false,
              error: `Invalid target format: ${opts.to}. Valid formats: ${VALID_FORMATS.join(', ')}`,
            });
          } else {
            output.error(`Invalid target format: ${opts.to}`);
            output.print(`Valid formats: ${VALID_FORMATS.join(', ')}`);
          }
          process.exit(EXIT_UNSUPPORTED);
        }

        const data = await readFileBytes(file);
        const result = parseCard(data);

        // Convert extracted assets to export assets format
        const exportAssets = result.assets.map((a) => ({
          name: a.name,
          type: a.type as 'icon' | 'emotion' | 'background' | 'sound' | 'data' | 'custom',
          ext: a.ext,
          data: a.data,
          isMain: a.isMain,
          path: a.path,
          tags: a.tags,
        }));

        const lossReport = checkExportLoss(result.card, exportAssets, targetFormat as ExportFormat);

        if (opts.json) {
          output.json({
            success: true,
            sourceFormat: result.containerFormat,
            targetFormat,
            isLossless: lossReport.isLossless,
            lostFields: lossReport.lostFields,
            lostAssets: lossReport.lostAssets,
            warnings: lossReport.warnings,
          });
        } else {
          output.print(colors.bold(`Loss Report: ${result.containerFormat} -> ${targetFormat}`));
          output.divider('─', 40, opts);

          if (lossReport.isLossless) {
            output.success('No data loss detected', opts);
          } else {
            // Lost fields
            if (lossReport.lostFields.length > 0) {
              output.print('');
              output.print(colors.red('Fields that will be lost:'));
              for (const field of lossReport.lostFields) {
                output.bullet(field, 2, opts);
              }
            }

            // Lost assets
            if (lossReport.lostAssets.length > 0) {
              output.print('');
              output.print(colors.red('Assets that will be lost:'));
              for (const asset of lossReport.lostAssets) {
                output.bullet(asset, 2, opts);
              }
            }

            // Warnings
            if (lossReport.warnings.length > 0) {
              output.print('');
              output.print(colors.yellow('Warnings:'));
              for (const warning of lossReport.warnings) {
                output.bullet(warning, 2, opts);
              }
            }
          }
        }

        process.exit(EXIT_SUCCESS);
      } catch (err) {
        handleError(err, opts);
      }
    });
}
