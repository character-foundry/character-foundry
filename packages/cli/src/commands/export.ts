/**
 * Export Command
 *
 * Convert between formats.
 */

import { Command } from 'commander';
import { basename, dirname, join } from 'node:path';
import { parseCard } from '@character-foundry/loader';
import { exportCard } from '@character-foundry/exporter';
import type { ExportFormat, ExportCardOptions } from '@character-foundry/exporter';
import { output, readFileBytes, writeFileBytes, handleError, EXIT_SUCCESS, EXIT_UNSUPPORTED, formatSize } from '../utils/index.js';

interface ExportOptions {
  json?: boolean;
  quiet?: boolean;
  to: string;
  out?: string;
  force?: boolean;
  v2?: boolean;
}

const VALID_FORMATS = ['png', 'charx', 'voxta'];
const FORMAT_EXTENSIONS: Record<string, string> = {
  png: '.png',
  charx: '.charx',
  voxta: '.voxpkg',
};

export function createExportCommand(): Command {
  return new Command('export')
    .description('Export card to a different format')
    .argument('<file>', 'Character card file')
    .requiredOption('--to <format>', 'Target format (png, charx, voxta)')
    .option('--out <path>', 'Output path (default: same directory with new extension)')
    .option('--json', 'Output as JSON')
    .option('-q, --quiet', 'Suppress non-essential output')
    .option('-f, --force', 'Overwrite existing file')
    .option('--v2', 'Export PNG as v2 format for maximum compatibility')
    .action(async (file: string, opts: ExportOptions) => {
      try {
        // Validate target format
        const targetFormat = opts.to.toLowerCase() as ExportFormat;
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

        // Build export options
        const exportOptions: ExportCardOptions = {
          format: targetFormat,
        };
        if (targetFormat === 'png' && opts.v2) {
          exportOptions.png = { exportAsV2: true };
        }

        // Export
        const exportResult = exportCard(result.card, exportAssets, exportOptions);

        // Determine output path
        let outputPath: string;
        if (opts.out) {
          outputPath = opts.out;
        } else {
          const inputDir = dirname(file);
          const inputName = basename(file, basename(file).substring(basename(file).lastIndexOf('.')));
          outputPath = join(inputDir, `${inputName}${FORMAT_EXTENSIONS[targetFormat]}`);
        }

        // Write file
        await writeFileBytes(outputPath, exportResult.buffer);

        if (opts.json) {
          output.json({
            success: true,
            inputFormat: result.containerFormat,
            outputFormat: targetFormat,
            outputPath,
            size: exportResult.totalSize,
            assetCount: exportResult.assetCount,
            ...(exportResult.lossReport && !exportResult.lossReport.isLossless && {
              lossReport: {
                lostFields: exportResult.lossReport.lostFields,
                lostAssets: exportResult.lossReport.lostAssets,
                warnings: exportResult.lossReport.warnings,
              },
            }),
          });
        } else {
          output.success(`Exported to ${outputPath} (${formatSize(exportResult.totalSize)})`, opts);

          // Show loss warnings
          if (exportResult.lossReport && !exportResult.lossReport.isLossless) {
            if (exportResult.lossReport.lostFields.length > 0) {
              output.warn(`${exportResult.lossReport.lostFields.length} field(s) lost`, opts);
            }
            if (exportResult.lossReport.lostAssets.length > 0) {
              output.warn(`${exportResult.lossReport.lostAssets.length} asset(s) lost`, opts);
            }
          }
        }

        process.exit(EXIT_SUCCESS);
      } catch (err) {
        handleError(err, opts);
      }
    });
}
