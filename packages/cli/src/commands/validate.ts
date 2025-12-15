/**
 * Validate Command
 *
 * Schema validation with detailed errors.
 */

import { Command } from 'commander';
import { parseCard, detectFormat } from '@character-foundry/loader';
import { CCv3DataSchema, CCv2DataSchema, safeParse } from '@character-foundry/schemas';
import { output, readFileBytes, handleError, EXIT_SUCCESS, EXIT_VALIDATION, EXIT_PARSE } from '../utils/index.js';

interface ValidateOptions {
  json?: boolean;
  quiet?: boolean;
  strict?: boolean;
}

export function createValidateCommand(): Command {
  return new Command('validate')
    .description('Validate character card schema')
    .argument('<file>', 'Character card file to validate')
    .option('--json', 'Output as JSON')
    .option('-q, --quiet', 'Suppress non-essential output')
    .option('--strict', 'Enable strict validation')
    .action(async (file: string, opts: ValidateOptions) => {
      try {
        const data = await readFileBytes(file);

        // First check format
        const detection = detectFormat(data);
        if (detection.format === 'unknown') {
          if (opts.json) {
            output.json({
              success: false,
              valid: false,
              errors: [`Unrecognized format: ${detection.reason}`],
            });
          } else {
            output.error(`Unrecognized format: ${detection.reason}`);
          }
          process.exit(EXIT_PARSE);
        }

        // Parse the card
        let result;
        try {
          result = parseCard(data);
        } catch (parseErr) {
          if (opts.json) {
            output.json({
              success: false,
              valid: false,
              errors: [parseErr instanceof Error ? parseErr.message : String(parseErr)],
            });
          } else {
            output.error(`Parse failed: ${parseErr instanceof Error ? parseErr.message : parseErr}`);
          }
          process.exit(EXIT_PARSE);
        }

        // Validate against schema
        const errors: string[] = [];

        // Validate as CCv3
        const v3Result = safeParse(CCv3DataSchema, result.card);
        if (!v3Result.success) {
          errors.push(...(v3Result.error ? [v3Result.error] : []));
        }

        // Also validate original shape if available
        if (result.originalShape && opts.strict) {
          // Check if it's a v2 card
          if (result.spec === 'v2') {
            const v2Result = safeParse(CCv2DataSchema, result.originalShape);
            if (!v2Result.success) {
              errors.push(`Original v2 validation: ${v2Result.error}`);
            }
          }
        }

        const valid = errors.length === 0;

        if (opts.json) {
          output.json({
            success: true,
            valid,
            format: result.containerFormat,
            spec: result.spec,
            name: result.card.data.name,
            ...(errors.length > 0 && { errors }),
            ...(result.warnings && result.warnings.length > 0 && { warnings: result.warnings }),
          });
        } else {
          if (valid) {
            output.success(`Valid ${result.spec} card: ${result.card.data.name}`, opts);
          } else {
            output.error('Validation failed:', opts);
            for (const err of errors) {
              output.bullet(err, 2, opts);
            }
          }

          // Show warnings
          if (result.warnings && result.warnings.length > 0) {
            for (const warning of result.warnings) {
              output.warn(warning, opts);
            }
          }
        }

        process.exit(valid ? EXIT_SUCCESS : EXIT_VALIDATION);
      } catch (err) {
        handleError(err, opts);
      }
    });
}
