/**
 * Detect Command
 *
 * Detect format and display basic info.
 */

import { Command } from 'commander';
import { detectFormat, parseCard } from '@character-foundry/loader';
import { output, readFileBytes, handleError, EXIT_SUCCESS } from '../utils/index.js';

interface DetectOptions {
  json?: boolean;
  quiet?: boolean;
}

export function createDetectCommand(): Command {
  return new Command('detect')
    .description('Detect character card format')
    .argument('<file>', 'Character card file to detect')
    .option('--json', 'Output as JSON')
    .option('-q, --quiet', 'Suppress non-essential output')
    .action(async (file: string, opts: DetectOptions) => {
      try {
        const data = await readFileBytes(file);
        const detection = detectFormat(data);

        if (opts.json) {
          // Try to parse for spec info
          let spec: string | undefined;
          let name: string | undefined;
          try {
            const result = parseCard(data);
            spec = result.spec;
            name = result.card.data.name;
          } catch {
            // Ignore parse errors for detect
          }

          output.json({
            success: true,
            format: detection.format,
            confidence: detection.confidence,
            reason: detection.reason,
            ...(spec && { spec }),
            ...(name && { name }),
          });
        } else {
          output.field('Format', detection.format, opts);
          output.field('Confidence', detection.confidence, opts);

          // Try to get more info via parsing
          try {
            const result = parseCard(data);
            output.field('Spec', result.spec, opts);
            output.field('Name', result.card.data.name, opts);
          } catch {
            // Ignore parse errors
          }
        }

        process.exit(EXIT_SUCCESS);
      } catch (err) {
        handleError(err, opts);
      }
    });
}
