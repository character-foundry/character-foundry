/**
 * Diagnostic Command - Inspect Voxta Package Raw Data
 *
 * Shows EXACTLY what's in the character.json file before any processing.
 * Use this to debug "empty data" issues.
 */

import { Command } from 'commander';
import { readFileBytes, output, handleError, EXIT_SUCCESS } from '../utils/index.js';
import { streamingUnzipSync } from '@character-foundry/core/zip';
import { toString } from '@character-foundry/core';
import type { VoxtaCharacter } from '@character-foundry/voxta';

interface DiagnoseOptions {
  json?: boolean;
  quiet?: boolean;
}

interface DiagnoseReport {
  characterId: string;
  path: string;
  totalFields: number;
  populatedFields: number;
  emptyFields: number;
  emptyFieldNames: string[];
  fieldAnalysis: Record<string, string>;
}

function formatValue(value: unknown): string {
  if (value === undefined) return '<undefined>';
  if (value === null) return '<null>';
  if (value === '') return '<empty string>';
  if (Array.isArray(value) && value.length === 0) return '<empty array>';
  if (typeof value === 'string' && value.trim() === '') return '<whitespace only>';
  return JSON.stringify(value);
}

export function createDiagnoseVoxtaCommand(): Command {
  return new Command('diagnose-voxta')
    .description('Inspect raw character.json data from voxpkg file (debug empty data)')
    .argument('<file>', 'Path to .voxpkg file')
    .option('--json', 'Output as JSON')
    .option('-q, --quiet', 'Suppress non-essential output')
    .action(async (file: string, opts: DiagnoseOptions) => {
      try {
        // Read the file
        const data = await readFileBytes(file);

        // Extract ZIP
        const extracted = streamingUnzipSync(data);

        // Find character.json files
        const characterFiles = Object.keys(extracted).filter(path =>
          path.match(/^Characters\/[^/]+\/character\.json$/)
        );

        if (characterFiles.length === 0) {
          output.error('No character.json files found in package');
          output.info('Available files:');
          Object.keys(extracted).forEach(path => output.bullet(path, 2));
          process.exit(1);
        }

        const reports: DiagnoseReport[] = [];

        for (const charPath of characterFiles) {
          const fileData = extracted[charPath]!;
          const jsonStr = toString(fileData);
          const character = JSON.parse(jsonStr) as VoxtaCharacter;

          const charId = charPath.match(/Characters\/([^/]+)\//)?.[1] || 'unknown';

          // Field-by-field analysis
          const fieldAnalysis = {
            // Core identity
            '$type': formatValue(character.$type),
            'Id': formatValue(character.Id),
            'PackageId': formatValue(character.PackageId),
            'Name': formatValue(character.Name),
            'Label': formatValue(character.Label),
            'Version': formatValue(character.Version),

            // Visual/Descriptive (MOST IMPORTANT)
            'Description': formatValue(character.Description),
            'Personality': formatValue(character.Personality),
            'Profile': formatValue(character.Profile),
            'Scenario': formatValue(character.Scenario),

            // Messages (MOST IMPORTANT)
            'FirstMessage': formatValue(character.FirstMessage),
            'MessageExamples': formatValue(character.MessageExamples),
            'AlternativeFirstMessages': formatValue(character.AlternativeFirstMessages),

            // Prompts
            'SystemPrompt': formatValue(character.SystemPrompt),
            'PostHistoryInstructions': formatValue(character.PostHistoryInstructions),
            'Context': formatValue(character.Context),
            'Instructions': formatValue(character.Instructions),

            // User overrides
            'UserNameOverride': formatValue(character.UserNameOverride),
            'UserDescriptionOverride': formatValue(character.UserDescriptionOverride),

            // Metadata
            'Creator': formatValue(character.Creator),
            'CreatorNotes': formatValue(character.CreatorNotes),
            'Tags': formatValue(character.Tags),
            'Culture': formatValue(character.Culture),
            'ImportedFrom': formatValue(character.ImportedFrom),

            // Timestamps
            'DateCreated': formatValue(character.DateCreated),
            'DateModified': formatValue(character.DateModified),
          };

          // Count empty fields
          let emptyCount = 0;
          let populatedCount = 0;
          const emptyFields: string[] = [];

          Object.entries(fieldAnalysis).forEach(([field, value]) => {
            if (value.startsWith('<empty') || value.startsWith('<undefined') || value.startsWith('<null>')) {
              emptyCount++;
              emptyFields.push(field);
            } else {
              populatedCount++;
            }
          });

          const report = {
            characterId: charId,
            path: charPath,
            totalFields: Object.keys(fieldAnalysis).length,
            populatedFields: populatedCount,
            emptyFields: emptyCount,
            emptyFieldNames: emptyFields,
            fieldAnalysis,
          };

          reports.push(report);

          if (!opts.json && !opts.quiet) {
            output.header(`Character: ${charId}`);
            output.field('Path', charPath);
            output.field('Name', formatValue(character.Name));
            output.field('Fields populated', `${populatedCount}/${Object.keys(fieldAnalysis).length}`);
            output.field('Fields empty/missing', emptyCount.toString());

            if (emptyCount > 0) {
              output.header('Empty/Missing Fields');
              emptyFields.forEach(field => output.bullet(field, 2));
            }

            output.header('All Field Values');
            Object.entries(fieldAnalysis).forEach(([field, value]) => {
              const prefix = value.startsWith('<') ? '❌ ' : '✅ ';
              output.bullet(`${prefix}${field}: ${value}`, 2);
            });

            if (emptyCount > 15) {
              output.warn(`
⚠️  WARNING: This character has ${emptyCount} empty/missing fields!
This is why your cards appear empty after import.
The character.json file in this voxpkg is incomplete.`);
            }
          }
        }

        if (opts.json) {
          output.json({
            success: true,
            file,
            characters: reports,
          });
        }

        process.exit(EXIT_SUCCESS);
      } catch (err) {
        handleError(err, opts);
      }
    });
}
