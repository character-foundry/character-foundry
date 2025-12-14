/**
 * Info Command
 *
 * Full metadata summary with token counts.
 */

import { Command } from 'commander';
import { parseCard } from '@character-foundry/loader';
import { countCardTokens } from '@character-foundry/tokenizers';
import { output, readFileBytes, handleError, EXIT_SUCCESS, colors } from '../utils/index.js';

interface InfoOptions {
  json?: boolean;
  quiet?: boolean;
  tokenizer?: string;
}

export function createInfoCommand(): Command {
  return new Command('info')
    .description('Display card metadata and token counts')
    .argument('<file>', 'Character card file')
    .option('--json', 'Output as JSON')
    .option('-q, --quiet', 'Suppress non-essential output')
    .option('--tokenizer <id>', 'Tokenizer to use (default: gpt-4)', 'gpt-4')
    .action(async (file: string, opts: InfoOptions) => {
      try {
        const data = await readFileBytes(file);
        const result = parseCard(data);
        const card = result.card;
        const cardData = card.data;

        const tokens = countCardTokens(card, {
          tokenizer: opts.tokenizer,
        });

        const lorebookEntries = cardData.character_book?.entries?.length ?? 0;

        if (opts.json) {
          output.json({
            success: true,
            name: cardData.name,
            creator: cardData.creator,
            version: cardData.character_version,
            format: result.containerFormat,
            spec: result.spec,
            sourceFormat: result.sourceFormat,
            tokens,
            assets: {
              count: result.assets.length,
              types: [...new Set(result.assets.map((a) => a.type))],
            },
            lorebook: {
              entries: lorebookEntries,
            },
            tags: cardData.tags ?? [],
          });
        } else {
          // Basic info
          output.header('Character Info', opts);
          output.field('Name', cardData.name, opts);
          if (cardData.creator) output.field('Creator', cardData.creator, opts);
          if (cardData.character_version) output.field('Version', cardData.character_version, opts);
          output.field('Format', `${result.containerFormat} (${result.spec})`, opts);

          // Token counts
          output.header('Token Counts', opts);
          if (tokens.description > 0) {
            output.field('Description', `${tokens.description.toLocaleString()} tokens`, opts);
          }
          if (tokens.personality > 0) {
            output.field('Personality', `${tokens.personality.toLocaleString()} tokens`, opts);
          }
          if (tokens.scenario > 0) {
            output.field('Scenario', `${tokens.scenario.toLocaleString()} tokens`, opts);
          }
          if (tokens.firstMes > 0) {
            output.field('First Message', `${tokens.firstMes.toLocaleString()} tokens`, opts);
          }
          if (tokens.mesExample > 0) {
            output.field('Example Messages', `${tokens.mesExample.toLocaleString()} tokens`, opts);
          }
          if (tokens.systemPrompt > 0) {
            output.field('System Prompt', `${tokens.systemPrompt.toLocaleString()} tokens`, opts);
          }
          if (tokens.postHistoryInstructions > 0) {
            output.field('Post-History', `${tokens.postHistoryInstructions.toLocaleString()} tokens`, opts);
          }
          if (tokens.alternateGreetings > 0) {
            output.field('Alt Greetings', `${tokens.alternateGreetings.toLocaleString()} tokens`, opts);
          }
          if (tokens.lorebook > 0) {
            output.field('Lorebook', `${tokens.lorebook.toLocaleString()} tokens`, opts);
          }
          if (tokens.creatorNotes > 0) {
            output.field('Creator Notes', `${tokens.creatorNotes.toLocaleString()} tokens`, opts);
          }
          output.print('');
          output.field('Total', colors.bold(`${tokens.total.toLocaleString()} tokens`), opts);

          // Assets
          if (result.assets.length > 0) {
            output.header('Assets', opts);
            output.field('Count', result.assets.length.toString(), opts);
            const types = [...new Set(result.assets.map((a) => a.type))];
            output.field('Types', types.join(', '), opts);
          }

          // Lorebook
          if (lorebookEntries > 0) {
            output.header('Lorebook', opts);
            output.field('Entries', lorebookEntries.toString(), opts);
          }

          // Tags
          if (cardData.tags && cardData.tags.length > 0) {
            output.header('Tags', opts);
            output.print(cardData.tags.join(', '));
          }
        }

        process.exit(EXIT_SUCCESS);
      } catch (err) {
        handleError(err, opts);
      }
    });
}
